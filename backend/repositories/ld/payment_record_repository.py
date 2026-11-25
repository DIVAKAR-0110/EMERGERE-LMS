"""
Payment Records Repository.
Data access layer for dbo.lms_payment_records.
Tracks all payment slips and disbursement records for Course & Certification reimbursements.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
from database.connection import dictfetchall, dictfetchone, is_sql_server


def generate_next_payment_code(cursor) -> str:
    """
    Generates a sequential payment code in format PAY-YYYY-XXXX (e.g., PAY-2026-0001).
    """
    current_year = datetime.now().year
    prefix = f"PAY-{current_year}-"
    lock_hint = " WITH (UPDLOCK, HOLDLOCK)" if is_sql_server() else ""

    query = f"""
        SELECT payment_code
        FROM dbo.lms_payment_records{lock_hint}
        WHERE payment_code LIKE ?
        ORDER BY id DESC
    """
    cursor.execute(query, (f"{prefix}%",))
    rows = cursor.fetchall()

    max_seq = 0
    for r in rows:
        code_str = r[0] if (isinstance(r, (list, tuple)) or hasattr(r, '__getitem__')) else getattr(r, "payment_code", None)
        if code_str and str(code_str).startswith(prefix):
            suffix = str(code_str)[len(prefix):]
            if suffix.isdigit():
                val = int(suffix)
                if val > max_seq:
                    max_seq = val

    next_seq = max_seq + 1
    return f"{prefix}{next_seq:04d}"


def insert_payment_record(
    cursor,
    payment_code: str,
    request_code: str,
    claim_type: str,
    employee_id: str,
    title: str,
    amount: int,
    payment_slip_path: Optional[str],
    payment_slip_name: Optional[str],
    payment_description: Optional[str],
    paid_by: str,
    employee_name: Optional[str] = None,
    reference_id: Optional[int] = None,
) -> int:
    """
    Inserts a permanent record into dbo.lms_payment_records.
    """
    emp_clean = str(employee_id).strip()[:7]
    paid_by_clean = str(paid_by).strip()[:7]
    title_clean = str(title).strip()[:200]
    req_code_clean = str(request_code).strip()[:50]
    claim_type_clean = str(claim_type).strip()[:20]

    query = """
        INSERT INTO dbo.lms_payment_records (
            payment_code,
            request_code,
            claim_type,
            employee_id,
            title,
            amount,
            payment_slip_path,
            payment_slip_name,
            payment_description,
            paid_by,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, SYSDATETIME())
    """
    cursor.execute(
        query,
        (
            payment_code,
            req_code_clean,
            claim_type_clean,
            emp_clean,
            title_clean,
            int(amount),
            payment_slip_path[:500] if payment_slip_path else None,
            payment_slip_name[:255] if payment_slip_name else None,
            payment_description[:500] if payment_description else None,
            paid_by_clean,
        )
    )
    cursor.execute("SELECT @@IDENTITY AS id")
    row = cursor.fetchone()
    return int(row[0]) if row and row[0] else 0


def get_payment_record_by_request_code(cursor, request_code: str) -> Optional[Dict[str, Any]]:
    query = """
        SELECT 
            id,
            payment_code,
            request_code,
            claim_type,
            employee_id,
            title,
            amount,
            payment_slip_path,
            payment_slip_name,
            payment_description,
            paid_by,
            CONVERT(VARCHAR(10), created_at, 120) AS paid_on,
            created_at
        FROM dbo.lms_payment_records
        WHERE request_code = ?
        ORDER BY id DESC
    """
    cursor.execute(query, (str(request_code).strip(),))
    row = dictfetchone(cursor)
    if row and row.get("employee_id"):
        from services.common.auth_service import employee_service
        emp = employee_service.get_employee_by_id(row["employee_id"])
        row["employee_name"] = emp.get("name") if emp else None
    return row


def get_payment_record_by_id(cursor, payment_id: int) -> Optional[Dict[str, Any]]:
    query = """
        SELECT 
            id,
            payment_code,
            request_code,
            claim_type,
            employee_id,
            title,
            amount,
            payment_slip_path,
            payment_slip_name,
            payment_description,
            paid_by,
            CONVERT(VARCHAR(10), created_at, 120) AS paid_on,
            created_at
        FROM dbo.lms_payment_records
        WHERE id = ?
    """
    cursor.execute(query, (payment_id,))
    row = dictfetchone(cursor)
    if row and row.get("employee_id"):
        from services.common.auth_service import employee_service
        emp = employee_service.get_employee_by_id(row["employee_id"])
        row["employee_name"] = emp.get("name") if emp else None
    return row


def get_all_payment_records(
    cursor,
    employee_id: Optional[str] = None,
    claim_type: Optional[str] = None,
) -> List[Dict[str, Any]]:
    query = """
        SELECT 
            id,
            payment_code,
            request_code,
            claim_type,
            employee_id,
            title,
            amount,
            payment_slip_path,
            payment_slip_name,
            payment_description,
            paid_by,
            CONVERT(VARCHAR(10), created_at, 120) AS paid_on,
            created_at
        FROM dbo.lms_payment_records
        WHERE 1=1
    """
    params = []
    if employee_id:
        query += " AND employee_id = ?"
        params.append(str(employee_id).strip())
    if claim_type:
        query += " AND claim_type = ?"
        params.append(str(claim_type).strip())

    query += " ORDER BY id DESC"
    cursor.execute(query, tuple(params))
    rows = dictfetchall(cursor)

    # Attach employee_name dynamically
    if rows:
        from services.common.auth_service import employee_service
        all_emps = employee_service.get_all_employees()
        emp_map = {str(e.get("employee_id", "")).strip().upper(): e.get("name") for e in all_emps if e.get("employee_id")}
        for r in rows:
            e_id = str(r.get("employee_id") or "").strip().upper()
            r["employee_name"] = emp_map.get(e_id) or None

    return rows
    params = []
    if employee_id:
        query += " AND employee_id = ?"
        params.append(str(employee_id).strip())
    if claim_type:
        query += " AND claim_type = ?"
        params.append(str(claim_type).strip())

    query += " ORDER BY id DESC"
    cursor.execute(query, tuple(params))
    return dictfetchall(cursor)
