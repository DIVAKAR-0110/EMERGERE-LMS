"""
Reimbursement Claim Repository.
Data access layer executing pure parameterized SQL queries for:
- dbo.lms_reimbursement_claims
- dbo.lms_reimbursement_claim_stages
- dbo.lms_spend_category
- dbo.lms_hr_activity_feed
- dbo.lms_department_budgets
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
from database.connection import dictfetchall, dictfetchone, is_sql_server
from constants.course_metadata import resolve_provider_name

def generate_next_claim_code(cursor) -> str:
    """
    Generates a sequential claim code in format CLM-YYYY-XXXX (e.g., CLM-2026-0001).
    """
    current_year = datetime.now().year
    prefix = f"CLM-{current_year}-"
    lock_hint = " WITH (UPDLOCK, HOLDLOCK)" if is_sql_server() else ""

    query = f"""
        SELECT claim_code
        FROM dbo.lms_reimbursement_claims{lock_hint}
        WHERE claim_code LIKE ?
        ORDER BY id DESC
    """
    cursor.execute(query, (f"{prefix}%",))
    rows = cursor.fetchall()

    max_seq = 0
    for r in rows:
        code_str = r[0] if (isinstance(r, (list, tuple)) or hasattr(r, '__getitem__')) else getattr(r, "claim_code", None)
        if code_str and str(code_str).startswith(prefix):
            suffix = str(code_str)[len(prefix):]
            if suffix.isdigit():
                val = int(suffix)
                if val > max_seq:
                    max_seq = val

    next_seq = max_seq + 1
    return f"{prefix}{next_seq:04d}"

def get_all_claims(
    cursor,
    employee_id: Optional[Any] = None,
    status: Optional[str] = None,
    processing_status: Optional[str] = None
) -> List[Dict[str, Any]]:
    query = """
        SELECT 
            rc.id,
            rc.claim_code,
            rc.employee_id,
            'Certification' AS claim_type,
            rc.certification_name,
            rc.provider_id,
            COALESCE(cp.ProviderName, 'Udemy') AS provider_name,
            rc.category_id,
            COALESCE(cc.CategoryName, 'General') AS category_name,
            CAST(rc.amount AS INT) AS amount,
            rc.purchase_date,
            rc.completion_exam_date,
            rc.validity_from,
            rc.validity_to,
            rc.supporting_document_path,
            rc.status,
            rc.processing_status,
            rc.submitted_on,
            rc.created_at,
            pr.payment_slip_path,
            pr.payment_slip_name,
            pr.payment_description,
            CONVERT(VARCHAR(10), pr.created_at, 120) AS paid_on,
            pr.paid_by,
            pr.payment_code
        FROM dbo.lms_reimbursement_claims rc
        LEFT JOIN dbo.CourseProviders cp ON rc.provider_id = cp.ProviderId
        LEFT JOIN dbo.CourseCategories cc ON rc.category_id = cc.CategoryId
        LEFT JOIN dbo.lms_payment_records pr ON (pr.claim_type = 'Certification' AND pr.request_code = rc.claim_code)
        WHERE 1=1
    """
    params = []
    if employee_id is not None:
        emp_clean = str(employee_id).strip()
        query += " AND rc.employee_id = ?"
        params.append(emp_clean)
    if status is not None:
        query += " AND rc.status = ?"
        params.append(status)
    if processing_status is not None:
        query += " AND rc.processing_status = ?"
        params.append(processing_status)

    query += " ORDER BY rc.id DESC"
    cursor.execute(query, tuple(params))
    return dictfetchall(cursor)

def get_claim_by_id(cursor, claim_id: int) -> Optional[Dict[str, Any]]:
    query = """
        SELECT 
            rc.id,
            rc.claim_code,
            rc.employee_id,
            'Certification' AS claim_type,
            rc.certification_name,
            rc.provider_id,
            COALESCE(cp.ProviderName, 'Udemy') AS provider_name,
            rc.category_id,
            COALESCE(cc.CategoryName, 'General') AS category_name,
            CAST(rc.amount AS INT) AS amount,
            rc.purchase_date,
            rc.completion_exam_date,
            rc.validity_from,
            rc.validity_to,
            rc.supporting_document_path,
            rc.status,
            rc.processing_status,
            rc.submitted_on,
            rc.created_at,
            pr.payment_slip_path,
            pr.payment_slip_name,
            pr.payment_description,
            CONVERT(VARCHAR(10), pr.created_at, 120) AS paid_on,
            pr.paid_by,
            pr.payment_code
        FROM dbo.lms_reimbursement_claims rc
        LEFT JOIN dbo.CourseProviders cp ON rc.provider_id = cp.ProviderId
        LEFT JOIN dbo.CourseCategories cc ON rc.category_id = cc.CategoryId
        LEFT JOIN dbo.lms_payment_records pr ON (pr.claim_type = 'Certification' AND pr.request_code = rc.claim_code)
        WHERE rc.id = ?
    """
    cursor.execute(query, (claim_id,))
    return dictfetchone(cursor)

def get_claim_by_code(cursor, claim_code: str) -> Optional[Dict[str, Any]]:
    query = """
        SELECT 
            rc.id,
            rc.claim_code,
            rc.employee_id,
            'Certification' AS claim_type,
            rc.certification_name,
            rc.provider_id,
            COALESCE(cp.ProviderName, 'Udemy') AS provider_name,
            rc.category_id,
            COALESCE(cc.CategoryName, 'General') AS category_name,
            CAST(rc.amount AS INT) AS amount,
            rc.purchase_date,
            rc.completion_exam_date,
            rc.validity_from,
            rc.validity_to,
            rc.supporting_document_path,
            rc.status,
            rc.processing_status,
            rc.submitted_on,
            rc.created_at,
            pr.payment_slip_path,
            pr.payment_slip_name,
            pr.payment_description,
            CONVERT(VARCHAR(10), pr.created_at, 120) AS paid_on,
            pr.paid_by,
            pr.payment_code
        FROM dbo.lms_reimbursement_claims rc
        LEFT JOIN dbo.CourseProviders cp ON rc.provider_id = cp.ProviderId
        LEFT JOIN dbo.CourseCategories cc ON rc.category_id = cc.CategoryId
        LEFT JOIN dbo.lms_payment_records pr ON (pr.claim_type = 'Certification' AND pr.request_code = rc.claim_code)
        WHERE rc.claim_code = ?
    """
    cursor.execute(query, (claim_code,))
    return dictfetchone(cursor)

def insert_claim(
    cursor,
    claim_code: str,
    employee_id: str,
    certification_name: str,
    amount: float,
    purchase_date: str,
    completion_exam_date: Optional[str] = None,
    provider_name: Optional[str] = None,
    provider_id: Optional[int] = None,
    category_id: Optional[int] = None,
    validity_from: Optional[str] = None,
    validity_to: Optional[str] = None,
    supporting_document_path: Optional[str] = None,
    claim_type: str = "Certification",
    status: str = "Pending",
    processing_status: str = "Submitted to HR",
    created_by: str = "SYSTEM"
) -> int:
    emp_clean = str(employee_id).strip()[:7]
    creator_clean = str(created_by).strip()[:7]

    query = """
        INSERT INTO dbo.lms_reimbursement_claims (
            claim_code,
            employee_id,
            certification_name,
            provider_id,
            category_id,
            amount,
            purchase_date,
            completion_exam_date,
            validity_from,
            validity_to,
            supporting_document_path,
            status,
            processing_status,
            submitted_on,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(GETDATE() AS DATE), GETDATE())
    """
    cursor.execute(
        query,
        (
            claim_code,
            emp_clean,
            certification_name[:150],
            provider_id,
            category_id,
            int(amount),
            purchase_date,
            completion_exam_date,
            validity_from,
            validity_to,
            supporting_document_path[:500] if supporting_document_path else None,
            status[:20],
            processing_status[:20]
        )
    )
    cursor.execute("SELECT @@IDENTITY AS id")
    row = cursor.fetchone()
    return int(row[0]) if row and row[0] else 0

def insert_claim_stages(
    cursor,
    claim_identifier: Any,
    created_by: str = "SYSTEM"
) -> None:
    """
    Initializes the 5 approval timeline stages in dbo.lms_reimbursement_claim_stages:
    1. Employee Request (Completed)
    2. Notified to RM (Completed)
    3. L&D status (Completed)
    4. HR Approval (Pending)
    5. Reimbursed (Pending)
    """
    req_code = str(claim_identifier).strip()
    if isinstance(claim_identifier, int) or req_code.isdigit():
        cursor.execute("SELECT claim_code FROM dbo.lms_reimbursement_claims WHERE id = ?", (int(req_code),))
        r = cursor.fetchone()
        if r and r[0]:
            req_code = str(r[0])

    creator_clean = str(created_by).strip()[:7]
    stages = [
        ("Employee Request", "Completed", True),
        ("Notified to RM", "Completed", True),
        ("L&D status", "Completed", True),
        ("HR Approval", "Pending", False),
        ("Reimbursed", "Pending", False),
    ]

    for stage_name, stage_status, has_date in stages:
        cursor.execute(
            """
            INSERT INTO dbo.lms_reimbursement_claim_stages (
                request_code,
                stage_name,
                stage_status,
                stage_date,
                created_at,
                created_by,
                updated_at,
                updated_by
            )
            VALUES (?, ?, ?, CASE WHEN ? = 1 THEN CAST(GETDATE() AS DATE) ELSE NULL END, GETDATE(), ?, GETDATE(), ?)
            """,
            (req_code, stage_name, stage_status, 1 if has_date else 0, creator_clean, creator_clean)
        )

def get_claim_stages(
    cursor,
    claim_identifier: Any,
    employee_id: Optional[str] = None,
    certification_name: Optional[str] = None
) -> List[Dict[str, Any]]:
    clean_id = str(claim_identifier).strip()
    req_code = clean_id
    claim_row = None

    if isinstance(claim_identifier, int) or clean_id.isdigit():
        cursor.execute("""
            SELECT id, claim_code, employee_id, certification_name, status, processing_status, submitted_on, created_at
            FROM dbo.lms_reimbursement_claims WHERE id = ?
        """, (int(clean_id),))
        claim_row = dictfetchone(cursor)
        if claim_row and claim_row.get("claim_code"):
            req_code = str(claim_row["claim_code"])
    else:
        cursor.execute("""
            SELECT id, claim_code, employee_id, certification_name, status, processing_status, submitted_on, created_at
            FROM dbo.lms_reimbursement_claims WHERE claim_code = ?
        """, (clean_id,))
        claim_row = dictfetchone(cursor)

    emp_id = (claim_row.get("employee_id") if claim_row else None) or employee_id
    cert_name = (claim_row.get("certification_name") if claim_row else None) or certification_name

    matched_cr = None
    if emp_id and cert_name:
        cursor.execute("""
            SELECT TOP 1 cr.id, cr.status, cr.is_ceo_bypassed, cr.request_code, cr.created_at
            FROM dbo.lms_certification_requests cr
            WHERE cr.employee_id = ?
              AND LOWER(LTRIM(RTRIM(cr.certification_name))) = LOWER(LTRIM(RTRIM(?)))
            ORDER BY CASE WHEN cr.status = 'Approved' THEN 0 ELSE 1 END, cr.id DESC
        """, (str(emp_id).strip(), str(cert_name).strip()))
        matched_cr = dictfetchone(cursor)

    if matched_cr:
        cursor.execute("""
            SELECT 
                crs.id,
                crs.request_id,
                crs.stage_name,
                crs.stage_status,
                CONVERT(VARCHAR(10), crs.stage_date, 120) AS stage_date
            FROM dbo.lms_certification_request_stages crs
            WHERE crs.request_id = ?
            ORDER BY crs.id ASC
        """, (matched_cr["id"],))
        cert_stages = dictfetchall(cursor)

        stages = []
        for s in cert_stages:
            stg_name = s.get("stage_name")
            if stg_name == "Employee":
                stg_name = "Employee Request"
            stages.append({
                "id": s.get("id"),
                "stage_name": stg_name,
                "stage_status": s.get("stage_status") or "Completed",
                "stage_date": s.get("stage_date"),
                "source": "lms_certification_request_stages"
            })

        # Upfront management approval status
        cr_status = (matched_cr.get("status") or "").lower()
        is_upfront_pending = cr_status == "pending" or any((s.get("stage_status") or "").lower() == "pending" for s in cert_stages)
        is_upfront_rejected = cr_status == "rejected" or any((s.get("stage_status") or "").lower() == "rejected" for s in cert_stages)

        # 5. HR Claim Approval stage
        hr_status = (claim_row.get("status") if claim_row else None) or "Pending"
        cursor.execute("""
            SELECT stage_status, CONVERT(VARCHAR(10), stage_date, 120) AS stage_date
            FROM dbo.lms_reimbursement_claim_stages
            WHERE request_code = ? AND stage_name IN ('HR Approval', 'HR Claim Approval')
        """, (req_code,))
        hr_s = dictfetchone(cursor)
        hr_date = hr_s.get("stage_date") if hr_s else None

        if is_upfront_rejected:
            hr_stage_status = "Rejected"
            hr_date = None
        elif is_upfront_pending:
            hr_stage_status = "Upcoming"
            hr_date = None
        else:
            hr_stage_status = "Completed" if hr_status == "Approved" else (hr_status if hr_status == "Rejected" else "Pending")

        stages.append({
            "stage_name": "HR Claim Approval",
            "stage_status": hr_stage_status,
            "stage_date": hr_date
        })

        # 6. Claimed / Reimbursed stage
        cursor.execute("""
            SELECT CONVERT(VARCHAR(10), created_at, 120) AS paid_on
            FROM dbo.lms_payment_records
            WHERE claim_type = 'Certification' AND request_code = ?
        """, (req_code,))
        p = dictfetchone(cursor)
        is_paid = ((claim_row.get("processing_status") or "").lower() == "paid") if claim_row else False
        if p and p.get("paid_on"):
            is_paid = True

        if is_upfront_rejected or is_upfront_pending:
            claimed_status = "Upcoming"
            paid_date = None
        else:
            claimed_status = "Completed" if is_paid else "Upcoming"
            paid_date = p.get("paid_on") if p else None

        stages.append({
            "stage_name": "Claimed",
            "stage_status": claimed_status,
            "stage_date": paid_date
        })
        return stages

    # Fallback to dbo.lms_reimbursement_claim_stages if no upfront request found
    query = """
        SELECT 
            id,
            request_code,
            stage_name,
            stage_status,
            CONVERT(VARCHAR(10), stage_date, 120) AS stage_date
        FROM dbo.lms_reimbursement_claim_stages
        WHERE request_code = ?
        ORDER BY id ASC
    """
    cursor.execute(query, (req_code,))
    return dictfetchall(cursor)

def update_claim_status(
    cursor,
    claim_id: int,
    status: str,
    processing_status: Optional[str] = None,
    comments: Optional[str] = None,
    updated_by: Optional[str] = None
) -> None:
    query = """
        UPDATE dbo.lms_reimbursement_claims
        SET status = ?,
            processing_status = COALESCE(?, processing_status)
        WHERE id = ?
    """
    cursor.execute(query, (status[:20], processing_status[:20] if processing_status else None, claim_id))

def update_stages_on_hr_decision(
    cursor,
    claim_identifier: Any = None,
    status: str = "Approved",
    updated_by: Optional[str] = None,
    claim_id: Any = None
) -> None:
    target = claim_id if claim_id is not None else claim_identifier
    clean_id = str(target).strip()
    req_code = clean_id
    if isinstance(target, int) or clean_id.isdigit():
        cursor.execute("SELECT claim_code FROM dbo.lms_reimbursement_claims WHERE id = ?", (int(clean_id),))
        r = cursor.fetchone()
        if r and r[0]:
            req_code = str(r[0])

    updater_clean = str(updated_by).strip()[:7] if updated_by and str(updated_by).strip() else None
    stage_st = "Completed" if status == "Approved" else "Rejected"

    # Update HR Approval stage
    cursor.execute(
        """
        UPDATE dbo.lms_reimbursement_claim_stages
        SET stage_status = ?,
            stage_date = CAST(GETDATE() AS DATE),
            updated_at = GETDATE(),
            updated_by = ?
        WHERE request_code = ? AND stage_name = 'HR Approval'
        """,
        (stage_st, updater_clean, req_code)
    )

    # Only if Rejected, mark Reimbursed stage as Rejected too.
    # If Approved, Reimbursed stage remains 'Pending' until payment slip is uploaded and paid.
    if status == "Rejected":
        cursor.execute(
            """
            UPDATE dbo.lms_reimbursement_claim_stages
            SET stage_status = 'Rejected',
                stage_date = NULL,
                updated_at = GETDATE(),
                updated_by = ?
            WHERE request_code = ? AND stage_name = 'Reimbursed'
            """,
            (updater_clean, req_code)
        )

def insert_spend_category(
    cursor,
    spend_category: str,
    department: str,
    amount: float,
    created_by: Optional[str] = None
) -> None:
    creator_clean = str(created_by).strip()[:7] if created_by and str(created_by).strip() else None
    cursor.execute(
        """
        INSERT INTO dbo.lms_spend_category (
            spend_category,
            department,
            amount,
            spend_date,
            created_at,
            created_by
        )
        VALUES (?, ?, ?, CAST(GETDATE() AS DATE), GETDATE(), ?)
        """,
        (spend_category[:30], department[:100], amount, creator_clean)
    )

def update_claim_payment_slip(
    cursor,
    claim_id: int
) -> None:
    """
    Marks an Approved claim as Paid. Payment slip, description, payment date,
    and HR actor are stored in dbo.lms_payment_records.
    """
    cursor.execute(
        """
        UPDATE dbo.lms_reimbursement_claims
        SET processing_status = 'Paid'
        WHERE id = ?
        """,
        (claim_id,)
    )


def insert_hr_activity(
    cursor,
    activity_type: str,
    message: str,
    created_by: Optional[str] = None
) -> None:
    creator_clean = str(created_by).strip()[:7] if created_by and str(created_by).strip() else None
    cursor.execute(
        """
        INSERT INTO dbo.lms_hr_activity_feed (
            activity_type,
            message,
            created_at,
            created_by
        )
        VALUES (?, ?, GETDATE(), ?)
        """,
        (activity_type[:30], message[:255], creator_clean)
    )
