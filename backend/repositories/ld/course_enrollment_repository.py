"""
Course Enrollment Repository.
Executes parameterized SQL queries for dbo.lms_enrollment_requests,
dbo.lms_course_enrollments, and dbo.lms_courses.
"""

import datetime
from typing import List, Dict, Any, Optional
from database.connection import dictfetchall, dictfetchone, is_sql_server

STATIC_AVATAR_COLORS = [
    "#FF7FAE", "#5CDE8A", "#A87FFF", "#FFBC64", "#F97FFF"
]

def get_color_for_name(name: str) -> str:
    """Deterministically picks an avatar color from the static palette based on name."""
    if not name:
        return STATIC_AVATAR_COLORS[0]
    idx = sum(ord(c) for c in name) % len(STATIC_AVATAR_COLORS)
    return STATIC_AVATAR_COLORS[idx]

def get_initials_for_name(name: str) -> str:
    """Generates 2-letter uppercase initials from full name."""
    if not name:
        return "EM"
    parts = [p for p in name.strip().split() if p]
    if len(parts) >= 2:
        return f"{parts[0][0]}{parts[1][0]}".upper()
    return parts[0][:2].upper() if parts else "EM"

def generate_request_id(cursor) -> str:
    """Generates a unique Request ID with standard prefix ENR-YYYY-XXXX (e.g. ENR-2026-0005)."""
    year = datetime.datetime.now().year
    prefix = f"ENR-{year}-"
    cursor.execute("SELECT COALESCE(MAX(id), 0) FROM dbo.lms_enrollment_requests")
    res = cursor.fetchone()
    max_num = (res[0] if res and res[0] else 0) + 1
    return f"{prefix}{max_num:04d}"

def insert_enrollment(
    cursor,
    request_id: str,
    course_id: int,
    employee_id: str,
    employee_name: str,
    employee_email: str,
    employee_role: Optional[str] = None,
    created_by: str = "SYSTEM"
) -> int:
    """Inserts a new enrollment request into dbo.lms_enrollment_requests and provisions/syncs dbo.lms_course_enrollments to Pending."""
    clean_emp = str(employee_id).strip()[:7]

    # ENR-YYYY-022: Prevent duplicate inserts on rapid concurrent clicks
    lock_hint = " WITH (UPDLOCK, HOLDLOCK)" if is_sql_server() else ""
    cursor.execute(f"""
        SELECT TOP 1 id FROM dbo.lms_enrollment_requests{lock_hint}
        WHERE LOWER(employee_id) = LOWER(?) AND course_id = ? AND status IN ('Pending', 'Approved', 'On Hold')
    """, (clean_emp, course_id))
    existing_active = cursor.fetchone()
    if existing_active:
        return int(existing_active[0])

    query = """
        INSERT INTO dbo.lms_enrollment_requests (
            request_code, employee_id, course_id, status, created_at, created_by
        )
        VALUES (?, ?, ?, 'Pending', GETDATE(), ?)
    """
    cursor.execute(
        query,
        (
            request_id.strip()[:20],
            clean_emp,
            course_id,
            (created_by or employee_id)[:7]
        )
    )
    cursor.execute("SELECT @@IDENTITY AS id")
    row = cursor.fetchone()
    req_pk = int(row[0]) if row and row[0] else 0

    # Also synchronize dbo.lms_course_enrollments to status 'Pending'
    clean_emp = str(employee_id).strip()[:7]
    cursor.execute(f"""
        SELECT id FROM dbo.lms_course_enrollments{lock_hint}
        WHERE LOWER(employee_id) = LOWER(?) AND course_id = ?
    """, (clean_emp, course_id))
    existing_enr = cursor.fetchone()
    if existing_enr:
        cursor.execute("""
            UPDATE dbo.lms_course_enrollments
            SET status = 'Pending',
                last_accessed = CAST(GETDATE() AS DATE),
                updated_at = GETDATE(),
                updated_by = ?
            WHERE id = ?
        """, (clean_emp, existing_enr[0]))
    else:
        cursor.execute(f"SELECT COALESCE(MAX(id), 0) FROM dbo.lms_course_enrollments{lock_hint}")
        res = cursor.fetchone()
        next_num = (res[0] if res and res[0] else 0) + 1
        code = f"ENR-2026-{next_num:04d}"
        cursor.execute("""
            INSERT INTO dbo.lms_course_enrollments (
                enrollment_code, employee_id, course_id, status, video_status,
                hours_log, last_accessed, progress_percentage, created_at, created_by
            )
            VALUES (?, ?, ?, 'Pending', 'ON TRACK', 0, CAST(GETDATE() AS DATE), 0.0, GETDATE(), ?)
        """, (code, clean_emp, course_id, clean_emp))

    return req_pk

def get_enrollment_by_request_id(cursor, request_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves an enrollment request by its request code."""
    query = """
        SELECT
            er.id AS enrollment_id,
            er.request_code AS request_id,
            er.course_id,
            c.course_name AS course_title,
            COALESCE(cp.ProviderName, 'Emergere Academy') AS provider_name,
            er.employee_id,
            er.status AS action_status,
            er.onhold_reason,
            er.on_hold_date,
            CONVERT(VARCHAR(19), er.created_at, 120) AS requested_on,
            CONVERT(VARCHAR(19), er.created_at, 120) AS created_at,
            CONVERT(VARCHAR(19), er.updated_at, 120) AS updated_at
        FROM dbo.lms_enrollment_requests er
        JOIN dbo.lms_courses c ON er.course_id = c.id
        LEFT JOIN dbo.CourseProviders cp ON c.provider_id = cp.ProviderId
        WHERE er.request_code = ?
    """
    cursor.execute(query, (request_id.strip(),))
    return dictfetchone(cursor)

def get_approved_employees_for_course(
    cursor,
    course_id: int,
    exclude_employee_id: Optional[str] = None,
    emp_map: Optional[Dict[str, Any]] = None
) -> List[Dict[str, Any]]:
    """
    Returns employees currently enrolled or assigned under this course's EmailProviderId / Provider
    (Model B: Active 4-slot concurrency positions, excluding Completed/Pending/On Hold).
    """
    from services.common.auth_service import employee_service

    # 1. Resolve course's EmailProviderId and provider_id
    cursor.execute("""
        SELECT c.EmailProviderId, c.provider_id, c.course_email_id
        FROM dbo.lms_courses c
        WHERE c.id = ?
    """, (course_id,))
    c_row = cursor.fetchone()

    ep_id = c_row[0] if c_row else None
    p_id = c_row[1] if c_row else None

    # 2. Query active learners across all courses sharing this EmailProviderId (or provider_id fallback)
    if ep_id is not None:
        query = """
            SELECT DISTINCT ce.employee_id, ce.status, ce.progress_percentage
            FROM dbo.lms_course_enrollments ce
            JOIN dbo.lms_courses c ON c.id = ce.course_id
            WHERE c.EmailProviderId = ?
              AND ce.status IN ('Assigned', 'Not Started', 'In Progress')
            ORDER BY ce.employee_id
        """
        cursor.execute(query, (ep_id,))
    elif p_id is not None:
        query = """
            SELECT DISTINCT ce.employee_id, ce.status, ce.progress_percentage
            FROM dbo.lms_course_enrollments ce
            JOIN dbo.lms_courses c ON c.id = ce.course_id
            WHERE c.provider_id = ?
              AND ce.status IN ('Assigned', 'Not Started', 'In Progress')
            ORDER BY ce.employee_id
        """
        cursor.execute(query, (p_id,))
    else:
        query = """
            SELECT DISTINCT ce.employee_id, ce.status, ce.progress_percentage
            FROM dbo.lms_course_enrollments ce
            WHERE ce.course_id = ?
              AND ce.status IN ('Assigned', 'Not Started', 'In Progress')
            ORDER BY ce.employee_id
        """
        cursor.execute(query, (course_id,))

    rows = dictfetchall(cursor)
    result = []
    seen = set()
    clean_exclude = (exclude_employee_id or "").strip().upper()
    for r in rows:
        eid = (r.get("employee_id") or "").strip()
        if not eid or eid.upper() in seen:
            continue
        if clean_exclude and eid.upper() == clean_exclude:
            continue
        seen.add(eid.upper())
        if emp_map is not None:
            emp = emp_map.get(eid.upper()) or {}
        else:
            emp = employee_service.get_employee_by_id(eid) or {}
        name = emp.get("name") or emp.get("full_name") or eid
        role = emp.get("job_title") or emp.get("role") or "Member"
        dept = emp.get("department") or emp.get("domain") or "Engineering"
        result.append({
            "name": name,
            "empId": eid,
            "role": role,
            "department": dept,
            "initials": get_initials_for_name(name),
            "avatarBg": get_color_for_name(name),
            "isRequestedBy": False,
            "status": r.get("status") or "Approved"
        })
    return result[:4]

def get_all_enrollments(
    cursor,
    course_id: Optional[int] = None,
    status: Optional[str] = None,
    search: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Fetches all enrollment requests joined with course information and actual learning status."""
    from services.common.auth_service import employee_service
    query = """
        SELECT
            er.id AS enrollment_id,
            er.request_code AS request_id,
            er.course_id,
            c.course_name AS course_title,
            COALESCE(cp.ProviderName, 'Emergere Academy') AS provider_name,
            c.provider_id,
            c.EmailProviderId AS email_provider_id,
            c.course_email_id,
            cem.CourseEmail AS account_email,
            COALESCE(cc.CategoryName, 'General') AS category_name,
            er.employee_id,
            er.status AS action_status,
            er.onhold_reason,
            er.on_hold_date,
            CONVERT(VARCHAR(19), er.created_at, 120) AS requested_on,
            CONVERT(VARCHAR(19), er.created_at, 120) AS created_at,
            ce.status AS enrollment_learning_status,
            CAST(COALESCE(ce.progress_percentage, 0.0) AS FLOAT) AS progress_percentage,
            ce.enrollment_code
        FROM dbo.lms_enrollment_requests er
        JOIN dbo.lms_courses c ON er.course_id = c.id
        LEFT JOIN dbo.CourseProviders cp ON c.provider_id = cp.ProviderId
        LEFT JOIN dbo.CourseEmails cem ON c.course_email_id = cem.CourseEmailId
        LEFT JOIN dbo.CourseCategories cc ON c.category_id = cc.CategoryId
        LEFT JOIN dbo.lms_course_enrollments ce ON er.course_id = ce.course_id AND LOWER(er.employee_id) = LOWER(ce.employee_id)
        WHERE 1=1
    """
    params = []
    if course_id:
        query += " AND er.course_id = ?"
        params.append(course_id)
    if status and status != "All Status":
        query += " AND er.status = ?"
        params.append(status)
    if search:
        query += " AND (er.request_code LIKE ? OR er.employee_id LIKE ? OR c.course_name LIKE ?)"
        term = f"%{search}%"
        params.extend([term, term, term])

    query += " ORDER BY er.id DESC"
    cursor.execute(query, tuple(params))
    records = dictfetchall(cursor)

    all_emps = employee_service.get_all_employees()
    emp_map = {str(e.get("employee_id", "")).strip().upper(): e for e in all_emps if e.get("employee_id")}
    approved_cache = {}

    formatted = []
    for r in records:
        eid = r.get("employee_id")
        if not eid:
            continue
        emp = emp_map.get(eid.strip().upper()) or employee_service.get_employee_by_id(eid) or {}
        emp_name = emp.get("name") or emp.get("full_name") or eid
        emp_role = emp.get("job_title") or emp.get("role") or "Employee"
        emp_email = emp.get("work_email") or emp.get("email") or ""
        emp_dept = emp.get("department") or "Engineering"

        cid = r.get("course_id")
        ep_id = r.get("email_provider_id")
        cache_key = f"ep_{ep_id}" if ep_id else f"c_{cid}"
        if cache_key not in approved_cache:
            approved_cache[cache_key] = get_approved_employees_for_course(cursor, cid, emp_map=emp_map)
        approved_list = approved_cache[cache_key]
        active_count = len(approved_list)

        # Other employees strictly excluding the requesting applicant
        other_list = [e for e in approved_list if (e.get("empId") or "").strip().upper() != eid.strip().upper()]

        is_full = active_count >= 4
        slots_left = max(0, 4 - active_count)
        active_users_str = f"{min(4, active_count)}/4"
        active_users_status = "(Full)" if is_full else f"({slots_left} Available)"

        req_on_str = str(r.get("requested_on") or "")
        if len(req_on_str) >= 10:
            try:
                dt = datetime.datetime.fromisoformat(req_on_str[:19])
                req_on_str = dt.strftime("%d %b %Y")
            except Exception:
                pass

        act_status = r.get("action_status")
        enr_status = r.get("enrollment_learning_status")
        prog_val = float(r.get("progress_percentage") or 0.0)

        if act_status == "Approved":
            learning_st = enr_status if (enr_status and enr_status not in ("Assigned", "Pending")) else ("Completed" if prog_val >= 100 else ("In Progress" if prog_val > 0 else "Not Started"))
        elif act_status == "On Hold":
            learning_st = "On Hold"
        else:
            learning_st = "Pending"

        formatted.append({
            "enrollment_id": r.get("enrollment_id"),
            "requestId": r.get("request_id"),
            "enrollmentCode": r.get("enrollment_code") or r.get("request_id"),
            "courseId": cid,
            "course": r.get("course_title") or "Course",
            "provider": r.get("provider_name") or "Udemy",
            "provider_id": r.get("provider_id"),
            "email_provider_id": ep_id,
            "course_email_id": r.get("course_email_id"),
            "accountEmail": r.get("account_email") or "",
            "account_email": r.get("account_email") or "",
            "requestedOn": req_on_str,
            "status": act_status,
            "progress": prog_val,
            "learningStatus": learning_st,
            "onHoldDate": str(r.get("on_hold_date")) if r.get("on_hold_date") else None,
            "onHoldReason": r.get("onhold_reason"),
            "approvedDate": None,
            "approvedBy": None,
            "activeUsers": active_users_str,
            "activeUsersStatus": active_users_status,
            "isFull": is_full,
            "employee": {
                "name": emp_name,
                "empId": eid,
                "role": emp_role,
                "email": emp_email,
                "department": emp_dept,
                "domain": emp_dept,
                "initials": get_initials_for_name(emp_name),
                "avatarBg": get_color_for_name(emp_name),
            },
            "otherEmployees": other_list,
            "approvedEmployees": approved_list[:4]
        })

    return formatted

def get_employee_enrollment_status_map(
    cursor,
    employee_id: str,
    candidate_profile_ids: Optional[List[int]] = None,
    with_progress: bool = False
):
    """
    Returns a mapping of { course_id: action_status } (and optionally progress_map) for the employee.
    Used by CourseLibrary to mark cards as 'available', 'pending', 'assigned', 'in-progress', or 'completed'.
    """
    status_map = {}
    progress_map = {}
    completed_map = {}
    clean_emp = str(employee_id).strip()

    # 1. Check enrollment requests (Pending, On Hold, Rejected)
    query_req = """
        SELECT course_id, status
        FROM dbo.lms_enrollment_requests
        WHERE LOWER(employee_id) = LOWER(?)
        ORDER BY id ASC
    """
    cursor.execute(query_req, (clean_emp,))
    for r in dictfetchall(cursor):
        cid = r.get("course_id")
        if cid:
            st = r.get("status") or "Pending"
            if st == "Approved":
                status_map[cid] = "Not Started"
            else:
                status_map[cid] = st

    # 2. Check active enrollments in dbo.lms_course_enrollments
    query_enr = """
        SELECT course_id, status, video_status, CAST(progress_percentage AS FLOAT) AS progress_percentage, hours_log
        FROM dbo.lms_course_enrollments
        WHERE LOWER(employee_id) = LOWER(?)
    """
    cursor.execute(query_enr, (clean_emp,))
    for r in dictfetchall(cursor):
        cid = r.get("course_id")
        if not cid:
            continue
        prog = float(r.get("progress_percentage") or 0.0)
        progress_map[cid] = prog
        completed_map[cid] = int(r.get("hours_log") or 0)
        st = (r.get("status") or "").strip()

        if prog >= 100.0 or st.lower() == "completed":
            status_map[cid] = "Completed"
        elif prog > 0.0 or st.lower() == "in progress":
            status_map[cid] = "In Progress"
        elif st.lower() in ("not started", "enrolled"):
            status_map[cid] = "Not Started"
        elif st.lower() == "pending":
            status_map[cid] = "Pending"
        elif st.lower() == "on hold":
            status_map[cid] = "On Hold"
        elif st.lower() == "assigned":
            # Preserve active Pending or On Hold request status so employee sees 'Requested'
            if status_map.get(cid) not in ("Pending", "On Hold"):
                status_map[cid] = "Assigned"
        else:
            if status_map.get(cid) not in ("Pending", "On Hold"):
                status_map[cid] = st

    if with_progress:
        return status_map, progress_map, completed_map
    return status_map

def update_status_to_approved(
    cursor,
    request_id: str,
    approved_by: Optional[str] = None
) -> bool:
    """Updates request to Approved in dbo.lms_enrollment_requests and provisions dbo.lms_course_enrollments."""
    actor = str(approved_by or "").strip()[:7] or None
    cursor.execute("""
        UPDATE dbo.lms_enrollment_requests
        SET status = 'Approved', updated_at = GETDATE(), updated_by = ?
        WHERE request_code = ?
    """, (actor, request_id))

    # Fetch request details
    cursor.execute("SELECT employee_id, course_id FROM dbo.lms_enrollment_requests WHERE request_code = ?", (request_id,))
    row = cursor.fetchone()
    if row:
        eid, cid = row[0], row[1]
        sync_assigned_course(cursor, eid, cid, assigned_by=actor)
    return True

def update_status_to_on_hold(
    cursor,
    request_id: str,
    reason: str,
    updated_by: Optional[str] = None
) -> bool:
    """Updates request to On Hold in dbo.lms_enrollment_requests and dbo.lms_course_enrollments."""
    clean_reason = str(reason).strip()[:250] if reason else None
    actor = str(updated_by or "").strip()[:7] or None
    cursor.execute("""
        UPDATE dbo.lms_enrollment_requests
        SET status = 'On Hold', onhold_reason = ?, on_hold_date = CAST(GETDATE() AS DATE), updated_at = GETDATE(), updated_by = ?
        WHERE request_code = ?
    """, (clean_reason, actor, request_id))

    cursor.execute("SELECT employee_id, course_id FROM dbo.lms_enrollment_requests WHERE request_code = ?", (request_id,))
    row = cursor.fetchone()
    if row:
        eid, cid = row[0], row[1]
        cursor.execute("""
            UPDATE dbo.lms_course_enrollments
            SET status = 'On Hold',
                updated_at = GETDATE(),
                updated_by = ?
            WHERE LOWER(employee_id) = LOWER(?) AND course_id = ? AND status IN ('Assigned', 'Pending')
        """, ((updated_by or "SYSTEM")[:7], str(eid).strip()[:7], cid))

    return cursor.rowcount > 0

def sync_assigned_course(cursor, employee_id: str, course_id: int, assigned_by: Optional[str] = None):
    """Provisions or updates an enrolled course in dbo.lms_course_enrollments."""
    clean_emp = str(employee_id).strip()
    cursor.execute("""
        SELECT id FROM dbo.lms_course_enrollments
        WHERE LOWER(employee_id) = LOWER(?) AND course_id = ?
    """, (clean_emp, course_id))
    existing = cursor.fetchone()

    if existing:
        cursor.execute("""
            UPDATE dbo.lms_course_enrollments
            SET status = 'Not Started',
                last_accessed = CAST(GETDATE() AS DATE),
                updated_at = GETDATE(),
                updated_by = ?
            WHERE id = ?
        """, ((assigned_by or "SYSTEM")[:7], existing[0]))
    else:
        cursor.execute("SELECT COALESCE(MAX(id), 0) FROM dbo.lms_course_enrollments")
        res = cursor.fetchone()
        next_num = (res[0] if res and res[0] else 0) + 1
        code = f"ENR-2026-{next_num:04d}"
        cursor.execute("""
            INSERT INTO dbo.lms_course_enrollments (
                enrollment_code, employee_id, course_id, status, video_status,
                hours_log, last_accessed, progress_percentage, created_at, created_by
            )
            VALUES (?, ?, ?, 'Not Started', 'ON TRACK', 0, CAST(GETDATE() AS DATE), 0.0, GETDATE(), ?)
        """, (code, clean_emp, course_id, (assigned_by or "SYSTEM")[:7]))

def send_notification(
    cursor,
    employee_id: str,
    title: str,
    message: str,
    notif_type: str = "COURSE_ENROLLMENT_REQUEST",
    reference_id: Optional[int] = None,
    created_by_profile_id: Optional[int] = None
):
    """Creates a notification record in dbo.lms_notifications."""
    try:
        cursor.execute("""
            INSERT INTO dbo.lms_notifications (employee_id, message, is_read, created_at, created_by)
            VALUES (?, ?, 0, GETDATE(), ?)
        """, (str(employee_id).strip()[:7], message.strip(), str(created_by_profile_id or "SYSTEM")[:7]))
        from services.common.email_service import email_service
        email_service.enqueue_notification_email(
            employee_id=str(employee_id).strip()[:7],
            message=message.strip(),
            reference_id=str(reference_id) if reference_id else None,
            reference_type=notif_type,
        )
    except Exception as e:
        print(f"[Notification] Warning: Could not insert notification into dbo.lms_notifications: {e}")

def get_team_course_progress(
    cursor,
    employee_ids: Optional[List[str]] = None
) -> List[Dict[str, Any]]:
    """Retrieves live course enrollments and progress from dbo.lms_course_enrollments joined with dbo.lms_courses."""
    query = """
        SELECT
            ce.id,
            ce.enrollment_code,
            ce.employee_id,
            ce.course_id,
            ce.status,
            ce.video_status,
            COALESCE(ce.hours_log, 0) AS hours_log,
            CAST(COALESCE(ce.progress_percentage, 0.0) AS FLOAT) AS progress_percentage,
            CONVERT(VARCHAR(10), ce.created_at, 120) AS raw_date,
            CONVERT(VARCHAR(19), ce.created_at, 120) AS created_at,
            c.course_name,
            COALESCE(cp.ProviderName, 'Emergere Academy') AS provider,
            COALESCE(cc.CategoryName, 'General') AS category,
            COALESCE(c.duration_minutes, 150) AS duration,
            COALESCE(wll.active_days_week, 0) AS active_days_week,
            COALESCE(wll.weekly_video_min, 0) AS weekly_video_min,
            COALESCE(wll.weekly_practice_min, 0) AS weekly_practice_min
        FROM dbo.lms_course_enrollments ce
        JOIN dbo.lms_courses c ON ce.course_id = c.id
        LEFT JOIN dbo.CourseProviders cp ON c.provider_id = cp.ProviderId
        LEFT JOIN dbo.CourseCategories cc ON c.category_id = cc.CategoryId
        LEFT JOIN (
            SELECT
                employee_id,
                course_id,
                COUNT(DISTINCT CAST(created_at AS DATE)) AS active_days_week,
                COALESCE(SUM(video_duration_minutes), 0) AS weekly_video_min,
                COALESCE(SUM(practice_duration_minutes), 0) AS weekly_practice_min
            FROM dbo.lms_learning_logs
            WHERE created_at >= DATEADD(day, -7, GETDATE())
            GROUP BY employee_id, course_id
        ) wll ON LOWER(ce.employee_id) = LOWER(wll.employee_id) AND ce.course_id = wll.course_id
    """
    params = []
    if employee_ids:
        placeholders = ",".join("?" for _ in employee_ids)
        query += f" WHERE LOWER(ce.employee_id) IN ({placeholders}) AND ce.status IN ('Not Started', 'In Progress', 'Completed')"
        params.extend([e.strip().lower() for e in employee_ids])
    else:
        query += " WHERE ce.status IN ('Not Started', 'In Progress', 'Completed')"

    query += " ORDER BY ce.created_at DESC, ce.id DESC"
    cursor.execute(query, tuple(params))
    return dictfetchall(cursor)

def get_employee_overall_progress_data(
    cursor,
    employee_id: str
) -> Dict[str, Any]:
    """
    Calculates overall course completion percentage and retrieves up to 3 most recently learned courses
    for an employee from dbo.lms_course_enrollments, dbo.lms_courses, and dbo.lms_learning_logs.
    """
    clean_emp = str(employee_id).strip()

    # 1. Query all enrolled courses with latest learning log timestamp
    query = """
        SELECT
            ce.course_id,
            COALESCE(c.course_name, 'Course Learning') AS course_name,
            COALESCE(cp.ProviderName, 'Udemy') AS provider,
            COALESCE(cc.CategoryName, 'General') AS category,
            ce.status,
            CAST(COALESCE(ce.progress_percentage, 0.0) AS FLOAT) AS progress_percentage,
            CONVERT(VARCHAR(10), ce.last_accessed, 120) AS last_accessed,
            CONVERT(VARCHAR(19), MAX(ll.created_at), 120) AS last_log_date
        FROM dbo.lms_course_enrollments ce
        JOIN dbo.lms_courses c ON ce.course_id = c.id
        LEFT JOIN dbo.CourseProviders cp ON c.provider_id = cp.ProviderId
        LEFT JOIN dbo.CourseCategories cc ON c.category_id = cc.CategoryId
        LEFT JOIN dbo.lms_learning_logs ll
            ON ce.course_id = ll.course_id AND LOWER(ce.employee_id) = LOWER(ll.employee_id)
        WHERE LOWER(ce.employee_id) = LOWER(?)
        GROUP BY ce.course_id, c.course_name, cp.ProviderName, cc.CategoryName, ce.status, ce.progress_percentage, ce.last_accessed
    """
    cursor.execute(query, (clean_emp,))
    all_enrolled = dictfetchall(cursor)

    total_enrolled = len(all_enrolled)
    if total_enrolled > 0:
        overall_progress = int(round(sum(c.get("progress_percentage", 0.0) for c in all_enrolled) / total_enrolled))
    else:
        overall_progress = 0

    # Completed courses: status == 'Completed' or progress == 100%
    completed_courses = [
        c for c in all_enrolled
        if str(c.get("status", "")).strip().lower() == "completed" or float(c.get("progress_percentage", 0.0)) >= 100.0
    ]
    completed_courses_count = len(completed_courses)

    # Active courses: strictly 'In Progress' / 'Active' with progress < 100%
    active_courses = [
        c for c in all_enrolled
        if str(c.get("status", "")).strip().lower() in ("in progress", "active") and float(c.get("progress_percentage", 0.0)) < 100.0
    ]
    active_courses_count = len(active_courses)

    # Total and Active Certifications from dbo.lms_employee_certificates
    import datetime
    today = datetime.date.today()

    try:
        # Total certifications done by the employee (all professional certification, including expired)
        cursor.execute("""
            SELECT COUNT(*) FROM dbo.lms_employee_certificates
            WHERE LOWER(employee_id) = LOWER(?)
              AND (certificate_type LIKE '%Professional%' OR certificate_type = 'Professional Certification')
        """, (clean_emp,))
        row = cursor.fetchone()
        total_certs_count = int(row[0]) if row and row[0] is not None else 0
    except Exception:
        total_certs_count = 0

    try:
        # Active certifications within expiry date (expiry_date IS NULL or expiry_date >= today)
        cursor.execute("""
            SELECT COUNT(*) FROM dbo.lms_employee_certificates
            WHERE LOWER(employee_id) = LOWER(?)
              AND (certificate_type LIKE '%Professional%' OR certificate_type = 'Professional Certification')
              AND (expiry_date IS NULL OR expiry_date >= ?)
        """, (clean_emp, today))
        row = cursor.fetchone()
        active_certs_count = int(row[0]) if row and row[0] is not None else 0
    except Exception:
        active_certs_count = 0

    # Sort courses: prioritize courses with actual learning logs, then last accessed date
    courses_sorted = sorted(
        all_enrolled,
        key=lambda c: (
            1 if c.get("last_log_date") else 0,
            str(c.get("last_log_date") or c.get("last_accessed") or "1970-01-01")
        ),
        reverse=True
    )

    displayed = []
    for c in courses_sorted[:3]:
        raw_cat = str(c.get("category") or "Technical Skills").strip()
        cat_formatted = raw_cat.title() if raw_cat.isupper() else raw_cat
        if cat_formatted.lower() in ("devops", "cloud"):
            cat_formatted = "Cloud & DevOps"
        elif cat_formatted.lower() == "data science":
            cat_formatted = "Technical Skills"
        elif cat_formatted.lower() == "security":
            cat_formatted = "Cybersecurity"

        displayed.append({
            "id": c.get("course_id"),
            "name": c.get("course_name"),
            "provider": c.get("provider") or "Udemy",
            "category": cat_formatted,
            "progress": int(round(c.get("progress_percentage", 0.0))),
            "status": c.get("status")
        })

    # Weekly Learning Hours (Monday to Sunday of current calendar week)
    now_dt = datetime.datetime.now()
    monday_start = (now_dt - datetime.timedelta(days=now_dt.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    sunday_end = monday_start + datetime.timedelta(days=6)
    monday_str = monday_start.strftime("%Y-%m-%d %H:%M:%S")
    week_period_str = f"{monday_start.strftime('%d %b')} - {sunday_end.strftime('%d %b')}"

    try:
        cursor.execute("""
            SELECT COALESCE(SUM(video_duration_minutes + practice_duration_minutes), 0)
            FROM dbo.lms_learning_logs
            WHERE LOWER(employee_id) = LOWER(?)
              AND created_at >= ?
        """, (clean_emp, monday_str))
        wk_mins = cursor.fetchone()[0] or 0
        weekly_hours = round(wk_mins / 60.0, 1)
    except Exception:
        weekly_hours = 0.0

    try:
        cursor.execute("""
            SELECT COALESCE(SUM(video_duration_minutes + practice_duration_minutes), 0)
            FROM dbo.lms_learning_logs
            WHERE LOWER(employee_id) = LOWER(?)
        """, (clean_emp,))
        at_mins = cursor.fetchone()[0] or 0
        all_time_hours = round(at_mins / 60.0, 1)
    except Exception:
        all_time_hours = 0.0

    # Mandatory assigned courses for employee (ENR-YYYY-025)
    mandatory_course = None
    try:
        cursor.execute("""
            SELECT TOP 1
                c.id AS course_id,
                c.course_name,
                COALESCE(cp.ProviderName, 'Emergere Academy') AS provider,
                CONVERT(VARCHAR(10), ac.target_completion_date, 120) AS target_completion_date,
                CONVERT(VARCHAR(10), ac.learning_start_date, 120) AS learning_starting_date,
                DATEDIFF(day, CAST(GETDATE() AS DATE), ac.target_completion_date) AS days_remaining
            FROM dbo.lms_assign_course ac
            JOIN dbo.lms_courses c ON ac.course_id = c.id
            LEFT JOIN dbo.CourseProviders cp ON c.provider_id = cp.ProviderId
            LEFT JOIN dbo.lms_course_enrollments ce
                ON ce.course_id = ac.course_id AND LOWER(ce.employee_id) = LOWER(?)
            WHERE ac.target_completion_date IS NOT NULL
              AND (ce.status IS NULL OR (ce.status != 'Completed' AND COALESCE(ce.progress_percentage, 0) < 100))
              AND (CHARINDEX(?, ac.selected_employees) > 0 OR ac.selected_employees IS NULL OR ac.selected_employees = '')
            ORDER BY ac.target_completion_date ASC
        """, (clean_emp, clean_emp))
        m_row = cursor.fetchone()
        if m_row:
            mandatory_course = {
                "course_id": m_row[0],
                "course_name": m_row[1],
                "provider": m_row[2] or "Udemy",
                "target_completion_date": str(m_row[3])[:10] if m_row[3] else None,
                "learning_starting_date": str(m_row[4])[:10] if m_row[4] else None,
                "days_remaining": int(m_row[5]) if m_row[5] is not None else None,
                "is_mandatory": True
            }
    except Exception as e_mand:
        print(f"[get_employee_overall_progress_data] Mandatory course notice: {e_mand}")

    return {
        "overall_progress": overall_progress,
        "active_courses_count": active_courses_count,
        "completed_courses_count": completed_courses_count,
        "total_certifications_count": total_certs_count,
        "active_certifications_count": active_certs_count,
        "total_enrolled_count": total_enrolled,
        "displayed_courses": displayed,
        "weekly_learning_hours": f"{weekly_hours}h",
        "all_time_learning_hours": f"{all_time_hours}h",
        "week_period": week_period_str,
        "mandatory_course": mandatory_course
    }

def get_company_learning_completion_metrics(cursor) -> Dict[str, Any]:
    """
    Computes company-wide learning completion statistics across all employee course enrollments:
    - Overall Progress: average progress percentage across all enrollments
    - Completed: count of enrollments where status is 'Completed' or progress >= 100
    - In Progress: count of enrollments where status is 'In Progress' / 'Active' or (0 < progress < 100)
    - Not Started: count of enrollments where progress == 0
    - Active Learners: distinct employees with at least 1 course in progress
    - Total Enrolled Employees: distinct employees with any enrollment
    - Trend: month-over-month learning progress delta from dbo.lms_learning_logs
    """
    query = """
        SELECT
            COUNT(*) AS total_enrollments,
            COUNT(DISTINCT employee_id) AS total_enrolled_employees,
            SUM(CASE WHEN LOWER(status) = 'completed' OR progress_percentage >= 100 THEN 1 ELSE 0 END) AS completed_count,
            SUM(CASE WHEN (LOWER(status) IN ('in progress', 'active') OR (progress_percentage > 0 AND progress_percentage < 100)) AND LOWER(status) != 'completed' AND progress_percentage < 100 THEN 1 ELSE 0 END) AS in_progress_count,
            SUM(CASE WHEN (progress_percentage = 0 OR progress_percentage IS NULL) AND LOWER(status) NOT IN ('completed', 'in progress', 'active') THEN 1 ELSE 0 END) AS not_started_count,
            AVG(CAST(progress_percentage AS FLOAT)) AS avg_progress
        FROM dbo.lms_course_enrollments
    """
    cursor.execute(query)
    stats = dictfetchone(cursor) or {}

    total_enrolled_employees = int(stats.get("total_enrolled_employees") or 0)

    # Active learners: distinct employees with >= 1 course in progress
    cursor.execute("""
        SELECT COUNT(DISTINCT employee_id)
        FROM dbo.lms_course_enrollments
        WHERE (LOWER(status) IN ('in progress', 'active') OR (progress_percentage > 0 AND progress_percentage < 100))
          AND LOWER(status) != 'completed'
          AND (progress_percentage IS NULL OR progress_percentage < 100)
    """)
    act_row = cursor.fetchone()
    active_learners = int(act_row[0]) if act_row and act_row[0] is not None else 0

    # Dynamic Month-over-Month trend calculation for LMS course enrollments:
    # Compares Current Calendar Month vs. Prior Calendar Month
    trend_val = 0
    trend_dir = "neutral"
    try:
        cursor.execute("""
            SELECT
                SUM(CASE WHEN YEAR(created_at) = YEAR(GETDATE()) AND MONTH(created_at) = MONTH(GETDATE()) THEN 1 ELSE 0 END) AS cur_month_enr,
                SUM(CASE
                    WHEN (MONTH(GETDATE()) = 1 AND YEAR(created_at) = YEAR(GETDATE()) - 1 AND MONTH(created_at) = 12)
                      OR (MONTH(GETDATE()) > 1 AND YEAR(created_at) = YEAR(GETDATE()) AND MONTH(created_at) = MONTH(GETDATE()) - 1)
                    THEN 1 ELSE 0 END) AS prior_month_enr
            FROM dbo.lms_course_enrollments
        """)
        trend_row = dictfetchone(cursor) or {}
        cur_enr = int(trend_row.get("cur_month_enr") or 0)
        prior_enr = int(trend_row.get("prior_month_enr") or 0)

        if prior_enr > 0:
            diff = round(((cur_enr - prior_enr) / float(prior_enr)) * 100)
            if diff > 0:
                trend_val = abs(diff)
                trend_dir = "up"
            elif diff < 0:
                trend_val = abs(diff)
                trend_dir = "down"
            else:
                trend_val = 0
                trend_dir = "neutral"
        elif cur_enr > 0:
            trend_val = 100
            trend_dir = "up"
        else:
            trend_val = 0
            trend_dir = "neutral"
    except Exception:
        trend_val = 0
        trend_dir = "neutral"

    return {
        "total_enrollments": int(stats.get("total_enrollments") or 0),
        "total_enrolled_employees": total_enrolled_employees,
        "completed_count": int(stats.get("completed_count") or 0),
        "in_progress_count": int(stats.get("in_progress_count") or 0),
        "not_started_count": int(stats.get("not_started_count") or 0),
        "avg_progress": float(stats.get("avg_progress") or 0.0),
        "active_learners": active_learners,
        "trend_pct": trend_val,
        "trend_direction": trend_dir
    }

def unenroll_course(cursor, employee_id: str, course_id: int) -> Dict[str, Any]:
    """
    ENR-YYYY-021: Disallow unenrollment once employee completes >50% course content.
    Returns status dictionary indicating whether drop was permitted or blocked.
    """
    clean_emp = str(employee_id).strip()[:7]
    cursor.execute("""
        SELECT progress_percentage, status FROM dbo.lms_course_enrollments
        WHERE LOWER(employee_id) = LOWER(?) AND course_id = ?
    """, (clean_emp, course_id))
    row = cursor.fetchone()

    if not row:
        return {
            "success": False,
            "allowed": False,
            "error": "No enrollment record found for this course and employee."
        }

    progress = float(row[0] or 0.0)
    current_status = str(row[1] or "In Progress")

    if progress > 50.0:
        return {
            "success": False,
            "allowed": False,
            "progress": progress,
            "error": f"Unenrollment disabled: Course progress is {progress:.1f}%, which exceeds the 50% training audit threshold. Corporate training records must be maintained once past 50% completion."
        }

    # Drop course enrollment
    cursor.execute("""
        UPDATE dbo.lms_course_enrollments
        SET status = 'Dropped',
            updated_at = GETDATE(),
            updated_by = ?
        WHERE LOWER(employee_id) = LOWER(?) AND course_id = ?
    """, (clean_emp, clean_emp, course_id))

    cursor.execute("""
        UPDATE dbo.lms_enrollment_requests
        SET status = 'Dropped',
            updated_at = GETDATE()
        WHERE LOWER(employee_id) = LOWER(?) AND course_id = ? AND status IN ('Pending', 'Approved', 'On Hold')
    """, (clean_emp, course_id))

    return {
        "success": True,
        "allowed": True,
        "progress": progress,
        "status": "Dropped",
        "message": f"Successfully dropped course (progress: {progress:.1f}%)."
    }
