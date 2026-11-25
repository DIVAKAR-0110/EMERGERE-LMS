"""
Employee Certification Repository.
Data access layer for dbo.lms_employee_certificates table.
Pure parameterized SQL execution adhering strictly to lms_schema.sql.
"""

from typing import List, Dict, Any, Optional
from database.connection import dictfetchall, dictfetchone
from constants.course_metadata import resolve_provider_name


def ensure_employee_profile(cursor, employee_id: str, azure_user_id: Optional[str] = None) -> None:
    """Ensures employee profile exists in dbo.lms_employee_profiles with real Microsoft Object ID."""
    if not employee_id:
        return
    clean_emp = str(employee_id)[:7]
    real_oid = azure_user_id
    if not real_oid:
        try:
            from services.common.auth_service import employee_service
            emp = employee_service.get_employee_by_id(clean_emp)
            if emp:
                real_oid = emp.get("microsoft_object_id")
        except Exception:
            pass

    from repositories.common import profile_repository
    profile_repository.ensure_or_sync_profile(cursor, clean_emp, real_oid)


def insert_employee_certificate(
    cursor,
    employee_id: str,
    certification_name: str,
    certificate_type: Optional[str] = "Course Completion Certificate",
    certificate_id: Optional[str] = None,
    certification_domain: Optional[str] = None,
    provider_id: Optional[int] = None,
    category_id: Optional[int] = None,
    domain_id: Optional[int] = None,
    issue_date: Optional[str] = None,
    expiry_date: Optional[str] = None,
    certificate_file_path: Optional[str] = None,
    supporting_document_path: Optional[str] = None,
    created_by: Optional[str] = None,
) -> int:
    """
    Inserts a record into dbo.lms_employee_certificates.
    Enforces dates check constraint: expiry_date is null or >= issue_date.
    """
    if not employee_id or not str(employee_id).strip():
        raise ValueError("employee_id is required to record an employee certificate.")
    clean_emp = str(employee_id).strip()[:7]
    ensure_employee_profile(cursor, clean_emp)

    # Resolve domain_id if not explicitly provided
    resolved_domain_id = domain_id
    if not resolved_domain_id and certification_domain:
        try:
            from repositories.common.certification_domain_repository import certification_domain_repository
            resolved_domain_id = certification_domain_repository.resolve_domain_id(certification_domain, cursor=cursor)
        except Exception:
            resolved_domain_id = None

    clean_creator = str(created_by)[:7] if created_by else clean_emp
    clean_title = str(certification_name)[:150]
    clean_type = str(certificate_type)[:50] if certificate_type else None
    clean_cert_id = str(certificate_id)[:50] if certificate_id else None
    clean_cert_path = str(certificate_file_path)[:500] if certificate_file_path else None
    clean_supp_path = str(supporting_document_path)[:500] if supporting_document_path else None

    # Date normalization / validation for CK_lms_employee_certificates_dates
    clean_issue = str(issue_date)[:10] if issue_date and str(issue_date).strip() else None
    clean_expiry = str(expiry_date)[:10] if expiry_date and str(expiry_date).strip() else None
    if clean_expiry and clean_issue and clean_expiry < clean_issue:
        clean_expiry = None

    query = """
        SET NOCOUNT ON;
        INSERT INTO dbo.lms_employee_certificates (
            employee_id,
            certification_name,
            certificate_type,
            certificate_id,
            provider_id,
            category_id,
            domain_id,
            issue_date,
            expiry_date,
            certificate_file_path,
            supporting_document_path,
            created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        SELECT SCOPE_IDENTITY() AS id;
    """
    cursor.execute(
        query,
        (
            clean_emp,
            clean_title,
            clean_type,
            clean_cert_id,
            provider_id,
            category_id,
            resolved_domain_id,
            clean_issue,
            clean_expiry,
            clean_cert_path,
            clean_supp_path,
            clean_creator
        )
    )
    row = cursor.fetchone()
    if row and row[0] is not None:
        inserted_id = int(row[0])
    else:
        # Fallback identity query if multi-statement doesn't return
        cursor.execute("SELECT @@IDENTITY AS id")
        row = cursor.fetchone()
        inserted_id = int(row[0]) if row and row[0] else 0

    from repositories.common import profile_repository
    profile_repository.sync_profile_certifications_list(cursor, clean_emp)
    return inserted_id


def get_employee_certificates(
    cursor,
    employee_id: str
) -> List[Dict[str, Any]]:
    """Retrieves all certificates for an employee ordered by issue date desc."""
    if not employee_id or not str(employee_id).strip():
        return []
    clean_emp = str(employee_id).strip()[:7]
    query = """
        SELECT 
            c.id,
            c.employee_id,
            c.certification_name,
            c.certificate_type,
            c.certificate_id,
            c.provider_id,
            COALESCE(cp.ProviderName, 'Udemy') AS provider_name,
            c.category_id,
            c.domain_id,
            COALESCE(cd.domain_name, cc.CategoryName, 'Technical') AS certification_domain,
            COALESCE(cd.domain_name, cc.CategoryName, 'Technical') AS domain,
            CONVERT(VARCHAR(10), c.issue_date, 120) AS issue_date,
            CONVERT(VARCHAR(10), c.expiry_date, 120) AS expiry_date,
            c.certificate_file_path,
            c.supporting_document_path,
            CONVERT(VARCHAR(19), c.created_at, 120) AS created_at,
            c.created_by
        FROM dbo.lms_employee_certificates c
        LEFT JOIN dbo.CourseProviders cp ON c.provider_id = cp.ProviderId
        LEFT JOIN dbo.CourseCategories cc ON c.category_id = cc.CategoryId
        LEFT JOIN dbo.lms_certification_domains cd ON c.domain_id = cd.domain_id
        WHERE c.employee_id = ?
        ORDER BY c.created_at DESC, c.id DESC
    """
    cursor.execute(query, (clean_emp,))
    return dictfetchall(cursor)


def get_certificate_by_id(
    cursor,
    cert_id: int,
    employee_id: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """Retrieves a single certificate by primary key id."""
    if employee_id:
        clean_emp = str(employee_id)[:7]
        query = """
            SELECT 
                c.id,
                c.employee_id,
                c.certification_name,
                c.certificate_type,
                c.certificate_id,
                c.provider_id,
                COALESCE(cp.ProviderName, 'Udemy') AS provider_name,
                c.category_id,
                c.domain_id,
                COALESCE(cd.domain_name, cc.CategoryName, 'Technical') AS certification_domain,
                COALESCE(cd.domain_name, cc.CategoryName, 'Technical') AS domain,
                CONVERT(VARCHAR(10), c.issue_date, 120) AS issue_date,
                CONVERT(VARCHAR(10), c.expiry_date, 120) AS expiry_date,
                c.certificate_file_path,
                c.supporting_document_path,
                CONVERT(VARCHAR(19), c.created_at, 120) AS created_at,
                c.created_by
            FROM dbo.lms_employee_certificates c
            LEFT JOIN dbo.CourseProviders cp ON c.provider_id = cp.ProviderId
            LEFT JOIN dbo.CourseCategories cc ON c.category_id = cc.CategoryId
            LEFT JOIN dbo.lms_certification_domains cd ON c.domain_id = cd.domain_id
            WHERE c.id = ? AND c.employee_id = ?
        """
        cursor.execute(query, (cert_id, clean_emp))
    else:
        query = """
            SELECT 
                c.id,
                c.employee_id,
                c.certification_name,
                c.certificate_type,
                c.certificate_id,
                c.provider_id,
                COALESCE(cp.ProviderName, 'Udemy') AS provider_name,
                c.category_id,
                c.domain_id,
                COALESCE(cd.domain_name, cc.CategoryName, 'Technical') AS certification_domain,
                COALESCE(cd.domain_name, cc.CategoryName, 'Technical') AS domain,
                CONVERT(VARCHAR(10), c.issue_date, 120) AS issue_date,
                CONVERT(VARCHAR(10), c.expiry_date, 120) AS expiry_date,
                c.certificate_file_path,
                c.supporting_document_path,
                CONVERT(VARCHAR(19), c.created_at, 120) AS created_at,
                c.created_by
            FROM dbo.lms_employee_certificates c
            LEFT JOIN dbo.CourseProviders cp ON c.provider_id = cp.ProviderId
            LEFT JOIN dbo.CourseCategories cc ON c.category_id = cc.CategoryId
            LEFT JOIN dbo.lms_certification_domains cd ON c.domain_id = cd.domain_id
            WHERE c.id = ?
        """
        cursor.execute(query, (cert_id,))
    return dictfetchone(cursor)


def delete_employee_certificate(
    cursor,
    cert_id: int,
    employee_id: Optional[str] = None
) -> bool:
    """Deletes a certificate record by id and refreshes profile certification IDs."""
    target_emp = str(employee_id)[:7] if employee_id else None
    if not target_emp:
        cursor.execute("SELECT employee_id FROM dbo.lms_employee_certificates WHERE id = ?", (cert_id,))
        emp_row = cursor.fetchone()
        target_emp = str(emp_row[0])[:7] if emp_row and emp_row[0] else None

    if employee_id:
        clean_emp = str(employee_id)[:7]
        query = "DELETE FROM dbo.lms_employee_certificates WHERE id = ? AND employee_id = ?"
        cursor.execute(query, (cert_id, clean_emp))
    else:
        query = "DELETE FROM dbo.lms_employee_certificates WHERE id = ?"
        cursor.execute(query, (cert_id,))

    deleted = bool(cursor.rowcount and cursor.rowcount > 0)
    if deleted and target_emp:
        from repositories.common import profile_repository
        profile_repository.sync_profile_certifications_list(cursor, target_emp)
    return deleted


def get_certifications_by_employee_ids(
    cursor,
    employee_ids: List[str]
) -> List[Dict[str, Any]]:
    """Retrieves all certificates for a list of employee IDs (team / department)."""
    if not employee_ids:
        return []

    clean_ids = [str(e)[:7] for e in employee_ids if e]
    if not clean_ids:
        return []

    placeholders = ", ".join(["?"] * len(clean_ids))
    query = f"""
        SELECT 
            c.id,
            c.employee_id,
            c.certification_name,
            c.certificate_type,
            c.certificate_id,
            c.domain_id,
            COALESCE(cd.domain_name, 'Technical') AS certification_domain,
            COALESCE(cd.domain_name, 'Technical') AS domain,
            CONVERT(VARCHAR(10), c.issue_date, 120) AS issue_date,
            CONVERT(VARCHAR(10), c.expiry_date, 120) AS expiry_date,
            c.certificate_file_path,
            c.supporting_document_path,
            CONVERT(VARCHAR(19), c.created_at, 120) AS created_at,
            c.created_by
        FROM dbo.lms_employee_certificates c
        LEFT JOIN dbo.lms_certification_domains cd ON c.domain_id = cd.domain_id
        WHERE c.employee_id IN ({placeholders})
        ORDER BY c.created_at DESC, c.id DESC
    """
    cursor.execute(query, tuple(clean_ids))
    return dictfetchall(cursor)


def get_all_employee_certifications_with_profiles(
    cursor
) -> List[Dict[str, Any]]:
    """Retrieves all employee certificates across enterprise."""
    query = """
        SELECT 
            c.id,
            c.employee_id,
            c.certification_name,
            c.certificate_type,
            c.certificate_id,
            c.domain_id,
            COALESCE(cd.domain_name, 'Technical') AS certification_domain,
            COALESCE(cd.domain_name, 'Technical') AS domain,
            CONVERT(VARCHAR(10), c.issue_date, 120) AS issue_date,
            CONVERT(VARCHAR(10), c.expiry_date, 120) AS expiry_date,
            c.certificate_file_path,
            c.supporting_document_path,
            CONVERT(VARCHAR(19), c.created_at, 120) AS created_at,
            c.created_by
        FROM dbo.lms_employee_certificates c
        LEFT JOIN dbo.lms_certification_domains cd ON c.domain_id = cd.domain_id
        ORDER BY c.created_at DESC, c.id DESC
    """
    cursor.execute(query)
    return dictfetchall(cursor)
