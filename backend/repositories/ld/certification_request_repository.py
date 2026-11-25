"""
Certification Request Repository.
Data access layer for multi-stage certification requests workflow:
- dbo.lms_certification_requests (Master Certification Request Information)
- dbo.lms_certification_request_stages (Individual Milestone Workflow Stages: 1 to 4)
Pure parameterized SQL queries without transaction commits/rollbacks.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
import re
from database.connection import dictfetchall, dictfetchone, is_sql_server
from constants.course_metadata import resolve_provider_name, resolve_category_name

def generate_next_request_code(cursor) -> str:
    """Generates the next sequential Request Code with pattern CLM-YYYY-XXXX (e.g. CLM-2026-0001)."""
    year = datetime.now().year
    lock_hint = " WITH (UPDLOCK, HOLDLOCK)" if is_sql_server() else ""
    cursor.execute(f"""
        SELECT TOP 1 request_code 
        FROM dbo.lms_certification_requests{lock_hint}
        WHERE request_code LIKE ? OR request_code LIKE 'CLM-%'
        ORDER BY id DESC
    """, (f"CLM-{year}-%",))
    row = cursor.fetchone()
    if row and row[0]:
        last_id = str(row[0])
        match = re.search(r'(\d+)$', last_id)
        if match:
            next_num = int(match.group(1)) + 1
            return f"CLM-{year}-{next_num:04d}"
    return f"CLM-{year}-0001"

def insert_stages(cursor, request_id: int, employee_id: str = "SYSTEM"):
    """Inserts initial 4 approval stages for a certification request."""
    # Stage 1: Employee milestone completes upon submission
    cursor.execute("""
        INSERT INTO dbo.lms_certification_request_stages (
            request_id, stage_name, stage_status, stage_date, updated_at, updated_by
        ) VALUES (?, 'Employee', 'Completed', CAST(GETDATE() AS DATE), SYSDATETIME(), ?)
    """, (request_id, employee_id))

    # Stages 2-4: Pending/Upcoming stages have no date/timestamp/updater yet
    remaining_stages = [
        ("L&D Approval", "Pending"),
        ("CEO Approval", "Upcoming"),
        ("Certificate Approved", "Upcoming")
    ]
    for stage_name, stage_status in remaining_stages:
        cursor.execute("""
            INSERT INTO dbo.lms_certification_request_stages (
                request_id, stage_name, stage_status, stage_date, updated_at, updated_by
            ) VALUES (?, ?, ?, NULL, NULL, NULL)
        """, (request_id, stage_name, stage_status))

def get_request_stages(cursor, request_id: int) -> List[Dict[str, Any]]:
    """Fetches all 4 milestone stages for a certification request."""
    query = """
        SELECT 
            id,
            request_id,
            stage_name,
            stage_status,
            CONVERT(VARCHAR(10), stage_date, 120) AS stage_date,
            CONVERT(VARCHAR(19), updated_at, 120) AS updated_at,
            updated_by
        FROM dbo.lms_certification_request_stages
        WHERE request_id = ?
        ORDER BY 
            CASE stage_name 
                WHEN 'Employee' THEN 1
                WHEN 'L&D Approval' THEN 2
                WHEN 'CEO Approval' THEN 3
                WHEN 'Certificate Approved' THEN 4
                ELSE 5
            END ASC
    """
    cursor.execute(query, (request_id,))
    return dictfetchall(cursor)

def _enrich_employee_info(rows: List[Dict[str, Any]]) -> None:
    """Enriches certification request rows with employee details."""
    try:
        from services.common.auth_service import employee_service
        all_emps = employee_service.get_all_employees()
        emp_map = {str(e.get("employee_id", "")).strip().upper(): e for e in all_emps if e.get("employee_id")}
        for r in rows:
            raw_id = r.get("employee_id")
            emp_id = str(raw_id).strip().upper() if raw_id else ""
            emp = emp_map.get(emp_id) or (employee_service.get_employee_by_id(raw_id) if raw_id else None)
            if emp:
                r["employee_name"] = emp.get("name") or emp.get("display_name") or f"Employee {emp_id}"
                r["department"] = emp.get("department") or "Engineering"
                r["employee_role"] = emp.get("job_title") or emp.get("role") or "Developer"
            else:
                r["employee_name"] = f"Employee {emp_id}"
                r["department"] = "Engineering"
                r["employee_role"] = "Developer"
    except Exception:
        for r in rows:
            if not r.get("employee_name"):
                r["employee_name"] = f"Employee {r.get('employee_id', '')}"
            if not r.get("department"):
                r["department"] = "Engineering"
            if not r.get("employee_role"):
                r["employee_role"] = "Developer" 
    except Exception:
        for r in rows:
            if not r.get("employee_name"):
                r["employee_name"] = f"Employee {r.get('employee_id', '')}"
            if not r.get("department"):
                r["department"] = "Engineering"
            if not r.get("employee_role"):
                r["employee_role"] = "Developer"

def get_all_requests(
    cursor,
    employee_id: Optional[Any] = None,
    status: Optional[str] = None,
    stage: Optional[str] = None,
    exclude_active_claims: bool = False
) -> List[Dict[str, Any]]:
    """
    Retrieves certification requests with milestone stage statuses dynamically
    resolved from dbo.lms_certification_request_stages.
    """
    query = """
        SELECT 
            cr.id,
            cr.request_code,
            cr.employee_id,
            cr.certification_name,
            cr.provider_id,
            cr.category_id,
            cr.domain_id,
            COALESCE(cp.ProviderName, '-') AS provider_name,
            CONVERT(VARCHAR(10), cr.exam_date, 120) AS scheduled_exam_date,
            COALESCE(cd.domain_name, cc.CategoryName, '-') AS category_name,
            CAST(cr.estimated_cost AS INT) AS estimated_cost_inr,
            cr.purpose,
            cr.supporting_document_path,
            cr.status,
            CONVERT(VARCHAR(19), cr.created_at, 120) AS created_at,
            s1.stage_status AS employee_stage_status,
            CONVERT(VARCHAR(10), s1.stage_date, 120) AS employee_stage_date,
            s2.stage_status AS ld_stage_status,
            CONVERT(VARCHAR(10), s2.stage_date, 120) AS ld_status_date,
            s3.stage_status AS ceo_stage_status,
            CONVERT(VARCHAR(10), s3.stage_date, 120) AS ceo_status_date,
            s4.stage_status AS cert_stage_status,
            CONVERT(VARCHAR(10), s4.stage_date, 120) AS cert_status_date,
            CAST(COALESCE(cr.is_ceo_bypassed, 0) AS BIT) AS is_ceo_bypassed,
            cr.reopen_reason
        FROM dbo.lms_certification_requests cr
        LEFT JOIN dbo.CourseProviders cp ON cr.provider_id = cp.ProviderId
        LEFT JOIN dbo.CourseCategories cc ON cr.category_id = cc.CategoryId
        LEFT JOIN dbo.lms_certification_domains cd ON cr.domain_id = cd.domain_id
        LEFT JOIN dbo.lms_certification_request_stages s1 ON cr.id = s1.request_id AND s1.stage_name = 'Employee'
        LEFT JOIN dbo.lms_certification_request_stages s2 ON cr.id = s2.request_id AND s2.stage_name = 'L&D Approval'
        LEFT JOIN dbo.lms_certification_request_stages s3 ON cr.id = s3.request_id AND s3.stage_name = 'CEO Approval'
        LEFT JOIN dbo.lms_certification_request_stages s4 ON cr.id = s4.request_id AND s4.stage_name = 'Certificate Approved'
        WHERE 1=1
    """
    params = []
    if employee_id is not None:
        clean_emp = str(employee_id).strip()
        query += " AND cr.employee_id = ?"
        params.append(clean_emp)

    if status is not None:
        query += " AND cr.status = ?"
        params.append(status)

    if stage == "pending_ld":
        query += " AND s2.stage_status = 'Pending'"
    elif stage == "pending_ceo":
        query += " AND s2.stage_status = 'Completed' AND s3.stage_status = 'Pending'"
    elif stage == "ceo_approved" or stage == "approved":
        query += " AND cr.status = 'Approved'"
    elif stage == "rejected":
        query += " AND cr.status = 'Rejected'"
    elif stage == "history":
        query += " AND (s2.stage_status = 'Rejected' OR s3.stage_status = 'Rejected' OR cr.status = 'Approved')"

    if exclude_active_claims:
        query += """
            AND NOT EXISTS (
                SELECT 1 FROM dbo.lms_reimbursement_claims rc
                WHERE rc.employee_id = cr.employee_id
                  AND LOWER(LTRIM(RTRIM(rc.certification_name))) = LOWER(LTRIM(RTRIM(cr.certification_name)))
                  AND rc.status IN ('Pending', 'Approved')
            )
        """

    query += " ORDER BY cr.created_at DESC, cr.id DESC"
    cursor.execute(query, tuple(params))
    rows = dictfetchall(cursor)

    for r in rows:
        if "estimated_cost_inr" in r and r["estimated_cost_inr"] is not None:
            r["estimated_cost_inr"] = int(r["estimated_cost_inr"])
        else:
            r["estimated_cost_inr"] = 0

        # Translate database stage status for UI components
        s2_stat = r.get("ld_stage_status") or "Pending"
        r["ld_status"] = "Approved" if s2_stat == "Completed" else s2_stat

        s3_stat = r.get("ceo_stage_status") or "Upcoming"
        r["ceo_status"] = "Approved" if s3_stat == "Completed" else s3_stat
        r["is_ceo_bypassed"] = bool(r.get("is_ceo_bypassed"))

    _enrich_employee_info(rows)
    return rows

def get_request_by_id(cursor, request_id: int) -> Optional[Dict[str, Any]]:
    """Fetch single certification request with stages and enriched info."""
    query = """
        SELECT 
            cr.id,
            cr.request_code,
            cr.employee_id,
            cr.certification_name,
            cr.provider_id,
            cr.category_id,
            cr.domain_id,
            COALESCE(cp.ProviderName, '-') AS provider_name,
            CONVERT(VARCHAR(10), cr.exam_date, 120) AS scheduled_exam_date,
            COALESCE(cd.domain_name, cc.CategoryName, '-') AS category_name,
            CAST(cr.estimated_cost AS INT) AS estimated_cost_inr,
            cr.purpose,
            cr.supporting_document_path,
            cr.status,
            CONVERT(VARCHAR(19), cr.created_at, 120) AS created_at,
            s1.stage_status AS employee_stage_status,
            CONVERT(VARCHAR(10), s1.stage_date, 120) AS employee_stage_date,
            s2.stage_status AS ld_stage_status,
            CONVERT(VARCHAR(10), s2.stage_date, 120) AS ld_status_date,
            s3.stage_status AS ceo_stage_status,
            CONVERT(VARCHAR(10), s3.stage_date, 120) AS ceo_status_date,
            s4.stage_status AS cert_stage_status,
            CONVERT(VARCHAR(10), s4.stage_date, 120) AS cert_status_date,
            CAST(COALESCE(cr.is_ceo_bypassed, 0) AS BIT) AS is_ceo_bypassed,
            cr.reopen_reason
        FROM dbo.lms_certification_requests cr
        LEFT JOIN dbo.CourseProviders cp ON cr.provider_id = cp.ProviderId
        LEFT JOIN dbo.CourseCategories cc ON cr.category_id = cc.CategoryId
        LEFT JOIN dbo.lms_certification_domains cd ON cr.domain_id = cd.domain_id
        LEFT JOIN dbo.lms_certification_request_stages s1 ON cr.id = s1.request_id AND s1.stage_name = 'Employee'
        LEFT JOIN dbo.lms_certification_request_stages s2 ON cr.id = s2.request_id AND s2.stage_name = 'L&D Approval'
        LEFT JOIN dbo.lms_certification_request_stages s3 ON cr.id = s3.request_id AND s3.stage_name = 'CEO Approval'
        LEFT JOIN dbo.lms_certification_request_stages s4 ON cr.id = s4.request_id AND s4.stage_name = 'Certificate Approved'
        WHERE cr.id = ?
    """
    cursor.execute(query, (request_id,))
    row = dictfetchone(cursor)
    if not row:
        return None

    if "estimated_cost_inr" in row and row["estimated_cost_inr"] is not None:
        row["estimated_cost_inr"] = int(row["estimated_cost_inr"])
    else:
        row["estimated_cost_inr"] = 0

    s2_stat = row.get("ld_stage_status") or "Pending"
    row["ld_status"] = "Approved" if s2_stat == "Completed" else s2_stat

    s3_stat = row.get("ceo_stage_status") or "Upcoming"
    row["ceo_status"] = "Approved" if s3_stat == "Completed" else s3_stat
    row["is_ceo_bypassed"] = bool(row.get("is_ceo_bypassed"))

    _enrich_employee_info([row])
    row["stages"] = get_request_stages(cursor, request_id)
    return row

def get_request_by_code(cursor, request_code: str) -> Optional[Dict[str, Any]]:
    """Fetch request by request code."""
    cursor.execute("SELECT id FROM dbo.lms_certification_requests WHERE request_code = ?", (request_code,))
    row = cursor.fetchone()
    if row and row[0]:
        return get_request_by_id(cursor, int(row[0]))
    return None

def insert_request(
    cursor,
    request_code: str,
    employee_id: Any,
    certification_name: str,
    estimated_cost_inr: int,
    purpose: str,
    provider_name: Optional[str] = None,
    category_name: Optional[str] = None,
    scheduled_exam_date: Optional[str] = None,
    supporting_document: Optional[str] = None,
    supporting_document_name: Optional[str] = None,
    supporting_document_size: Optional[int] = None,
    request_status: str = "Pending",
    created_by: Optional[str] = None,
    provider_id: Optional[int] = None,
    category_id: Optional[int] = None,
    domain_id: Optional[int] = None,
    **kwargs
) -> int:
    """Inserts a new certification request into dbo.lms_certification_requests."""
    from repositories.common.course_metadata_repository import course_metadata_repository
    from repositories.common.certification_domain_repository import certification_domain_repository

    clean_emp_id = str(employee_id).strip()
    prov_id = provider_id or course_metadata_repository.resolve_provider_id(provider_name or kwargs.get("provider"), cursor=cursor)
    cat_id = category_id or course_metadata_repository.resolve_category_id(category_name or kwargs.get("category"), cursor=cursor)
    dom_id = domain_id or certification_domain_repository.resolve_domain_id(category_name or kwargs.get("domain") or kwargs.get("category"), cursor=cursor)

    query = """
        INSERT INTO dbo.lms_certification_requests (
            request_code,
            employee_id,
            certification_name,
            provider_id,
            category_id,
            domain_id,
            exam_date,
            estimated_cost,
            purpose,
            supporting_document_path,
            status,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, SYSDATETIME())
    """
    cursor.execute(
        query,
        (
            request_code,
            clean_emp_id,
            certification_name,
            prov_id,
            cat_id,
            dom_id,
            scheduled_exam_date,
            int(estimated_cost_inr) if estimated_cost_inr is not None else 0,
            purpose,
            supporting_document,
            request_status
        )
    )
    cursor.execute("SELECT @@IDENTITY AS id")
    row = cursor.fetchone()
    req_id = int(row[0]) if row and row[0] else 0

    if req_id > 0:
        insert_stages(cursor, req_id, clean_emp_id)

    return req_id

def update_ld_approval(
    cursor,
    request_id: int,
    status: str,
    admin_id: Any = 1,
    comments: Optional[str] = None,
    bypass_ceo: bool = False
) -> None:
    """Updates Stage 2 (L&D Approval), supports optional CEO bypass & stores reopen_reason."""
    admin_label = f"L&D ({admin_id})"
    if status == "Approved":
        # 1. Complete Stage 2 (L&D)
        cursor.execute("""
            UPDATE dbo.lms_certification_request_stages
            SET stage_status = 'Completed',
                stage_date = CAST(GETDATE() AS DATE),
                updated_at = SYSDATETIME(),
                updated_by = ?
            WHERE request_id = ? AND stage_name = 'L&D Approval'
        """, (admin_label, request_id))

        if bypass_ceo:
            bypass_label = f"L&D Bypass ({admin_id})"
            # Complete Stage 3 (CEO Approval) and Stage 4 (Certificate Approved) immediately
            cursor.execute("""
                UPDATE dbo.lms_certification_request_stages
                SET stage_status = 'Completed',
                    stage_date = CAST(GETDATE() AS DATE),
                    updated_at = SYSDATETIME(),
                    updated_by = ?
                WHERE request_id = ? AND stage_name IN ('CEO Approval', 'Certificate Approved')
            """, (bypass_label, request_id))

            cursor.execute("""
                UPDATE dbo.lms_certification_requests
                SET status = 'Approved',
                    is_ceo_bypassed = 1
                WHERE id = ?
            """, (request_id,))
        else:
            # 2. Open Stage 3 (CEO Approval)
            cursor.execute("""
                UPDATE dbo.lms_certification_request_stages
                SET stage_status = 'Pending',
                    updated_at = SYSDATETIME(),
                    updated_by = ?
                WHERE request_id = ? AND stage_name = 'CEO Approval'
            """, (admin_label, request_id))

            # 3. Main request remains Pending (awaiting CEO)
            cursor.execute("""
                UPDATE dbo.lms_certification_requests
                SET status = 'Pending',
                    is_ceo_bypassed = 0
                WHERE id = ?
            """, (request_id,))
    elif status == "Pending":
        # Reopen (Undo Rejection)
        reason_clean = comments.strip()[:500] if comments and str(comments).strip() else None

        # 1. Reset Stage 2 (L&D Approval) to Pending
        cursor.execute("""
            UPDATE dbo.lms_certification_request_stages
            SET stage_status = 'Pending',
                stage_date = NULL,
                updated_at = SYSDATETIME(),
                updated_by = ?
            WHERE request_id = ? AND stage_name = 'L&D Approval'
        """, (admin_label, request_id))

        # 2. Reset Stage 3 (CEO Approval) and Stage 4 (Certificate Approved) to Upcoming
        cursor.execute("""
            UPDATE dbo.lms_certification_request_stages
            SET stage_status = 'Upcoming',
                stage_date = NULL,
                updated_at = SYSDATETIME(),
                updated_by = ?
            WHERE request_id = ? AND stage_name IN ('CEO Approval', 'Certificate Approved')
        """, (admin_label, request_id))

        # 3. Main request status set to Pending and record reopen_reason
        cursor.execute("""
            UPDATE dbo.lms_certification_requests
            SET status = 'Pending',
                is_ceo_bypassed = 0,
                reopen_reason = ?
            WHERE id = ?
        """, (reason_clean, request_id))
    else:
        # Rejected by L&D
        cursor.execute("""
            UPDATE dbo.lms_certification_request_stages
            SET stage_status = 'Rejected',
                stage_date = CAST(GETDATE() AS DATE),
                updated_at = SYSDATETIME(),
                updated_by = ?
            WHERE request_id = ? AND stage_name = 'L&D Approval'
        """, (admin_label, request_id))

        cursor.execute("""
            UPDATE dbo.lms_certification_request_stages
            SET stage_status = 'Rejected',
                updated_at = SYSDATETIME(),
                updated_by = ?
            WHERE request_id = ? AND stage_name IN ('CEO Approval', 'Certificate Approved')
        """, (admin_label, request_id))

        reason_clean = comments.strip()[:500] if comments and str(comments).strip() else None
        cursor.execute("""
            UPDATE dbo.lms_certification_requests
            SET status = 'Rejected',
                is_ceo_bypassed = 0,
                reopen_reason = ?
            WHERE id = ?
        """, (reason_clean, request_id))

def update_ceo_approval(
    cursor,
    request_id: int,
    status: str,
    admin_id: Any = 1,
    comments: Optional[str] = None
) -> None:
    """Updates Stage 3 (CEO Approval) and marks Stage 4 (Certificate Approved)."""
    admin_label = f"CEO ({admin_id})"
    if status == "Approved":
        # 1. Complete Stage 3 (CEO Approval)
        cursor.execute("""
            UPDATE dbo.lms_certification_request_stages
            SET stage_status = 'Completed',
                stage_date = CAST(GETDATE() AS DATE),
                updated_at = SYSDATETIME(),
                updated_by = ?
            WHERE request_id = ? AND stage_name = 'CEO Approval'
        """, (admin_label, request_id))

        # 2. Complete Stage 4 (Certificate Approved)
        cursor.execute("""
            UPDATE dbo.lms_certification_request_stages
            SET stage_status = 'Completed',
                stage_date = CAST(GETDATE() AS DATE),
                updated_at = SYSDATETIME(),
                updated_by = ?
            WHERE request_id = ? AND stage_name = 'Certificate Approved'
        """, (admin_label, request_id))

        # 3. Main request marked Approved
        cursor.execute("""
            UPDATE dbo.lms_certification_requests
            SET status = 'Approved'
            WHERE id = ?
        """, (request_id,))
    else:
        # Rejected by CEO
        cursor.execute("""
            UPDATE dbo.lms_certification_request_stages
            SET stage_status = 'Rejected',
                stage_date = CAST(GETDATE() AS DATE),
                updated_at = SYSDATETIME(),
                updated_by = ?
            WHERE request_id = ? AND stage_name = 'CEO Approval'
        """, (admin_label, request_id))

        cursor.execute("""
            UPDATE dbo.lms_certification_request_stages
            SET stage_status = 'Rejected',
                updated_at = SYSDATETIME(),
                updated_by = ?
            WHERE request_id = ? AND stage_name = 'Certificate Approved'
        """, (admin_label, request_id))

        cursor.execute("""
            UPDATE dbo.lms_certification_requests
            SET status = 'Rejected'
            WHERE id = ?
        """, (request_id,))

def update_request_status(
    cursor,
    request_id: int,
    request_status: str,
    updated_by: Optional[str] = None
) -> None:
    """Direct status update for compatibility."""
    query = """
        UPDATE dbo.lms_certification_requests 
        SET status = ? 
        WHERE id = ?
    """
    cursor.execute(query, (request_status, request_id))

def delete_request(cursor, request_id: int) -> bool:
    """Delete a certification request and its stages."""
    cursor.execute("DELETE FROM dbo.lms_certification_request_stages WHERE request_id = ?", (request_id,))
    cursor.execute("DELETE FROM dbo.lms_certification_requests WHERE id = ?", (request_id,))
    return cursor.rowcount > 0
