"""
Assign Course Repository.
Executes SQL queries for dbo.lms_assign_course and dbo.lms_course_enrollments.
"""

from typing import List, Dict, Any, Optional
from database.connection import dictfetchall, dictfetchone, is_sql_server

def insert_assignment(
    cursor,
    course_id: int,
    ld_id: str,
    learning_starting_date: str,
    target_completion_date: str,
    assignment_note: Optional[str],
    created_by: str,
    selected_employees: Optional[str] = None
) -> int:
    """Inserts a new assignment record into dbo.lms_assign_course."""
    query = """
        INSERT INTO dbo.lms_assign_course (
            ld_id,
            course_id,
            selected_employees,
            learning_start_date,
            target_completion_date,
            assignment_note,
            created_at,
            created_by
        )
        OUTPUT INSERTED.id
        VALUES (?, ?, ?, ?, ?, ?, GETDATE(), ?)
    """
    cursor.execute(
        query,
        (
            str(ld_id)[:7],
            course_id,
            str(selected_employees)[:255] if selected_employees else None,
            learning_starting_date,
            target_completion_date,
            assignment_note if assignment_note and assignment_note.strip() else None,
            str(created_by)[:7]
        )
    )
    row = cursor.fetchone()
    return int(row[0]) if row and row[0] else 0

def provision_assigned_course_enrollment(
    cursor,
    employee_id: str,
    course_id: int,
    created_by: Optional[str] = None,
    assignment_id: Optional[int] = None
) -> str:
    """
    Provisions a course in dbo.lms_course_enrollments with status 'Assigned'.
    This causes the Employee Course Library to render the [ Assigned ] button.
    """
    clean_emp = str(employee_id).strip()[:7]
    creator_ref = str(created_by).strip()[:7] if created_by and str(created_by).strip() else None
    lock_hint = " WITH (UPDLOCK, HOLDLOCK)" if is_sql_server() else ""
    cursor.execute(f"""
        SELECT id, enrollment_code, status FROM dbo.lms_course_enrollments{lock_hint}
        WHERE LOWER(employee_id) = LOWER(?) AND course_id = ?
    """, (clean_emp, course_id))
    existing = cursor.fetchone()

    if existing:
        # If already exists and was not yet started, set to Assigned
        curr_status = existing[2]
        if curr_status in ('Assigned', 'available', 'Not Started'):
            cursor.execute("""
                UPDATE dbo.lms_course_enrollments
                SET status = 'Assigned',
                    updated_at = GETDATE(),
                    updated_by = ?
                WHERE id = ?
            """, (creator_ref, existing[0]))
        return existing[1]
    else:
        cursor.execute(f"SELECT COALESCE(MAX(id), 0) FROM dbo.lms_course_enrollments{lock_hint}")
        res = cursor.fetchone()
        next_num = (res[0] if res and res[0] else 0) + 1
        code = f"ENR-2026-{next_num:04d}"
        cursor.execute("""
            INSERT INTO dbo.lms_course_enrollments (
                enrollment_code, employee_id, course_id,
                status, video_status, hours_log, progress_percentage,
                created_at, created_by
            )
            VALUES (?, ?, ?, 'Assigned', 'ON TRACK', 0, 0.0, GETDATE(), ?)
        """, (code, clean_emp, course_id, creator_ref))
        return code

def get_assigned_courses(
    cursor,
    course_id: Optional[int] = None,
    employee_id: Optional[str] = None,
    search: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Fetches all course assignments made by L&D from dbo.lms_assign_course,
    expanding assigned employees and joining live enrollment progress.
    Excludes any unapproved 'Pending' or 'On Hold' requests.
    """
    from datetime import date

    query = """
        SELECT 
            ac.id AS assign_course_id,
            ac.course_id,
            c.course_name AS course_title,
            COALESCE(cp.ProviderName, 'Emergere Academy') AS provider_name,
            c.provider_id,
            c.EmailProviderId AS email_provider_id,
            c.course_email_id,
            cem.CourseEmail AS account_email,
            COALESCE(cc.CategoryName, 'General') AS category_name,
            c.duration_minutes AS duration,
            c.support_document AS course_url,
            ac.selected_employees,
            CONVERT(VARCHAR(10), ac.learning_start_date, 120) AS learning_starting_date,
            CONVERT(VARCHAR(10), ac.target_completion_date, 120) AS target_completion_date,
            ac.assignment_note,
            CONVERT(VARCHAR(19), ac.created_at, 120) AS created_at,
            ac.created_by,
            ac.ld_id
        FROM dbo.lms_assign_course ac
        JOIN dbo.lms_courses c ON ac.course_id = c.id
        LEFT JOIN dbo.CourseProviders cp ON c.provider_id = cp.ProviderId
        LEFT JOIN dbo.CourseEmails cem ON c.course_email_id = cem.CourseEmailId
        LEFT JOIN dbo.CourseCategories cc ON c.category_id = cc.CategoryId
        WHERE 1 = 1
    """
    params = []
    if course_id:
        query += " AND ac.course_id = ?"
        params.append(course_id)
    if search:
        query += " AND (LOWER(c.course_name) LIKE LOWER(?) OR LOWER(ac.selected_employees) LIKE LOWER(?))"
        term = f"%{search.strip()}%"
        params.extend([term, term])

    query += " ORDER BY ac.id DESC"
    cursor.execute(query, tuple(params))
    assignments = dictfetchall(cursor)

    from repositories.ld.course_enrollment_repository import get_approved_employees_for_course
    approved_cache = {}

    today = date.today()
    result = []
    for a in assignments:
        assign_id = a.get("assign_course_id")
        asn_code = f"ENR-2026-{assign_id:04d}"
        raw_emps = a.get("selected_employees") or ""
        emps = [e.strip() for e in raw_emps.split(",") if e.strip()]
        if not emps:
            continue

        cid = a["course_id"]
        ep_id = a.get("email_provider_id")
        cache_key = f"ep_{ep_id}" if ep_id else f"c_{cid}"
        if cache_key not in approved_cache:
            approved_cache[cache_key] = get_approved_employees_for_course(cursor, cid)
        course_learners = approved_cache[cache_key]

        for emp_code in emps:
            if employee_id and emp_code.upper() != employee_id.strip().upper():
                continue

            # Query matching live enrollment
            cursor.execute("""
                SELECT TOP 1
                    ce.id AS enrollment_id,
                    ce.enrollment_code,
                    ce.status,
                    CAST(COALESCE(ce.progress_percentage, 0.0) AS FLOAT) AS progress_percentage
                FROM dbo.lms_course_enrollments ce
                WHERE LOWER(ce.employee_id) = LOWER(?) AND ce.course_id = ?
                  AND ce.status NOT IN ('Pending', 'On Hold')
                ORDER BY ce.id DESC
            """, (emp_code, a["course_id"]))
            enr = cursor.fetchone()

            prog = float(enr[3]) if enr else 0.0
            learning_status = enr[2] if enr else "Assigned"
            enr_code = enr[1] if enr else f"ENR-2026-{assign_id:04d}"

            # Calculate overdue status
            target_date_str = a.get("target_completion_date")
            is_overdue = False
            if target_date_str and learning_status != "Completed" and prog < 100.0:
                try:
                    t_date = date.fromisoformat(target_date_str[:10])
                    if t_date < today:
                        is_overdue = True
                except Exception:
                    pass

            status_display = "Overdue" if is_overdue else learning_status

            result.append({
                "assign_course_id": assign_id,
                "assignment_id": asn_code,
                "assignment_code": asn_code,
                "enrollment_code": enr_code,
                "course_id": a["course_id"],
                "course_title": a["course_title"],
                "provider_name": a["provider_name"],
                "category_name": a["category_name"],
                "duration": a["duration"],
                "course_url": a.get("course_url"),
                "employee_id": emp_code,
                "employee_code": emp_code,
                "learning_starting_date": a["learning_starting_date"],
                "target_completion_date": a["target_completion_date"],
                "assignment_note": a["assignment_note"],
                "created_at": a["created_at"],
                "created_by": a["created_by"] or a.get("ld_id"),
                "creator_code": a["created_by"] or a.get("ld_id"),
                "learning_status": status_display,
                "is_overdue": is_overdue,
                "progress_percentage": prog,
                "selected_employees": a.get("selected_employees"),
                "email_provider_id": ep_id,
                "account_email": a.get("account_email") or "",
                "approved_employees": course_learners,
                "other_employees": course_learners
            })

    return result
