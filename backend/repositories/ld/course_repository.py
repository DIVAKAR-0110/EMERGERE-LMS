"""
Course Repository.
Data access layer for dbo.lms_courses.
Executes pure parameterized SQL queries (?).
"""

from typing import List, Dict, Any, Optional
from database.connection import dictfetchall, dictfetchone, is_sql_server
from constants.course_metadata import resolve_provider_name, resolve_category_name

def generate_next_claim_id(cursor) -> str:
    """Generate next 13-character alphanumeric claim ID: CLM-YYYY-XXXX."""
    from datetime import datetime
    year = datetime.now().year
    prefix = f"CLM-{year}-"
    lock_hint = " WITH (UPDLOCK, HOLDLOCK)" if is_sql_server() else ""
    cursor.execute(f"SELECT COALESCE(MAX(id), 0) FROM dbo.lms_courses{lock_hint}")
    res = cursor.fetchone()
    max_num = (res[0] if res and res[0] else 0) + 1
    return f"{prefix}{max_num:04d}"

def generate_next_purchase_code(cursor) -> str:
    """Generate next sequential purchase code for direct L&D course additions: PUR-YYYY-XXXX."""
    from datetime import datetime
    year = datetime.now().year
    prefix = f"PUR-{year}-"
    lock_hint = " WITH (UPDLOCK, HOLDLOCK)" if is_sql_server() else ""
    cursor.execute(f"""
        SELECT claim_id FROM dbo.lms_courses{lock_hint}
        WHERE claim_id LIKE '{prefix}%'
        ORDER BY id DESC
    """)
    rows = cursor.fetchall()
    max_num = 0
    for r in rows:
        val = str(r[0] or "").strip()
        parts = val.split("-")
        if len(parts) >= 3 and parts[-1].isdigit():
            num = int(parts[-1])
            if num > max_num:
                max_num = num
    return f"{prefix}{max_num + 1:04d}"

def get_all_courses(
    cursor,
    is_active: Optional[bool] = None,
    hr_status: Optional[str] = None,
    search: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Retrieves all video courses from dbo.lms_courses with requester, reimbursement claim details, and fast indexed search."""
    where_clauses = []
    params = []

    if hr_status:
        where_clauses.append("LOWER(COALESCE(c.hr_status, 'Pending')) = LOWER(?)")
        params.append(hr_status.strip())

    if search and search.strip():
        term = search.strip()
        # API-VAL-036: Indexed title search utilizes IX_lms_courses_course_name returning in <50ms
        where_clauses.append("(c.course_name LIKE ? OR c.course_name LIKE ? OR cp.ProviderName LIKE ?)")
        params.extend([f"{term}%", f"% {term}%", f"{term}%"])

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    query = f"""
        SELECT 
            c.id,
            c.course_name AS course_title,
            c.course_url,
            c.provider_id,
            COALESCE(cp.ProviderName, 'Udemy') AS provider_name,
            c.category_id,
            COALESCE(cc.CategoryName, 'Development') AS category_name,
            c.duration_minutes,
            c.price,
            c.description,
            c.course_email_id,
            COALESCE(ce.CourseEmail, '') AS course_account_email,
            c.support_document AS supported_document,
            CAST(1 AS BIT) AS is_active,
            COALESCE(c.hr_status, 'Pending') AS hr_status,
            COALESCE(c.payment_status, 'Pending Payment') AS payment_status,
            CONVERT(VARCHAR(19), c.hr_reviewed_at, 120) AS hr_reviewed_at,
            c.hr_id,
            c.request_id,
            c.claim_id,
            CONVERT(VARCHAR(19), c.created_at, 120) AS created_at,
            c.created_by,
            CONVERT(VARCHAR(19), c.updated_at, 120) AS updated_at,
            c.updated_by,
            cr.employee_id,
            cr.request_code AS course_request_code,
            CONVERT(VARCHAR(19), cr.created_at, 120) AS employee_request_date,
            CONVERT(VARCHAR(10), pr.created_at, 120) AS paid_on,
            pr.payment_code,
            pr.payment_slip_path,
            pr.payment_slip_name,
            pr.payment_description
        FROM dbo.lms_courses c
        LEFT JOIN dbo.CourseProviders cp ON c.provider_id = cp.ProviderId
        LEFT JOIN dbo.CourseCategories cc ON c.category_id = cc.CategoryId
        LEFT JOIN dbo.CourseEmails ce ON c.course_email_id = ce.CourseEmailId
        LEFT JOIN dbo.lms_course_requests cr ON c.request_id = cr.id
        LEFT JOIN dbo.lms_payment_records pr ON (pr.claim_type = 'Course' AND (pr.request_code = cr.request_code OR pr.request_code = c.claim_id))
        {where_sql}
        ORDER BY c.created_at DESC, c.id DESC
    """
    cursor.execute(query, tuple(params))
    rows = dictfetchall(cursor)

    from services.common.auth_service import employee_service
    all_emps = employee_service.get_all_employees()
    emp_map = {str(e.get("employee_id", "")).strip().upper(): e for e in all_emps if e.get("employee_id")}

    # Pre-fetch stages for all courses in a single query
    claim_codes = [
        r.get("claim_id") or r.get("course_request_code")
        for r in rows
        if (r.get("claim_id") or r.get("course_request_code"))
    ]
    stages_by_code = {}
    if claim_codes:
        tbl_stg = "dbo." if is_sql_server() else ""
        placeholders = ", ".join(["?"] * len(claim_codes))
        try:
            cursor.execute(f"""
                SELECT request_code, stage_name, stage_status, 
                       COALESCE(CONVERT(VARCHAR(10), stage_date, 120), '') AS stage_date
                FROM {tbl_stg}lms_course_request_stages
                WHERE request_code IN ({placeholders})
                ORDER BY id ASC
            """, tuple(claim_codes))
            stage_rows = dictfetchall(cursor)
            for s in stage_rows:
                rc = s.get("request_code")
                if rc not in stages_by_code:
                    stages_by_code[rc] = {}
                stages_by_code[rc][s.get("stage_name")] = s
        except Exception:
            pass

    for r in rows:
        r["is_active"] = True
        cid = r.get("claim_id") or r.get("course_request_code")
        r["claim_id"] = cid
        r["course_code"] = cid or f"CRS-{r['id']}"
        dur = r.get("duration_minutes") or 150
        h = dur // 60
        m = dur % 60
        r["duration"] = f"{h}h {m}m" if h > 0 and m > 0 else (f"{h}h" if h > 0 else f"{m}m")
        r["course_url"] = r.get("course_url") or f"https://courses.emergertech.com/view/{r['id']}"
        cost = int(round(float(r.get("price") or 0))) if r.get("price") is not None else 0
        r["price"] = cost

        emp_id = r.get("employee_id") or r.get("created_by")
        r["employee_id"] = emp_id
        emp = (emp_map.get(str(emp_id).strip().upper()) or employee_service.get_employee_by_id(emp_id)) if emp_id else None
        if emp:
            r["employee_name"] = emp.get("name") or emp.get("display_name") or emp_id
            r["employee_role"] = emp.get("job_title") or emp.get("role")
            r["employee_department"] = emp.get("department")
            r["department"] = emp.get("department")
        else:
            r["employee_name"] = f"Employee {emp_id}" if emp_id else None
            r["employee_role"] = None
            r["employee_department"] = None
            r["department"] = None

        # Resolve the 5 timeline workflow stages for HR Approvals & Workflow
        code_stages = stages_by_code.get(cid, {})

        emp_stage = code_stages.get("Employee") or code_stages.get("Employee Request")
        ld_stage = code_stages.get("L&D") or code_stages.get("L&D Approval")
        ceo_stage = code_stages.get("CEO Bypass") or code_stages.get("CEO Approval")
        purch_stage = code_stages.get("Course Purchase")

        req_dt = emp_stage.get("stage_date") if emp_stage and emp_stage.get("stage_date") else (str(r.get("employee_request_date") or r.get("created_at") or "")[:10] or None)
        ld_dt = ld_stage.get("stage_date") if ld_stage and ld_stage.get("stage_date") else (str(r.get("ld_approval_date") or req_dt or "")[:10] or None)
        ceo_dt = ceo_stage.get("stage_date") if ceo_stage and ceo_stage.get("stage_date") else (str(r.get("ceo_status_date") or ld_dt or "")[:10] or None)
        purch_dt = purch_stage.get("stage_date") if purch_stage and purch_stage.get("stage_date") else (str(r.get("created_at") or "")[:10] or None)

        hr_st = r.get("hr_status") or "Pending"
        hr_dt = str(r.get("hr_reviewed_at") or "")[:10] if hr_st in ("Approved", "Rejected") and r.get("hr_reviewed_at") else None

        is_pur = str(cid).strip().upper().startswith("PUR") or bool(r.get("is_ceo_bypassed"))

        r["stages"] = [
            {
                "stage_name": "Employee Request",
                "stage_status": emp_stage.get("stage_status") if emp_stage else "Completed",
                "stage_date": req_dt
            },
            {
                "stage_name": "L&D Approval",
                "stage_status": ld_stage.get("stage_status") if ld_stage else "Completed",
                "stage_date": ld_dt
            },
            {
                "stage_name": "CEO Bypass" if is_pur else "CEO Approval",
                "stage_status": ceo_stage.get("stage_status") if ceo_stage else "Completed",
                "stage_date": ceo_dt
            },
            {
                "stage_name": "Course Purchase",
                "stage_status": purch_stage.get("stage_status") if purch_stage else "Completed",
                "stage_date": purch_dt
            },
            {
                "stage_name": "HR Claim Approval",
                "stage_status": hr_st,
                "stage_date": hr_dt
            }
        ]

    return rows

def get_course_by_id(cursor, course_id: int) -> Optional[Dict[str, Any]]:
    """Retrieves a single course by its ID with complete metadata."""
    query = """
        SELECT 
            c.id,
            c.course_name AS course_title,
            c.course_url,
            c.provider_id,
            COALESCE(cp.ProviderName, 'Udemy') AS provider_name,
            c.category_id,
            COALESCE(cc.CategoryName, 'Development') AS category_name,
            c.duration_minutes,
            c.price,
            c.description,
            c.course_email_id,
            COALESCE(ce.CourseEmail, '') AS course_account_email,
            c.support_document AS supported_document,
            CAST(1 AS BIT) AS is_active,
            COALESCE(c.hr_status, 'Pending') AS hr_status,
            COALESCE(c.payment_status, 'Pending Payment') AS payment_status,
            CONVERT(VARCHAR(19), c.hr_reviewed_at, 120) AS hr_reviewed_at,
            c.hr_id,
            c.request_id,
            c.claim_id,
            CONVERT(VARCHAR(19), c.created_at, 120) AS created_at,
            c.created_by,
            CONVERT(VARCHAR(19), c.updated_at, 120) AS updated_at,
            c.updated_by,
            cr.employee_id,
            cr.request_code AS course_request_code,
            CONVERT(VARCHAR(19), cr.created_at, 120) AS employee_request_date,
            CONVERT(VARCHAR(10), pr.created_at, 120) AS paid_on,
            pr.payment_code,
            pr.payment_slip_path,
            pr.payment_slip_name,
            pr.payment_description
        FROM dbo.lms_courses c
        LEFT JOIN dbo.CourseProviders cp ON c.provider_id = cp.ProviderId
        LEFT JOIN dbo.CourseCategories cc ON c.category_id = cc.CategoryId
        LEFT JOIN dbo.CourseEmails ce ON c.course_email_id = ce.CourseEmailId
        LEFT JOIN dbo.lms_course_requests cr ON c.request_id = cr.id
        LEFT JOIN dbo.lms_payment_records pr ON (pr.claim_type = 'Course' AND (pr.request_code = cr.request_code OR pr.request_code = c.claim_id))
        WHERE c.id = ?
    """
    cursor.execute(query, (course_id,))
    row = dictfetchone(cursor)
    if not row:
        return None

    row["is_active"] = True
    cid = row.get("claim_id") or row.get("course_request_code")
    row["claim_id"] = cid
    row["course_code"] = cid or f"CRS-{row['id']}"
    dur = row.get("duration_minutes") or 150
    h = dur // 60
    m = dur % 60
    row["duration"] = f"{h}h {m}m" if h > 0 and m > 0 else (f"{h}h" if h > 0 else f"{m}m")
    row["course_url"] = row.get("course_url") or f"https://courses.emergertech.com/view/{row['id']}"
    cost = int(round(float(row.get("price") or 0))) if row.get("price") is not None else 0
    row["price"] = cost

    from services.common.auth_service import employee_service
    emp_id = row.get("employee_id") or row.get("created_by")
    row["employee_id"] = emp_id
    emp = employee_service.get_employee_by_id(emp_id) if emp_id else None
    if emp:
        row["employee_name"] = emp.get("name") or emp.get("display_name") or emp_id
        row["employee_role"] = emp.get("job_title") or emp.get("role")
        row["employee_department"] = emp.get("department")
        row["department"] = emp.get("department")
    else:
        row["employee_name"] = f"Employee {emp_id}" if emp_id else None
        row["employee_role"] = None
        row["employee_department"] = None
        row["department"] = None

    return row

def insert_course(
    cursor,
    course_title: str,
    course_url: Optional[str] = None,
    provider_name: Optional[str] = None,
    category_name: Optional[str] = None,
    duration: Optional[Any] = None,
    course_account_email: Optional[str] = None,
    description: Optional[str] = None,
    supported_document: Optional[str] = None,
    created_by: Optional[str] = None,
    **kwargs
) -> int:
    """Inserts a new course into dbo.lms_courses with foreign keys provider_id, category_id, course_email_id."""
    from repositories.common.course_metadata_repository import course_metadata_repository
    from services.employee.daily_learning_service import parse_duration_to_minutes
    dur_min = kwargs.get("duration_minutes")
    if dur_min is None:
        dur_min = parse_duration_to_minutes(duration)

    prov_id = kwargs.get("provider_id")
    if not prov_id:
        prov_val = provider_name or kwargs.get("provider")
        prov_id = course_metadata_repository.resolve_provider_id(prov_val, cursor=cursor)

    cat_id = kwargs.get("category_id")
    if not cat_id:
        cat_val = category_name or kwargs.get("category")
        cat_id = course_metadata_repository.resolve_category_id(cat_val, cursor=cursor)

    email_id = kwargs.get("course_email_id")
    if not email_id:
        email_val = course_account_email or kwargs.get("course_account_email")
        email_id = course_metadata_repository.resolve_course_email_id(email_val, cursor=cursor)

    raw_cost = kwargs.get("price") or kwargs.get("estimated_cost") or kwargs.get("estimated_cost_inr")
    cost_val = int(round(float(raw_cost))) if raw_cost is not None else None
    hr_status = kwargs.get("hr_status") or "Pending"
    request_id = kwargs.get("request_id")
    claim_id = kwargs.get("claim_id")
    if not claim_id:
        if not request_id:
            claim_id = generate_next_purchase_code(cursor)
        else:
            claim_id = generate_next_claim_id(cursor)
    raw_actor = created_by or kwargs.get("created_by")
    actor = str(raw_actor).strip()[:7] if raw_actor and str(raw_actor).strip() else None
    url_val = (course_url or kwargs.get("course_url") or "").strip()[:255] if (course_url or kwargs.get("course_url")) else None

    query = """
        INSERT INTO dbo.lms_courses (
            course_name, course_url, provider_id, category_id, duration_minutes, price,
            description, course_email_id, support_document,
            request_id, claim_id, hr_status, created_at, created_by,
            updated_at, updated_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), ?, GETDATE(), ?)
    """
    cursor.execute(
        query,
        (
            course_title.strip()[:100],
            url_val,
            int(prov_id) if prov_id else None,
            int(cat_id) if cat_id else None,
            int(dur_min) if dur_min is not None else None,
            cost_val,
            (description or "")[:500],
            int(email_id) if email_id else None,
            (supported_document or kwargs.get("support_document") or "")[:500],
            int(request_id) if request_id else None,
            claim_id[:50],
            hr_status[:20],
            actor,
            actor
        )
    )
    cursor.execute("SELECT @@IDENTITY AS id")
    row = cursor.fetchone()
    return int(row[0]) if row and row[0] else 0

def update_course(
    cursor,
    course_id: int,
    course_title: Optional[str] = None,
    provider_name: Optional[str] = None,
    category_name: Optional[str] = None,
    duration: Optional[Any] = None,
    description: Optional[str] = None,
    course_account_email: Optional[str] = None,
    supported_document: Optional[str] = None,
    **kwargs
) -> None:
    from repositories.common.course_metadata_repository import course_metadata_repository
    fields = []
    params = []
    if course_title is not None:
        fields.append("course_name = ?")
        params.append(course_title.strip()[:100])

    if "provider_id" in kwargs and kwargs["provider_id"] is not None:
        fields.append("provider_id = ?")
        params.append(int(kwargs["provider_id"]))
    elif provider_name is not None or kwargs.get("provider") is not None:
        p_val = provider_name or kwargs.get("provider")
        p_id = course_metadata_repository.resolve_provider_id(p_val, cursor=cursor)
        if p_id is not None:
            fields.append("provider_id = ?")
            params.append(int(p_id))

    if "category_id" in kwargs and kwargs["category_id"] is not None:
        fields.append("category_id = ?")
        params.append(int(kwargs["category_id"]))
    elif category_name is not None or kwargs.get("category") is not None:
        c_val = category_name or kwargs.get("category")
        c_id = course_metadata_repository.resolve_category_id(c_val, cursor=cursor)
        if c_id is not None:
            fields.append("category_id = ?")
            params.append(int(c_id))

    if "course_email_id" in kwargs and kwargs["course_email_id"] is not None:
        fields.append("course_email_id = ?")
        params.append(int(kwargs["course_email_id"]))
    elif course_account_email is not None or kwargs.get("course_account_email") is not None:
        e_val = course_account_email or kwargs.get("course_account_email")
        e_id = course_metadata_repository.resolve_course_email_id(e_val, cursor=cursor)
        if e_id is not None:
            fields.append("course_email_id = ?")
            params.append(int(e_id))

    if "duration_minutes" in kwargs and kwargs["duration_minutes"] is not None:
        fields.append("duration_minutes = ?")
        params.append(int(kwargs["duration_minutes"]))
    elif duration is not None:
        from services.employee.daily_learning_service import parse_duration_to_minutes
        fields.append("duration_minutes = ?")
        params.append(parse_duration_to_minutes(duration))
    if "price" in kwargs and kwargs["price"] is not None:
        fields.append("price = ?")
        params.append(int(round(float(kwargs["price"]))))
    elif "estimated_cost" in kwargs and kwargs["estimated_cost"] is not None:
        fields.append("price = ?")
        params.append(int(round(float(kwargs["estimated_cost"]))))
    if description is not None:
        fields.append("description = ?")
        params.append(description[:500])
    if supported_document is not None:
        fields.append("support_document = ?")
        params.append(supported_document[:500])
    if "hr_status" in kwargs and kwargs["hr_status"] is not None:
        fields.append("hr_status = ?")
        params.append(kwargs["hr_status"][:20])
    if "claim_id" in kwargs and kwargs["claim_id"] is not None:
        fields.append("claim_id = ?")
        params.append(kwargs["claim_id"][:50])

    updater = (kwargs.get("updated_by") or "SYSTEM")[:7]
    fields.append("updated_at = GETDATE()")
    fields.append("updated_by = ?")
    params.append(updater)

    query = f"UPDATE dbo.lms_courses SET {', '.join(fields)} WHERE id = ?"
    params.append(course_id)
    cursor.execute(query, tuple(params))

def update_course_hr_status(
    cursor,
    course_id: int,
    hr_status: str,
    hr_id: Optional[int] = None,
    hr_reviewed_at: Optional[Any] = None,
    **kwargs
) -> None:
    """Updates hr_status and timestamp for course reimbursement claim."""
    updater = (kwargs.get("updated_by") or (f"EMP{hr_id:03d}" if hr_id else "SYSTEM"))[:7]
    query = """
        UPDATE dbo.lms_courses
        SET hr_status = ?,
            hr_id = ?,
            hr_reviewed_at = COALESCE(?, GETDATE()),
            updated_at = GETDATE(),
            updated_by = ?
        WHERE id = ?
    """
    cursor.execute(query, (hr_status[:20], hr_id, hr_reviewed_at, updater, course_id))

def delete_course(cursor, course_id: int) -> None:
    cursor.execute("DELETE FROM dbo.lms_courses WHERE id = ?", (course_id,))

def review_course_hr(cursor, course_id: int, hr_status: str, **kwargs) -> None:
    update_course_hr_status(cursor, course_id, hr_status, **kwargs)
