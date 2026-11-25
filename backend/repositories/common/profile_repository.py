"""
Profile Repository.
Handles persistent data access for dbo.lms_employee_profiles (master profile, skills, and interests)
and dbo.lms_employee_certificates (employee certifications).
Pure parameterized SQL queries conforming to SQL Server database schema.
"""

import json
from typing import List, Dict, Any, Optional
from database.connection import dictfetchall, dictfetchone, is_sql_server
from dateutil import parser
from constants.course_metadata import resolve_provider_name
from repositories.common.course_metadata_repository import course_metadata_repository

def parse_json_list(raw_val: Optional[Any]) -> List[str]:
    """Safely parses JSON list from SQL Server NVARCHAR(MAX) column or handles fallback."""
    if not raw_val:
        return []
    if isinstance(raw_val, list):
        return raw_val
    try:
        data = json.loads(raw_val)
        return data if isinstance(data, list) else []
    except Exception:
        return [s.strip() for s in str(raw_val).split(",") if s.strip()]

def parse_to_sql_date(val: Optional[str]) -> Optional[str]:
    """Safely normalizes input date string into YYYY-MM-DD SQL format."""
    if not val:
        return None
    val_str = str(val).strip()
    if not val_str or val_str.lower() in ("none", "null", "#", ""):
        return None
    try:
        dt = parser.parse(val_str)
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return None

def ensure_or_sync_profile(
    cursor,
    employee_id: str,
    azure_user_id: Optional[str] = None,
    linkedin_url: Optional[str] = None,
    created_by: Optional[str] = None
) -> str:
    """
    Ensures employee profile exists in dbo.lms_employee_profiles keyed strictly on employee_id.
    Updates linkedin_url if missing, otherwise inserts an initial record.
    Returns the canonical employee_id primary key.
    """
    clean_emp = str(employee_id).strip()[:7]
    cursor.execute(
        "SELECT employee_id, linkedin_url FROM dbo.lms_employee_profiles WHERE LOWER(employee_id) = LOWER(?)",
        (clean_emp,)
    )
    row = cursor.fetchone()

    if row:
        canonical_emp = row[0]
        cur_link = row[1]

        if linkedin_url and (not cur_link or cur_link != linkedin_url):
            cursor.execute(
                "UPDATE dbo.lms_employee_profiles SET linkedin_url = ?, updated_at = GETDATE() WHERE employee_id = ?",
                (str(linkedin_url)[:255], canonical_emp)
            )
        return canonical_emp

    # Insert initial profile
    query = """
        INSERT INTO dbo.lms_employee_profiles (
            employee_id, linkedin_url, created_at, created_by, updated_at
        )
        VALUES (?, ?, GETDATE(), ?, GETDATE());
    """
    cursor.execute(
        query,
        (
            clean_emp,
            str(linkedin_url)[:255] if linkedin_url else None,
            str(created_by or clean_emp)[:7]
        )
    )
    return clean_emp

def has_completed_profile(profile_row: Optional[Dict[str, Any]]) -> bool:
    """
    Returns True only when the employee has populated the mandatory onboarding fields
    (professional summary, technical skills, workplace skills, areas of expertise,
    learning interests, and mandatory LinkedIn profile URL), ignoring auto-provisioned skeleton rows.
    """
    if not profile_row:
        return False

    summary = str(
        profile_row.get("professional_summary")
        or profile_row.get("about_me")
        or ""
    ).strip()
    tech = parse_json_list(profile_row.get("technical_skills"))
    workplace = parse_json_list(
        profile_row.get("workplace_skills")
        if profile_row.get("workplace_skills") is not None
        else profile_row.get("professional_skills")
    )
    expertise = parse_json_list(
        profile_row.get("area_of_expertise")
        if profile_row.get("area_of_expertise") is not None
        else profile_row.get("areas_of_expertise")
    )
    interests = parse_json_list(profile_row.get("learning_interests"))
    linkedin = str(profile_row.get("linkedin_url") or "").strip()
    return bool(summary and tech and workplace and expertise and interests and linkedin)


def is_profile_completed(cursor, employee_id: Optional[str] = None, azure_user_id: Optional[str] = None) -> bool:
    """
    Checks whether the employee has completed their onboarding profile in dbo.lms_employee_profiles.
    Auto-created FK skeleton rows with empty onboarding fields return False so the
    FirstTimeProfileModal still opens on the employee's first login.
    """
    profile = None
    if employee_id:
        emp_clean = str(employee_id).strip()[:7]
        if emp_clean:
            profile = get_profile_by_employee_code(cursor, emp_clean)
    if not profile and azure_user_id:
        profile = get_profile_by_azure_oid(cursor, azure_user_id)
    return has_completed_profile(profile)

def get_profile_by_employee_code(cursor, employee_code: str) -> Optional[Dict[str, Any]]:
    """Retrieves full profile dictionary by employee_id from dbo.lms_employee_profiles."""
    query = """
        SELECT employee_id,
               employee_id AS profile_id,
               employee_id AS employee_code,
               linkedin_url,
               professional_summary,
               professional_summary AS about_me,
               technical_skills,
               workplace_skills,
               workplace_skills AS professional_skills,
               area_of_expertise,
               area_of_expertise AS areas_of_expertise,
               learning_interests,
               certifications,
               certifications AS certification_ids,
               created_at,
               created_by,
               updated_at
        FROM dbo.lms_employee_profiles
        WHERE LOWER(employee_id) = LOWER(?)
    """
    cursor.execute(query, (str(employee_code).strip(),))
    return dictfetchone(cursor)

def get_profile_by_azure_oid(cursor, azure_ad_oid: str) -> Optional[Dict[str, Any]]:
    """Resolves employee_id from Entra ID directory by OID and loads profile from dbo.lms_employee_profiles."""
    if not azure_ad_oid:
        return None
    from services.common.auth_service import employee_service
    oid_clean = str(azure_ad_oid).strip().lower()
    for emp in employee_service.get_all_employees():
        emp_oid = str(emp.get("microsoft_object_id") or "").strip().lower()
        if emp_oid and emp_oid == oid_clean and emp.get("employee_id"):
            return get_profile_by_employee_code(cursor, emp["employee_id"])
    return None

def upsert_employee_profile(
    cursor,
    azure_ad_oid: Optional[str] = None,
    employee_code: Optional[str] = None,
    user_principal_name: Optional[str] = None,
    about_me: Optional[str] = None,
    linkedin_url: Optional[str] = None,
    avatar_url: Optional[str] = None,
    technical_skills: Optional[List[str]] = None,
    professional_skills: Optional[List[str]] = None,
    areas_of_expertise: Optional[List[str]] = None,
    learning_interests: Optional[List[str]] = None,
    actor_email: str = "SYSTEM"
) -> str:
    """
    Consolidated upsert into dbo.lms_employee_profiles keyed strictly on employee_id.
    Updates master profile fields, JSON array columns, and audit attributes.
    Returns the canonical employee_id primary key.
    """
    clean_emp = str(employee_code).strip()[:7] if employee_code else None
    existing = None
    if clean_emp:
        existing = get_profile_by_employee_code(cursor, clean_emp)
    if not existing and azure_ad_oid:
        existing = get_profile_by_azure_oid(cursor, azure_ad_oid)

    clean_actor = (clean_emp or actor_email or "SYSTEM")[:7]

    tech_json = json.dumps(list(dict.fromkeys([s.strip() for s in technical_skills if s and s.strip()]))) if technical_skills is not None else None
    prof_json = json.dumps(list(dict.fromkeys([s.strip() for s in professional_skills if s and s.strip()]))) if professional_skills is not None else None
    area_json = json.dumps(list(dict.fromkeys([s.strip() for s in areas_of_expertise if s and s.strip()]))) if areas_of_expertise is not None else None
    interests_json = json.dumps(list(dict.fromkeys([s.strip() for s in learning_interests if s and s.strip()]))) if learning_interests is not None else None

    if existing:
        target_emp_id = existing["employee_id"]
        fields = ["updated_at = GETDATE()"]
        params = []

        if linkedin_url is not None:
            fields.append("linkedin_url = ?")
            params.append(str(linkedin_url)[:255] if linkedin_url else None)
        if about_me is not None:
            fields.append("professional_summary = ?")
            params.append(str(about_me).strip()[:250] if about_me else None)
        if technical_skills is not None:
            fields.append("technical_skills = ?")
            params.append(tech_json)
        if professional_skills is not None:
            fields.append("workplace_skills = ?")
            params.append(prof_json)
        if areas_of_expertise is not None:
            fields.append("area_of_expertise = ?")
            params.append(area_json)
        if learning_interests is not None:
            fields.append("learning_interests = ?")
            params.append(interests_json)

        query = f"UPDATE dbo.lms_employee_profiles SET {', '.join(fields)} WHERE employee_id = ?"
        params.append(target_emp_id)
        cursor.execute(query, tuple(params))
        return target_emp_id
    else:
        if not clean_emp:
            raise ValueError("employee_id is required to create an employee profile.")
        target_emp_id = clean_emp
        query = """
            INSERT INTO dbo.lms_employee_profiles (
                employee_id, linkedin_url, professional_summary,
                technical_skills, workplace_skills,
                area_of_expertise, learning_interests, created_at, created_by, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, GETDATE(), ?, GETDATE());
        """
        cursor.execute(
            query,
            (
                target_emp_id,
                str(linkedin_url)[:255] if linkedin_url else None,
                str(about_me).strip()[:250] if about_me else None,
                tech_json,
                prof_json,
                area_json,
                interests_json,
                clean_actor
            )
        )
        return target_emp_id

# ── Certifications ────────────────────────────────────────────────────────────

def sync_profile_certifications_list(cursor, employee_id: str) -> List[int]:
    """
    Synchronizes dbo.lms_employee_profiles.certifications as an ordered JSON array of
    dbo.lms_employee_certificates(id) foreign keys for the given employee.
    """
    if not employee_id or not str(employee_id).strip():
        return []
    clean_emp = str(employee_id).strip()[:7]
    canonical_emp = ensure_or_sync_profile(cursor, clean_emp, created_by=clean_emp)
    lock_hint = " WITH (UPDLOCK, HOLDLOCK)" if is_sql_server() else ""
    cursor.execute(
        f"""
        SELECT id
        FROM dbo.lms_employee_certificates{lock_hint}
        WHERE LOWER(employee_id) = LOWER(?)
        ORDER BY id ASC
        """,
        (canonical_emp,),
    )
    cert_ids = [int(row[0]) for row in cursor.fetchall() if row and row[0] is not None]
    certs_json = json.dumps(cert_ids) if cert_ids else None
    ts_expr = "GETDATE()" if is_sql_server() else "CURRENT_TIMESTAMP"
    cursor.execute(
        f"UPDATE dbo.lms_employee_profiles SET certifications = ?, updated_at = {ts_expr} WHERE employee_id = ?",
        (certs_json, canonical_emp),
    )
    return cert_ids


def get_certifications(cursor, profile_id: Any, employee_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Retrieves all certifications for an employee from dbo.lms_employee_certificates.
    Safely resolves employee_id from profile_id if not explicitly provided.
    """
    clean_emp = str(employee_id)[:7] if employee_id else None
    if not clean_emp:
        clean_emp = str(profile_id)[:7] if profile_id else None
    if not clean_emp:
        return []

    query = """
        SELECT c.id AS cert_id,
               c.id,
               c.employee_id,
               c.certification_name,
               c.certification_name AS name,
               c.certificate_type,
               c.certificate_id AS credential_id,
               c.certificate_id,
               CONVERT(VARCHAR(10), c.issue_date, 120) AS issue_date,
               CONVERT(VARCHAR(10), c.expiry_date, 120) AS expiry_date,
               c.certificate_file_path AS certificate_url,
               c.certificate_file_path,
               c.supporting_document_path AS supporting_documents,
               c.supporting_document_path,
               c.created_by,
               c.created_at
        FROM dbo.lms_employee_certificates c
        WHERE LOWER(c.employee_id) = LOWER(?)
        ORDER BY c.issue_date DESC, c.id DESC
    """
    cursor.execute(query, (clean_emp,))
    rows = dictfetchall(cursor)
    for r in rows:
        r["profile_id"] = profile_id
        # Infer provider/issuer from certification_name or certificate_type
        raw_type = r.get("certificate_type") or ""
        raw_name = r.get("certification_name") or ""
        issuer = "Udemy"
        if " | " in raw_type:
            issuer = raw_type.split(" | ")[0].strip()
        else:
            issuer = resolve_provider_name(raw_name, default="Udemy")
        r["issuing_organization"] = issuer
        r["provider_name"] = issuer
        r["certificate_file_name"] = r["certificate_url"].split("/")[-1] if r.get("certificate_url") else None
        r["certificate_file_size"] = "1.2 MB" if r.get("certificate_url") else None
    return rows

def sync_certifications(
    cursor,
    profile_id: Any,
    certs: List[Dict[str, Any]],
    actor_email: str = "SYSTEM",
    employee_id: Optional[str] = None
) -> None:
    """
    Synchronizes certifications into dbo.lms_employee_certificates with duplicate protection.
    Ensures date constraints (expiry_date >= issue_date).
    """
    clean_emp = str(employee_id)[:7] if employee_id else None
    if not clean_emp:
        clean_emp = str(profile_id)[:7] if profile_id else None
    if not clean_emp:
        raise ValueError("employee_id is required to synchronize certifications.")

    clean_actor = clean_emp

    # 1. Prune certificates that the employee removed from their profile
    retained_ids = set()
    for c in certs:
        raw_id = c.get("certification_id") or c.get("cert_id") or c.get("id")
        clean_id_str = str(raw_id).replace("cert-", "").strip() if raw_id is not None else ""
        if clean_id_str.isdigit() and int(clean_id_str) > 0:
            retained_ids.add(int(clean_id_str))

    cursor.execute("SELECT id, certificate_type FROM dbo.lms_employee_certificates WHERE LOWER(employee_id) = LOWER(?)", (clean_emp,))
    existing_rows = cursor.fetchall()
    for row in existing_rows:
        cid = row[0]
        ctype = str(row[1] or "").lower()
        # Preserve course completion certificates so they are not deleted when editing professional certification in Profile
        if "course completion" in ctype or "course certificate" in ctype:
            continue
        if cid not in retained_ids:
            cursor.execute("DELETE FROM dbo.lms_employee_certificates WHERE id = ?", (cid,))

    # 2. Synchronize and insert new or retained certificates
    for c in certs:
        name = c.get("name") or c.get("certification_name")
        if not name or not str(name).strip():
            continue

        raw_id = c.get("certification_id") or c.get("cert_id") or c.get("id")
        clean_id_str = str(raw_id).replace("cert-", "").strip() if raw_id is not None else ""
        if clean_id_str.isdigit() and int(clean_id_str) > 0:
            cursor.execute(
                "SELECT id FROM dbo.lms_employee_certificates WHERE id = ? AND LOWER(employee_id) = LOWER(?)",
                (int(clean_id_str), clean_emp)
            )
            if cursor.fetchone():
                continue

        raw_issue = c.get("issueDate") or c.get("issue_date")
        raw_expiry = c.get("expiryDate") or c.get("expiry_date")
        issue_date = parse_to_sql_date(raw_issue) or "2024-01-01"
        expiry_date = parse_to_sql_date(raw_expiry)

        # Check constraint CK_lms_employee_certificates_dates (expiry_date >= issue_date)
        if expiry_date and issue_date and expiry_date < issue_date:
            expiry_date = None

        # Guard against duplicate insertion by matching employee, cert name, and issue date
        cursor.execute("""
            SELECT id FROM dbo.lms_employee_certificates
            WHERE LOWER(employee_id) = LOWER(?)
              AND LOWER(RTRIM(LTRIM(certification_name))) = LOWER(?)
              AND (issue_date = ? OR (issue_date IS NULL AND ? IS NULL))
        """, (clean_emp, str(name).strip(), issue_date, issue_date))
        if cursor.fetchone():
            continue

        cert_url = c.get("certificateUrl") or c.get("certificate_url")
        cred_id = c.get("credentialId") or c.get("credential_id") or c.get("certificate_id") or c.get("certificateId")
        supp_docs = c.get("supportingDocuments") or c.get("supporting_documents")
        c_type = c.get("certificateType") or c.get("certificate_type") or c.get("type") or "Course Completion Certificate"
        cert_issuer = c.get("issuer") or c.get("issuing_organization")
        provider_id = None
        if cert_issuer and str(cert_issuer).strip():
            provider_id = course_metadata_repository.ensure_provider_exists(cert_issuer, cursor=cursor)

        cert_domain = c.get("domain") or c.get("certification_domain")
        category_id = None
        if cert_domain and str(cert_domain).strip():
            category_id = course_metadata_repository.ensure_category_exists(cert_domain, cursor=cursor)

        query = """
            INSERT INTO dbo.lms_employee_certificates (
                employee_id, certification_name, certificate_type,
                certificate_id, provider_id, category_id, issue_date, expiry_date,
                certificate_file_path, supporting_document_path,
                created_at, created_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), ?)
        """
        cursor.execute(
            query,
            (
                clean_emp,
                str(name)[:150],
                str(c_type)[:50],
                str(cred_id)[:50] if cred_id else None,
                provider_id,
                category_id,
                issue_date,
                expiry_date,
                str(cert_url)[:500] if cert_url else None,
                str(supp_docs)[:500] if supp_docs else None,
                clean_actor[:7]
            )
        )

    sync_profile_certifications_list(cursor, clean_emp)
