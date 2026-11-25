"""
Course Request Repository.
Data access layer for split course requests architecture:
- dbo.lms_course_requests (Master Request Information)
- dbo.lms_course_request_stages (Individual Milestone Workflow Stages: 1 to 5)
- dbo.lms_courses (Course catalog populated upon purchase)
- dbo.lms_hr_activity_feed (Activity log)
Pure parameterized SQL queries without transaction commits/rollbacks.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
from database.connection import dictfetchall, dictfetchone, is_sql_server
from repositories.common.course_metadata_repository import course_metadata_repository

def generate_next_request_code(cursor) -> str:
    """Generates the next sequential Request Code with pattern REQ-YYYY-XXXX (e.g. REQ-2026-0001)."""
    year = datetime.now().year
    lock_hint = " WITH (UPDLOCK, HOLDLOCK)" if is_sql_server() else ""
    cursor.execute(f"""
        SELECT TOP 1 request_code 
        FROM dbo.lms_course_requests{lock_hint}
        WHERE request_code LIKE ?
        ORDER BY id DESC
    """, (f"REQ-{year}-%",))
    row = cursor.fetchone()
    if row and row[0]:
        last_id = str(row[0])
        parts = last_id.split("-")
        if len(parts) == 3 and parts[2].isdigit():
            next_num = int(parts[2]) + 1
            return f"REQ-{year}-{next_num:04d}"
    return f"REQ-{year}-0001"

def generate_next_purchase_request_code(cursor) -> str:
    """Generates the next sequential Direct Purchase Request Code with pattern PUR-YYYY-XXXX (e.g. PUR-2026-0001)."""
    year = datetime.now().year
    lock_hint = " WITH (UPDLOCK, HOLDLOCK)" if is_sql_server() else ""
    cursor.execute(f"""
        SELECT TOP 1 request_code 
        FROM dbo.lms_course_requests{lock_hint}
        WHERE request_code LIKE ?
        ORDER BY id DESC
    """, (f"PUR-{year}-%",))
    row = cursor.fetchone()
    if row and row[0]:
        last_id = str(row[0])
        parts = last_id.split("-")
        if len(parts) == 3 and parts[2].isdigit():
            next_num = int(parts[2]) + 1
            return f"PUR-{year}-{next_num:04d}"
    return f"PUR-{year}-0001"

def create_direct_purchase_request(
    cursor,
    course_name: str,
    provider: str,
    category: str,
    course_link: Optional[str] = None,
    reason: Optional[str] = None,
    created_by: Optional[str] = None
) -> Dict[str, Any]:
    """Creates a master request and 5 completed stages for direct L&D course purchases (PUR-YYYY-XXXX)."""
    ensure_employee_profile(cursor, created_by or "EMP006")
    clean_emp_id = str(created_by or "EMP006").strip().upper()[:7]
    creator = clean_emp_id
    req_code = generate_next_purchase_request_code(cursor)

    prov_id = course_metadata_repository.resolve_provider_id(provider, cursor=cursor)
    cat_id = course_metadata_repository.resolve_category_id(category, cursor=cursor)

    query = """
        INSERT INTO dbo.lms_course_requests (
            request_code,
            employee_id,
            course_name,
            provider_id,
            category_id,
            course_link,
            reason,
            created_at,
            created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, GETDATE(), ?)
    """
    cursor.execute(
        query,
        (
            req_code,
            clean_emp_id,
            course_name[:100],
            prov_id,
            cat_id,
            course_link[:255] if course_link else None,
            reason[:500] if reason else None,
            creator
        )
    )
    cursor.execute("SELECT @@IDENTITY AS id")
    row = cursor.fetchone()
    req_id = int(row[0]) if row and row[0] else 0

    today = datetime.now().date()
    stages_to_insert = [
        (req_code, 'Employee', 'Completed', today, creator),
        (req_code, 'Notified to RM', 'Completed', today, creator),
        (req_code, 'L&D', 'Completed', today, creator),
        (req_code, 'CEO Approval', 'Completed', today, 'CEO'),
        (req_code, 'Course Purchase', 'Completed', today, creator),
    ]

    for rcode, s_name, s_stat, s_date, c_by in stages_to_insert:
        cursor.execute("""
            INSERT INTO dbo.lms_course_request_stages (
                request_code, stage_name, stage_status, stage_date,
                created_at, created_by
            )
            VALUES (?, ?, ?, ?, GETDATE(), ?)
        """, (rcode, s_name, s_stat, s_date, c_by))

    return {"request_id": req_id, "request_code": req_code}

def ensure_employee_profile(cursor, employee_id: str, azure_user_id: Optional[str] = None):
    """Ensures employee_id exists in dbo.lms_employee_profiles with real Microsoft Object ID."""
    emp_id = str(employee_id).strip().upper()
    if len(emp_id) > 7:
        emp_id = emp_id[:7]
    real_oid = azure_user_id
    if not real_oid:
        try:
            from services.common.auth_service import employee_service
            emp = employee_service.get_employee_by_id(emp_id)
            if emp:
                real_oid = emp.get("microsoft_object_id")
        except Exception:
            pass

    from repositories.common import profile_repository
    profile_repository.ensure_or_sync_profile(cursor, emp_id, real_oid)
    return emp_id

def get_request_stages(cursor, request_id: int) -> List[Dict[str, Any]]:
    """Fetches all 5 milestone stages for a course request."""
    query = """
        SELECT 
            id,
            request_code,
            ? AS request_id,
            stage_name,
            stage_status,
            CONVERT(VARCHAR(10), stage_date, 120) AS stage_date,
            CONVERT(VARCHAR(19), created_at, 120) AS created_at,
            created_by,
            CONVERT(VARCHAR(19), updated_at, 120) AS updated_at,
            updated_by
        FROM dbo.lms_course_request_stages
        WHERE request_code = (SELECT request_code FROM dbo.lms_course_requests WHERE id = ?)
        ORDER BY 
            CASE stage_name 
                WHEN 'Employee' THEN 1
                WHEN 'Notified to RM' THEN 2
                WHEN 'L&D' THEN 3
                WHEN 'CEO Approval' THEN 4
                WHEN 'Course Purchase' THEN 5
                ELSE 6
            END ASC
    """
    cursor.execute(query, (request_id, request_id))
    return dictfetchall(cursor)

def get_all_requests(
    cursor,
    stage: Optional[str] = None,
    employee_id: Optional[str] = None,
    employee_name: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Retrieves course requests with their milestone stage statuses dynamically
    resolved from dbo.lms_course_request_stages.
    """
    query = """
        SELECT 
            cr.id,
            cr.request_code,
            cr.employee_id,
            cr.course_name,
            cr.provider_id,
            cr.category_id,
            COALESCE(cp.ProviderName, '-') AS provider,
            COALESCE(cc.CategoryName, '-') AS category,
            cr.course_link,
            cr.reason,
            NULL AS duration_minutes,
            NULL AS price,
            CONVERT(VARCHAR(19), cr.created_at, 120) AS created_at,
            cr.created_by,
            CONVERT(VARCHAR(10), s2.stage_date, 120) AS notified_reporting_manager,
            s3.stage_status AS ld_stage_status,
            CONVERT(VARCHAR(10), s3.stage_date, 120) AS ld_status_date,
            s4.stage_status AS ceo_stage_status,
            CONVERT(VARCHAR(10), s4.stage_date, 120) AS ceo_status_date,
            s5.stage_status AS purchase_stage_status,
            CONVERT(VARCHAR(10), s5.stage_date, 120) AS purchase_date,
            CAST(COALESCE(cr.is_ceo_bypassed, 0) AS BIT) AS is_ceo_bypassed,
            cr.reopen_reason
        FROM dbo.lms_course_requests cr
        LEFT JOIN dbo.CourseProviders cp ON cr.provider_id = cp.ProviderId
        LEFT JOIN dbo.CourseCategories cc ON cr.category_id = cc.CategoryId
        LEFT JOIN dbo.lms_course_request_stages s1 ON cr.request_code = s1.request_code AND s1.stage_name = 'Employee'
        LEFT JOIN dbo.lms_course_request_stages s2 ON cr.request_code = s2.request_code AND s2.stage_name = 'Notified to RM'
        LEFT JOIN dbo.lms_course_request_stages s3 ON cr.request_code = s3.request_code AND s3.stage_name = 'L&D'
        LEFT JOIN dbo.lms_course_request_stages s4 ON cr.request_code = s4.request_code AND s4.stage_name = 'CEO Approval'
        LEFT JOIN dbo.lms_course_request_stages s5 ON cr.request_code = s5.request_code AND s5.stage_name = 'Course Purchase'
        WHERE 1=1
    """
    params = []

    if employee_id:
        clean_id = str(employee_id).strip().upper()
        query += " AND cr.employee_id = ?"
        params.append(clean_id)

    if stage == "pending_ld":
        query += " AND s3.stage_status = 'Pending' AND cr.request_code NOT LIKE 'PUR-%'"
    elif stage == "pending_ceo":
        query += " AND s3.stage_status = 'Completed' AND s4.stage_status = 'Pending' AND cr.request_code NOT LIKE 'PUR-%'"
    elif stage == "ceo_approved":
        query += " AND s4.stage_status = 'Completed' AND (s5.stage_status IS NULL OR s5.stage_status != 'Rejected')"
    elif stage == "ready_to_purchase":
        query += " AND s4.stage_status = 'Completed' AND s5.stage_status = 'Pending'"
    elif stage == "history":
        query += " AND (s3.stage_status = 'Rejected' OR s4.stage_status = 'Rejected' OR s5.stage_status = 'Completed') AND cr.request_code NOT LIKE 'PUR-%'"
    else:
        # By default for general course requests workflow queue, exclude direct L&D self-purchases
        query += " AND cr.request_code NOT LIKE 'PUR-%'"

    query += " ORDER BY cr.created_at DESC, cr.id DESC"
    cursor.execute(query, tuple(params))
    rows = dictfetchall(cursor)

    for r in rows:
        if "price" in r and r["price"] is not None:
            r["price"] = float(r["price"])
        else:
            r["price"] = 0.0

        # Translate database stage status to legacy UI status values
        # Stage 3 (L&D)
        s3_stat = r.get("ld_stage_status") or "Pending"
        r["ld_status"] = "Approved" if s3_stat == "Completed" else s3_stat

        # Stage 4 (CEO)
        s4_stat = r.get("ceo_stage_status") or "Upcoming"
        r["ceo_status"] = "Approved" if s4_stat == "Completed" else s4_stat

        # Stage 5 (Purchase)
        s5_stat = r.get("purchase_stage_status") or "Upcoming"
        r["purchase_status"] = "Purchased" if s5_stat == "Completed" else s5_stat
        r["is_ceo_bypassed"] = bool(r.get("is_ceo_bypassed"))

    return rows

def get_request_by_id(cursor, request_id: int) -> Optional[Dict[str, Any]]:
    """Retrieves a single course request with stages attached."""
    query = """
        SELECT 
            cr.id,
            cr.request_code,
            cr.employee_id,
            cr.course_name,
            cr.provider_id,
            cr.category_id,
            COALESCE(cp.ProviderName, '-') AS provider,
            COALESCE(cc.CategoryName, '-') AS category,
            cr.course_link,
            cr.reason,
            NULL AS duration_minutes,
            NULL AS price,
            CONVERT(VARCHAR(19), cr.created_at, 120) AS created_at,
            cr.created_by,
            CONVERT(VARCHAR(10), s2.stage_date, 120) AS notified_reporting_manager,
            s3.stage_status AS ld_stage_status,
            CONVERT(VARCHAR(10), s3.stage_date, 120) AS ld_status_date,
            s4.stage_status AS ceo_stage_status,
            CONVERT(VARCHAR(10), s4.stage_date, 120) AS ceo_status_date,
            s5.stage_status AS purchase_stage_status,
            CONVERT(VARCHAR(10), s5.stage_date, 120) AS purchase_date,
            CAST(COALESCE(cr.is_ceo_bypassed, 0) AS BIT) AS is_ceo_bypassed,
            cr.reopen_reason
        FROM dbo.lms_course_requests cr
        LEFT JOIN dbo.CourseProviders cp ON cr.provider_id = cp.ProviderId
        LEFT JOIN dbo.CourseCategories cc ON cr.category_id = cc.CategoryId
        LEFT JOIN dbo.lms_course_request_stages s1 ON cr.request_code = s1.request_code AND s1.stage_name = 'Employee'
        LEFT JOIN dbo.lms_course_request_stages s2 ON cr.request_code = s2.request_code AND s2.stage_name = 'Notified to RM'
        LEFT JOIN dbo.lms_course_request_stages s3 ON cr.request_code = s3.request_code AND s3.stage_name = 'L&D'
        LEFT JOIN dbo.lms_course_request_stages s4 ON cr.request_code = s4.request_code AND s4.stage_name = 'CEO Approval'
        LEFT JOIN dbo.lms_course_request_stages s5 ON cr.request_code = s5.request_code AND s5.stage_name = 'Course Purchase'
        WHERE cr.id = ?
    """
    cursor.execute(query, (request_id,))
    row = dictfetchone(cursor)
    if row:
        if "price" in row and row["price"] is not None:
            row["price"] = float(row["price"])
        else:
            row["price"] = 0.0

        s3_stat = row.get("ld_stage_status") or "Pending"
        row["ld_status"] = "Approved" if s3_stat == "Completed" else s3_stat

        s4_stat = row.get("ceo_stage_status") or "Upcoming"
        row["ceo_status"] = "Approved" if s4_stat == "Completed" else s4_stat

        s5_stat = row.get("purchase_stage_status") or "Upcoming"
        row["purchase_status"] = "Purchased" if s5_stat == "Completed" else s5_stat
        row["is_ceo_bypassed"] = bool(row.get("is_ceo_bypassed"))

        row["stages"] = get_request_stages(cursor, request_id)
    return row

def insert_course_request(
    cursor,
    employee_id: str,
    course_name: str,
    provider: Optional[str] = None,
    category: Optional[str] = None,
    course_link: Optional[str] = None,
    reason: Optional[str] = None,
    duration_minutes: Optional[int] = None,
    price: float = 0.0,
    created_by: Optional[str] = None,
    provider_id: Optional[int] = None,
    category_id: Optional[int] = None,
) -> int:
    """
    Inserts a master course request into dbo.lms_course_requests and initializes
    the 5 milestone stages into dbo.lms_course_request_stages.
    """
    clean_emp_id = ensure_employee_profile(cursor, employee_id)
    req_code = generate_next_request_code(cursor)
    creator = (created_by or clean_emp_id)[:7]

    # 1. Insert master record into dbo.lms_course_requests
    prov_id = provider_id or course_metadata_repository.resolve_provider_id(provider, cursor=cursor)
    cat_id = category_id or course_metadata_repository.resolve_category_id(category, cursor=cursor)

    query = """
        INSERT INTO dbo.lms_course_requests (
            request_code,
            employee_id,
            course_name,
            provider_id,
            category_id,
            course_link,
            reason,
            created_at,
            created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, GETDATE(), ?)
    """
    cursor.execute(
        query,
        (
            req_code,
            clean_emp_id,
            course_name[:100],
            prov_id,
            cat_id,
            course_link[:255] if course_link else None,
            reason[:500] if reason else None,
            creator
        )
    )
    cursor.execute("SELECT @@IDENTITY AS id")
    row = cursor.fetchone()
    req_id = int(row[0]) if row and row[0] else 0

    # 2. Insert 5 initial milestone stages into dbo.lms_course_request_stages
    stages_to_insert = [
        (req_code, 'Employee', 'Completed', datetime.now().date(), creator),
        (req_code, 'Notified to RM', 'Completed', datetime.now().date(), creator),
        (req_code, 'L&D', 'Pending', None, None),
        (req_code, 'CEO Approval', 'Upcoming', None, None),
        (req_code, 'Course Purchase', 'Upcoming', None, None),
    ]

    for rcode, s_name, s_stat, s_date, c_by in stages_to_insert:
        cursor.execute("""
            INSERT INTO dbo.lms_course_request_stages (
                request_code, stage_name, stage_status, stage_date,
                created_at, created_by
            )
            VALUES (?, ?, ?, ?, GETDATE(), ?)
        """, (rcode, s_name, s_stat, s_date, c_by))

    return req_id

def update_ld_decision(
    cursor,
    request_id: int,
    status: str,
    comment: Optional[str] = None,
    admin_id: Optional[str] = None,
    bypass_ceo: bool = False
) -> None:
    """
    Updates L&D decision in dbo.lms_course_request_stages (Stage: 'L&D').
    Supports bypassing CEO approval when bypass_ceo=True, storing reopen_reason when reopened.
    """
    admin_code = str(admin_id).strip()[:7] if admin_id and str(admin_id).strip() else None
    st_lower = status.strip().lower()
    norm_status = "Completed" if st_lower == "approved" else ("Pending" if st_lower == "pending" else "Rejected")
    
    cursor.execute("SELECT request_code FROM dbo.lms_course_requests WHERE id = ?", (request_id,))
    rc_row = cursor.fetchone()
    req_code = rc_row[0] if rc_row else str(request_id)

    # Update Stage: L&D
    if norm_status == "Pending":
        reason_clean = comment.strip()[:500] if comment and str(comment).strip() else None
        cursor.execute("""
            UPDATE dbo.lms_course_requests
            SET is_ceo_bypassed = 0, reopen_reason = ?
            WHERE id = ?
        """, (reason_clean, request_id))

        cursor.execute("""
            UPDATE dbo.lms_course_request_stages
            SET 
                stage_status = 'Pending',
                stage_date = NULL,
                updated_at = GETDATE(),
                updated_by = ?
            WHERE request_code = ? AND stage_name = 'L&D'
        """, (admin_code, req_code))

        # Reset subsequent stages to Upcoming
        cursor.execute("""
            UPDATE dbo.lms_course_request_stages
            SET stage_status = 'Upcoming', stage_date = NULL, updated_at = GETDATE(), updated_by = ?
            WHERE request_code = ? AND stage_name IN ('CEO Approval', 'Course Purchase')
        """, (admin_code, req_code))
    elif norm_status == "Completed":
        cursor.execute("""
            UPDATE dbo.lms_course_request_stages
            SET 
                stage_status = ?,
                stage_date = CAST(GETDATE() AS DATE),
                updated_at = GETDATE(),
                updated_by = ?
            WHERE request_code = ? AND stage_name = 'L&D'
        """, (norm_status, admin_code, req_code))

        if bypass_ceo:
            cursor.execute("""
                UPDATE dbo.lms_course_requests
                SET is_ceo_bypassed = 1
                WHERE id = ?
            """, (request_id,))
            cursor.execute("""
                UPDATE dbo.lms_course_request_stages
                SET stage_status = 'Completed',
                    stage_date = CAST(GETDATE() AS DATE),
                    updated_at = GETDATE(),
                    updated_by = ?
                WHERE request_code = ? AND stage_name = 'CEO Approval'
            """, (admin_code, req_code))
            cursor.execute("""
                UPDATE dbo.lms_course_request_stages
                SET stage_status = 'Pending',
                    updated_at = GETDATE(),
                    updated_by = ?
                WHERE request_code = ? AND stage_name = 'Course Purchase'
            """, (admin_code, req_code))
        else:
            cursor.execute("""
                UPDATE dbo.lms_course_requests
                SET is_ceo_bypassed = 0
                WHERE id = ?
            """, (request_id,))
            # Advance CEO Approval to Pending
            cursor.execute("""
                UPDATE dbo.lms_course_request_stages
                SET stage_status = 'Pending'
                WHERE request_code = ? AND stage_name = 'CEO Approval'
            """, (req_code,))
    else:
        reason_clean = comment.strip()[:500] if comment and str(comment).strip() else None
        cursor.execute("""
            UPDATE dbo.lms_course_requests
            SET is_ceo_bypassed = 0, reopen_reason = ?
            WHERE id = ?
        """, (reason_clean, request_id))
        cursor.execute("""
            UPDATE dbo.lms_course_request_stages
            SET 
                stage_status = ?,
                stage_date = CAST(GETDATE() AS DATE),
                updated_at = GETDATE(),
                updated_by = ?
            WHERE request_code = ? AND stage_name = 'L&D'
        """, (norm_status, admin_code, req_code))

        # Mark subsequent stages as Rejected
        cursor.execute("""
            UPDATE dbo.lms_course_request_stages
            SET stage_status = 'Rejected', updated_at = GETDATE(), updated_by = ?
            WHERE request_code = ? AND stage_name IN ('CEO Approval', 'Course Purchase')
        """, (admin_code, req_code))

def update_ceo_decision(
    cursor,
    request_id: int,
    status: str,
    comment: Optional[str] = None,
    admin_id: Optional[str] = None
) -> None:
    """
    Updates CEO decision in dbo.lms_course_request_stages (Stage: 'CEO Approval').
    Advances 'Course Purchase' to Pending if approved; marks rejected if rejected.
    """
    admin_code = str(admin_id).strip()[:7] if admin_id and str(admin_id).strip() else None
    norm_status = "Completed" if status.lower() == "approved" else "Rejected"

    cursor.execute("SELECT request_code FROM dbo.lms_course_requests WHERE id = ?", (request_id,))
    rc_row = cursor.fetchone()
    req_code = rc_row[0] if rc_row else str(request_id)

    # Update Stage: CEO Approval
    cursor.execute("""
        UPDATE dbo.lms_course_request_stages
        SET 
            stage_status = ?,
            stage_date = CAST(GETDATE() AS DATE),
            updated_at = GETDATE(),
            updated_by = ?
        WHERE request_code = ? AND stage_name = 'CEO Approval'
    """, (norm_status, admin_code, req_code))

    if norm_status == "Completed":
        # Advance Course Purchase to Pending
        cursor.execute("""
            UPDATE dbo.lms_course_request_stages
            SET stage_status = 'Pending'
            WHERE request_code = ? AND stage_name = 'Course Purchase'
        """, (req_code,))
    else:
        # Mark Course Purchase as Rejected
        cursor.execute("""
            UPDATE dbo.lms_course_request_stages
            SET stage_status = 'Rejected', updated_at = GETDATE(), updated_by = ?
            WHERE request_code = ? AND stage_name = 'Course Purchase'
        """, (admin_code, req_code))

def mark_as_purchased(
    cursor,
    request_id: int,
    admin_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Updates 'Course Purchase' stage to Completed, creates the course in dbo.lms_courses,
    and logs the activity in dbo.lms_hr_activity_feed.
    """
    admin_code = str(admin_id).strip()[:7] if admin_id and str(admin_id).strip() else None

    cursor.execute("SELECT request_code FROM dbo.lms_course_requests WHERE id = ?", (request_id,))
    rc_row = cursor.fetchone()
    req_code = rc_row[0] if rc_row else str(request_id)

    # 1. Update Stage: Course Purchase to Completed
    cursor.execute("""
        UPDATE dbo.lms_course_request_stages
        SET 
            stage_status = 'Completed',
            stage_date = CAST(GETDATE() AS DATE),
            updated_at = GETDATE(),
            updated_by = ?
        WHERE request_code = ? AND stage_name = 'Course Purchase'
    """, (admin_code, req_code))

    # 2. Fetch course request details
    req = get_request_by_id(cursor, request_id)
    if not req:
        return {}

    course_name = req.get("course_name") or "New Course"
    provider = req.get("provider") or "Online Provider"
    duration = req.get("duration_minutes") or 120
    description = req.get("reason") or "Course added from approved employee course request."
    category = req.get("category") or "DEVELOPMENT"
    course_link = req.get("course_link")

    # 3. Add course to dbo.lms_courses if not already registered by AddCourseMaterialModal
    lock_hint = " WITH (UPDLOCK, HOLDLOCK)" if is_sql_server() else ""
    cursor.execute(f"""
        SELECT id FROM dbo.lms_courses{lock_hint}
        WHERE request_id = ?
           OR (LOWER(LTRIM(RTRIM(course_name))) = LOWER(?) AND COALESCE(hr_status, 'Pending') <> 'Rejected')
    """, (request_id, course_name.strip()))
    existing_course = cursor.fetchone()

    if not existing_course:
        cursor.execute("""
            INSERT INTO dbo.lms_courses (
                course_name,
                provider,
                category,
                duration_minutes,
                price,
                description,
                course_account_email,
                support_document,
                request_id,
                hr_status,
                created_at,
                created_by,
                updated_at,
                updated_by
            )
            VALUES (?, ?, ?, ?, 2999.00, ?, NULL, ?, ?, 'Pending', GETDATE(), ?, GETDATE(), ?)
        """, (
            course_name[:100],
            provider[:50],
            category[:30],
            duration,
            description[:500],
            course_link[:500] if course_link else None,
            request_id,
            admin_code,
            admin_code
        ))
    else:
        cursor.execute("""
            UPDATE dbo.lms_courses
            SET request_id = COALESCE(request_id, ?),
                updated_at = GETDATE(),
                updated_by = ?
            WHERE id = ?
        """, (request_id, admin_code, existing_course[0]))

    # 4. Insert into dbo.lms_hr_activity_feed if not already recorded
    try:
        cursor.execute("""
            SELECT 1 FROM dbo.lms_hr_activity_feed
            WHERE activity_type = 'COURSE_PURCHASED'
              AND message LIKE ?
              AND CAST(created_at AS DATE) = CAST(GETDATE() AS DATE)
        """, (f"%{course_name[:40]}%",))
        if not cursor.fetchone():
            cursor.execute("""
                INSERT INTO dbo.lms_hr_activity_feed (
                    activity_type,
                    message,
                    created_at,
                    created_by
                )
                VALUES ('COURSE_PURCHASED', ?, GETDATE(), ?)
            """, (f"Course '{course_name[:80]}' ({provider[:30]}) was purchased and added to catalog.", admin_code))
    except Exception as e:
        print(f"[Warning] Could not log to lms_hr_activity_feed: {e}")

    return req

def get_pending_escalation_requests(cursor, days_pending: int = 7) -> List[Dict[str, Any]]:
    """
    REQ-CRS-025: Queries requests where an approval stage has been in 'Pending' status
    for at least days_pending business days without decision.
    """
    query = """
        SELECT cr.id, cr.request_code, cr.employee_id, cr.course_name, cr.provider_id,
               COALESCE(cp.ProviderName, '-') AS provider, cr.created_at,
               s.stage_name, s.stage_status, s.created_at AS stage_created_at
        FROM dbo.lms_course_requests cr
        LEFT JOIN dbo.CourseProviders cp ON cr.provider_id = cp.ProviderId
        JOIN dbo.lms_course_request_stages s ON cr.request_code = s.request_code
        WHERE s.stage_status = 'Pending'
          AND (DATEDIFF(day, cr.created_at, GETDATE()) >= ? OR DATEDIFF(day, s.created_at, GETDATE()) >= ?)
    """
    cursor.execute(query, (days_pending, days_pending))
    return dictfetchall(cursor)
