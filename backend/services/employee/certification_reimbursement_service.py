"""
Employee Certification Service.
Business logic orchestrating employee certificates, file uploads, and formatting.
Directly uses dbo.lms_employee_certificates table.
"""

import os
import re
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import HTTPException, status, UploadFile

from database.connection import connect_db, dictfetchall, is_sql_server
from repositories.employee import certification_reimbursement_repository as employee_certification_repository
from services.common.auth_service import employee_service
from constants.course_metadata import resolve_provider_name
from repositories.common.course_metadata_repository import course_metadata_repository

BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UPLOAD_BASE_DIR = os.path.join(BACKEND_ROOT, "uploads", "certificates")
os.makedirs(UPLOAD_BASE_DIR, exist_ok=True)


def _clean_provider_name(issuer_str: Optional[str]) -> str:
    if not issuer_str:
        return "Udemy"
    val = str(issuer_str).strip()
    for p in course_metadata_repository.get_active_providers():
        if p.get("name", "").casefold() == val.casefold():
            return p.get("name", val)
    if "AWS" in val.upper() or "AMAZON" in val.upper():
        return "Amazon Web Services"
    if "GOOGLE" in val.upper():
        return "Google Cloud"
    return val.title() if val.isupper() else val


class EmployeeCertificationService:
    def _resolve_employee_id(self, cursor, current_user: Any) -> str:
        """Resolves employee_id (VARCHAR(7)) from current_user and ensures profile row exists."""
        emp_id = None
        email = None

        if isinstance(current_user, dict):
            emp_id = current_user.get("employee_id")
            email = current_user.get("work_email") or current_user.get("email")
        elif isinstance(current_user, str):
            emp_id = current_user.strip()

        if not emp_id and email:
            emp = employee_service.get_employee_by_email(email)
            if emp:
                emp_id = emp.get("employee_id")

        if not emp_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authenticated user employee_id is required.",
            )

        # Ensure employee profile exists to satisfy FK constraint
        employee_certification_repository.ensure_employee_profile(cursor, emp_id)
        return emp_id

    def _parse_provider_and_type(self, raw_type: Optional[str], raw_name: Optional[str]) -> tuple[str, str]:
        """
        Parses provider/issuer and certificate type.
        Supports compound format 'Issuer | Type' stored in certificate_type.
        """
        if raw_type and " | " in raw_type:
            parts = raw_type.split(" | ", 1)
            issuer = _clean_provider_name(parts[0].strip())
            c_type = parts[1].strip() or "Course Completion Certificate"
            return issuer, c_type

        # Fallback resolve from raw_type or raw_name
        c_type = raw_type or "Course Completion Certificate"
        raw_resolved = resolve_provider_name(raw_type or raw_name or "Udemy", default="Udemy")
        issuer = _clean_provider_name(raw_resolved)
        return issuer, c_type

    def _format_cert(self, c: Dict[str, Any]) -> Dict[str, Any]:
        """Formats database row to UI schema matching MyCertificatesTab and Profile."""
        raw_type = c.get("certificate_type")
        raw_name = c.get("certification_name") or ""
        parsed_issuer, parsed_cert_type = self._parse_provider_and_type(raw_type, raw_name)
        issuer = c.get("provider_name") or parsed_issuer
        cert_type = raw_type if (raw_type and " | " not in raw_type) else parsed_cert_type

        issue_date = c.get("issue_date")
        expiry_date = c.get("expiry_date")

        is_course_cert = cert_type == "Course Completion Certificate" or "Course Completion" in str(cert_type)

        if is_course_cert:
            icon_style = "book-navy"
            status_str = "completed"
            if issue_date:
                try:
                    dt = datetime.strptime(str(issue_date)[:10], "%Y-%m-%d")
                    validity_text = f"Completed on {dt.strftime('%b %Y')}"
                except Exception:
                    validity_text = f"Completed on {issue_date}"
            else:
                validity_text = "Completed on Mar 2026"
        else:
            icon_style = "badge-blue"
            if expiry_date:
                dt = None
                for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%d-%m-%Y", "%d/%m/%Y"):
                    try:
                        dt = datetime.strptime(str(expiry_date)[:10], fmt)
                        break
                    except Exception:
                        pass
                if dt:
                    is_expired = dt.date() < datetime.now().date()
                    if is_expired:
                        validity_text = f"Expired on {dt.strftime('%b %Y')}"
                        status_str = "expired"
                    else:
                        validity_text = f"Valid till {dt.strftime('%b %Y')}"
                        status_str = "valid"
                else:
                    validity_text = f"Valid till {expiry_date}"
                    status_str = "valid"
            elif issue_date:
                try:
                    dt = datetime.strptime(str(issue_date)[:10], "%Y-%m-%d")
                    validity_text = f"Valid till {dt.strftime('%b %Y')}"
                    status_str = "valid"
                except Exception:
                    validity_text = f"Valid till {issue_date}"
                    status_str = "valid"
            else:
                validity_text = "Valid Certificate"
                status_str = "valid"

        provider_domain = re.sub(r'[^a-zA-Z0-9]', '', issuer).lower() or "udemy"

        cert_id_val = c.get("id")
        file_path = c.get("certificate_file_path")
        supp_path = c.get("supporting_document_path")

        return {
            "id": f"cert-{cert_id_val}",
            "certification_id": cert_id_val,
            "employee_id": c.get("employee_id"),
            "employeeId": c.get("employee_id"),
            "provider_name": issuer,
            "provider_id": c.get("provider_id"),
            "title": raw_name,
            "name": raw_name,
            "certification_name": raw_name,
            "type": cert_type,
            "certificate_type": cert_type,
            "provider": issuer,
            "issuer": issuer,
            "providerUrl": f"https://{provider_domain}.com",
            "validityText": validity_text,
            "status": status_str,
            "iconStyle": icon_style,
            "issueDate": issue_date or "",
            "issue_date": issue_date or "",
            "expiryDate": expiry_date or "",
            "expiry_date": expiry_date or "",
            "credentialId": c.get("certificate_id") or "",
            "certificate_id": c.get("certificate_id") or "",
            "category_id": c.get("category_id"),
            "category_name": c.get("certification_domain") or c.get("domain") or "Cloud Computing",
            "domain": c.get("certification_domain") or c.get("domain") or "Cloud Computing",
            "certification_domain": c.get("certification_domain") or c.get("domain") or "Cloud Computing",
            "certificateUrl": file_path,
            "certificate_file_path": file_path,
            "supportingDocumentUrl": supp_path,
            "supporting_document_path": supp_path,
            "certificateFileName": os.path.basename(file_path) if file_path else None,
            "created_at": c.get("created_at"),
            "created_by": c.get("created_by")
        }

    def get_certifications_for_employee(self, current_user: Any, employee_id: Optional[str] = None) -> List[Dict[str, Any]]:
        conn = connect_db()
        cursor = conn.cursor()
        try:
            target_emp = (employee_id or "").strip()
            if not target_emp:
                target_emp = self._resolve_employee_id(cursor, current_user)
            raw = employee_certification_repository.get_employee_certificates(cursor, target_emp)
            formatted = [self._format_cert(r) for r in raw]
            return formatted
        finally:
            conn.close()

    def get_employee_kpi_stats(self, current_user: Any, employee_id: Optional[str] = None) -> Dict[str, Any]:
        """Calculates dynamic KPI stats for employee certification and reimbursement."""
        conn = connect_db()
        cursor = conn.cursor()
        try:
            target_emp = (employee_id or "").strip()
            if not target_emp:
                target_emp = self._resolve_employee_id(cursor, current_user)

            # 1. Active certifications count from dbo.lms_employee_certificates
            # Only count Professional Certification (strictly excluding Course Completion Certificates)
            cursor.execute("""
                SELECT COUNT(*) 
                FROM dbo.lms_employee_certificates
                WHERE employee_id = ?
                  AND (certificate_type NOT LIKE '%Course Completion%')
                  AND (expiry_date IS NULL OR expiry_date >= CAST(GETDATE() AS DATE))
            """, (target_emp,))
            active_certs_row = cursor.fetchone()
            active_certs = int(active_certs_row[0]) if active_certs_row and active_certs_row[0] is not None else 0

            # 2. Claims metrics from dbo.lms_reimbursement_claims
            cursor.execute("""
                SELECT 
                    COALESCE(SUM(CASE WHEN status = 'Approved' THEN amount ELSE 0 END), 0) AS total_reimbursed,
                    COUNT(CASE WHEN status = 'Pending' THEN 1 END) AS pending_claims,
                    COUNT(CASE WHEN status = 'Approved' THEN 1 END) AS approved_claims
                FROM dbo.lms_reimbursement_claims
                WHERE employee_id = ?
            """, (target_emp,))
            claims_row = cursor.fetchone()
            total_reimbursed = int(claims_row[0]) if claims_row and claims_row[0] is not None else 0
            pending_claims = int(claims_row[1]) if claims_row and claims_row[1] is not None else 0
            approved_claims = int(claims_row[2]) if claims_row and claims_row[2] is not None else 0

            return {
                "active_certifications": active_certs,
                "total_reimbursed": total_reimbursed,
                "pending_claims": pending_claims,
                "approved_claims": approved_claims,
            }
        finally:
            conn.close()

    async def _save_upload_file(self, file: Optional[UploadFile], prefix: str = "") -> Optional[str]:
        """Helper to save uploaded file and return relative URL path."""
        if not file or not file.filename:
            return None
        clean_filename = re.sub(r'[^a-zA-Z0-9_.-]', '_', file.filename)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        tag = f"{prefix}_" if prefix else ""
        saved_name = f"{timestamp}_{tag}{clean_filename}"
        save_path = os.path.join(UPLOAD_BASE_DIR, saved_name)

        content = await file.read()
        with open(save_path, "wb") as f:
            f.write(content)
        return f"/uploads/certificates/{saved_name}"

    async def upload_certification(
        self,
        current_user: Any,
        title: str,
        cert_type: Optional[str] = "Course Completion Certificate",
        provider: Optional[str] = None,
        provider_name: Optional[str] = None,
        provider_id: Optional[int] = None,
        domain: Optional[str] = None,
        certification_domain: Optional[str] = None,
        category_id: Optional[int] = None,
        domain_id: Optional[int] = None,
        issue_date: str = "",
        expiry_date: Optional[str] = None,
        credential_id: Optional[str] = None,
        file: Optional[UploadFile] = None,
        supporting_file: Optional[UploadFile] = None,
        employee_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Uploads certificate file (and optional supporting file) and persists record
        to dbo.lms_employee_certificates.
        """
        if not title or not title.strip():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Certification name is required.")

        effective_prov = (provider or provider_name or "").strip()
        if not effective_prov:
            effective_prov = "Udemy"

        resolved_prov = _clean_provider_name(effective_prov)

        clean_type_str = (cert_type or "Course Completion Certificate").strip()
        is_course = clean_type_str == "Course Completion Certificate" or "Course Completion" in clean_type_str

        effective_domain = (domain or certification_domain or "").strip() or "Cloud Computing"

        # Normalize issue_date to YYYY-MM-DD
        clean_issue = str(issue_date)[:10].strip() if issue_date and str(issue_date).strip() else None
        clean_expiry = None if is_course else (str(expiry_date)[:10].strip() if expiry_date and str(expiry_date).strip() else None)

        # Check date constraint
        if clean_expiry and clean_issue and clean_expiry < clean_issue:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Expiry date cannot be earlier than issue date."
            )

        # Save files to disk
        file_url = await self._save_upload_file(file)
        supp_url = await self._save_upload_file(supporting_file, prefix="supp")

        conn = connect_db()
        cursor = conn.cursor()
        try:
            from database.connection import is_sql_server
            from utils.idempotency import is_unique_violation

            target_emp_id = (employee_id or "").strip()
            if not target_emp_id:
                target_emp_id = self._resolve_employee_id(cursor, current_user)
            else:
                employee_certification_repository.ensure_employee_profile(cursor, target_emp_id)

            clean_cert_title = title.strip()[:150]
            lock_hint = " WITH (UPDLOCK, HOLDLOCK)" if is_sql_server() else ""
            if clean_issue:
                cursor.execute(
                    f"""
                    SELECT TOP 1 id FROM dbo.lms_employee_certificates{lock_hint}
                    WHERE LOWER(employee_id) = LOWER(?)
                      AND LOWER(LTRIM(RTRIM(certification_name))) = LOWER(?)
                      AND issue_date = ?
                    """,
                    (target_emp_id, clean_cert_title, clean_issue),
                )
            else:
                cursor.execute(
                    f"""
                    SELECT TOP 1 id FROM dbo.lms_employee_certificates{lock_hint}
                    WHERE LOWER(employee_id) = LOWER(?)
                      AND LOWER(LTRIM(RTRIM(certification_name))) = LOWER(?)
                      AND issue_date IS NULL
                    """,
                    (target_emp_id, clean_cert_title),
                )
            if cursor.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Certificate '{clean_cert_title}' has already been uploaded for this employee."
                )

            resolved_prov = course_metadata_repository.normalize_metadata_name(resolved_prov, "Udemy")
            effective_domain = course_metadata_repository.normalize_metadata_name(effective_domain, "Development")

            # Resolve FKs
            final_provider_id = provider_id
            if not final_provider_id and resolved_prov:
                final_provider_id = course_metadata_repository.ensure_provider_exists(resolved_prov, cursor=cursor)

            final_category_id = category_id
            if not final_category_id and effective_domain:
                final_category_id = course_metadata_repository.ensure_category_exists(effective_domain, cursor=cursor)

            final_domain_id = domain_id
            if not final_domain_id and effective_domain:
                from repositories.common.certification_domain_repository import certification_domain_repository
                final_domain_id = certification_domain_repository.resolve_domain_id(effective_domain, cursor=cursor)

            cert_id = employee_certification_repository.insert_employee_certificate(
                cursor=cursor,
                employee_id=target_emp_id,
                certification_name=clean_cert_title,
                certificate_type=clean_type_str[:50],
                certificate_id=credential_id.strip()[:50] if credential_id and credential_id.strip() else None,
                provider_id=final_provider_id,
                category_id=final_category_id,
                domain_id=final_domain_id,
                issue_date=clean_issue,
                expiry_date=clean_expiry,
                certificate_file_path=file_url,
                supporting_document_path=supp_url,
                created_by=target_emp_id
            )
            conn.commit()

            created_row = employee_certification_repository.get_certificate_by_id(cursor, cert_id)
            if not created_row:
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve created certificate.")
            return self._format_cert(created_row)
        except HTTPException:
            conn.rollback()
            raise
        except Exception as e:
            conn.rollback()
            if is_unique_violation(e):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Certificate '{title.strip()}' has already been uploaded."
                )
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to record certificate: {str(e)}")
        finally:
            conn.close()

    def delete_certification(self, current_user: Any, certification_id: int) -> Dict[str, Any]:
        """Deletes certificate from dbo.lms_employee_certificates."""
        conn = connect_db()
        cursor = conn.cursor()
        try:
            emp_id = self._resolve_employee_id(cursor, current_user)
            existing = employee_certification_repository.get_certificate_by_id(cursor, certification_id)
            if not existing:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Certification not found.")

            # Verify ownership or manager role
            role = current_user.get("role", "") if isinstance(current_user, dict) else ""
            is_manager_or_admin = role in ["Reporting Manager", "HR Admin", "L&D Admin", "CEO", "Leadership"]
            if existing["employee_id"] != emp_id and not is_manager_or_admin:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission to delete this certification.")

            # Remove physical file if present
            for path_key in ["certificate_file_path", "supporting_document_path"]:
                furl = existing.get(path_key)
                if furl:
                    try:
                        fname = os.path.basename(furl)
                        fpath = os.path.join(UPLOAD_BASE_DIR, fname)
                        if os.path.exists(fpath):
                            os.remove(fpath)
                    except Exception:
                        pass

            deleted = employee_certification_repository.delete_employee_certificate(cursor, certification_id)
            conn.commit()
            return {"success": True, "message": "Certification deleted successfully."}
        except HTTPException:
            conn.rollback()
            raise
        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to delete certification: {str(e)}")
        finally:
            conn.close()

    def get_certificate_file_for_download(self, current_user: Any, certification_id: int) -> tuple[str, str]:
        """Returns (absolute_file_path, filename) for file download."""
        conn = connect_db()
        cursor = conn.cursor()
        try:
            emp_id = self._resolve_employee_id(cursor, current_user)
            existing = employee_certification_repository.get_certificate_by_id(cursor, certification_id)
            if not existing:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Certification not found.")

            role = current_user.get("role", "") if isinstance(current_user, dict) else ""
            role_clean = str(role).strip().upper()
            primary_portal = current_user.get("access_profile", {}).get("primary_portal", "") if isinstance(current_user, dict) else ""
            is_manager_or_admin = (
                role in ["Reporting Manager", "HR Admin", "L&D Admin", "CEO", "Leadership"]
                or role_clean in ["L&D", "L&D TEAM", "LD", "L_D", "L&D ADMIN", "HR", "HR TEAM", "HR ADMIN", "REPORTING MANAGER", "MANAGER", "CEO", "LEADERSHIP", "ADMIN"]
                or "L&D" in role_clean
                or "ADMIN" in role_clean
                or "MANAGER" in role_clean
                or primary_portal in ["ld", "reporting-manager", "hr", "ceo"]
            )
            if existing["employee_id"] != emp_id and not is_manager_or_admin:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

            file_url = existing.get("certificate_file_path") or existing.get("supporting_document_path")
            if not file_url:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No certificate file found for this record.")

            fname = os.path.basename(file_url.replace("\\", "/"))
            fpath = os.path.join(UPLOAD_BASE_DIR, fname)
            if not os.path.exists(fpath):
                # Fallback: check legacy services/uploads/certificates if present
                legacy_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads", "certificates", fname)
                alt_fpath = os.path.join(os.path.dirname(UPLOAD_BASE_DIR), fname)
                if os.path.exists(legacy_path):
                    fpath = legacy_path
                elif os.path.exists(alt_fpath):
                    fpath = alt_fpath
                else:
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Certificate file not found on server.")

            return fpath, fname
        finally:
            conn.close()

    def _calculate_status_and_formatting(self, expiry_date_str: Optional[str]) -> tuple[str, str, str]:
        """Returns (status, status_type, formatted_expiry_date)."""
        if not expiry_date_str or not str(expiry_date_str).strip():
            return "Active", "active", "No Expiry"

        try:
            exp_date = datetime.strptime(str(expiry_date_str)[:10], "%Y-%m-%d").date()
            today = datetime.now().date()
            days_diff = (exp_date - today).days
            formatted_date = exp_date.strftime("%d %b %Y")

            if days_diff < 0:
                return "Expired", "expired", formatted_date
            elif days_diff <= 30:
                return "Expiring Soon", "expiring_soon", formatted_date
            else:
                return "Active", "active", formatted_date
        except Exception:
            return "Active", "active", str(expiry_date_str)

    def _format_employee_avatar(self, name: str, index: int = 0) -> tuple[str, str]:
        palette = ["#FF7FAE", "#5CDE8A", "#A87FFF", "#FFBC64", "#F97FFF"]
        clean_name = (name or "Employee").strip()
        parts = clean_name.split()
        initials = "".join([p[0].upper() for p in parts[:2]]) if parts else "EM"
        color = palette[index % len(palette)]
        return initials, color

    def get_team_certifications(self, current_user: Any) -> Dict[str, Any]:
        """Returns earned certificates for direct reports of reporting manager."""
        target_id = ""
        mgr_name = ""
        if isinstance(current_user, dict):
            target_id = current_user.get("employee_id") or ""
            mgr_name = current_user.get("name") or current_user.get("full_name") or ""
        elif isinstance(current_user, str):
            target_id = current_user.strip()

        team_members = employee_service.get_team_members(target_id) if target_id else []
        if not team_members and mgr_name:
            team_members = employee_service.get_team_members(mgr_name)

        STANDARD_DOMAINS = [
            {"name": "Cloud Computing", "color": "#2667F9"},
            {"name": "Data Science & Analytics", "color": "#31C27E"},
            {"name": "Cybersecurity", "color": "#9E5DF9"},
            {"name": "AI & Machine Learning", "color": "#FDAD33"},
            {"name": "DevOps & Kubernetes", "color": "#2BC3F3"},
        ]

        if not team_members:
            default_doms = [{
                "name": d["name"],
                "label": d["name"],
                "percentage": 0,
                "value": 0,
                "count": 0,
                "color": d["color"]
            } for d in STANDARD_DOMAINS]
            return {
                "certifications": [],
                "total_earned": 0,
                "team_members_count": 0,
                "top_domains": default_doms,
                "domains": default_doms
            }

        team_ids = [m["employee_id"] for m in team_members if m.get("employee_id")]
        team_map = {m["employee_id"]: m for m in team_members if m.get("employee_id")}

        conn = connect_db()
        cursor = conn.cursor()
        try:
            raw_certs = employee_certification_repository.get_certifications_by_employee_ids(cursor, team_ids)
            # Filter strictly to genuine  (exclude Course Completion certificates)
            prof_certs = [
                c for c in raw_certs 
                if "course completion" not in (c.get("certificate_type") or "").lower()
            ]

            formatted_certs = []
            active_prof_certs = []
            for idx, c in enumerate(prof_certs):
                status_label, status_type, formatted_expiry = self._calculate_status_and_formatting(c.get("expiry_date"))
                if status_type != "expired":
                    active_prof_certs.append(c)

                emp_id = c.get("employee_id")
                emp_info = team_map.get(emp_id, {})
                emp_name = emp_info.get("name") or emp_info.get("full_name") or c.get("created_by") or "Team Member"
                department = emp_info.get("department") or emp_info.get("job_title") or emp_info.get("role") or "Engineering"
                initials, avatar_bg = self._format_employee_avatar(emp_name, idx)

                issuer, _ = self._parse_provider_and_type(c.get("certificate_type"), c.get("certification_name"))

                formatted_certs.append({
                    "id": c["id"],
                    "certification_id": c["id"],
                    "employeeId": emp_id,
                    "name": emp_name,
                    "employeeName": emp_name,
                    "initials": initials,
                    "avatarBg": avatar_bg,
                    "designation": department,
                    "department": department,
                    "certification": c.get("certification_name") or "",
                    "certificate": c.get("certification_name") or "",
                    "domain": c.get("certification_domain") or "Cloud Computing",
                    "certification_domain": c.get("certification_domain") or "Cloud Computing",
                    "issuer": issuer,
                    "provider": issuer,
                    "status": status_label,
                    "statusType": status_type,
                    "expiryDate": formatted_expiry,
                    "rawExpiryDate": c.get("expiry_date"),
                    "issueDate": c.get("issue_date"),
                    "certificateUrl": c.get("certificate_file_path"),
                    "credentialId": c.get("certificate_id") or f"CRT-{c['id']:04d}",
                })

            # Calculate Top Certification Domains strictly for active team members (Certifications Only)
            LEGACY_DOMAIN_MAP = {
                "SOFTWARE DEVELOPMENT": "Cloud Computing",
                "DEVELOPMENT": "Cloud Computing",
                "MANAGEMENT & AGILE": "DevOps & Kubernetes",
                "MANAGEMENT": "DevOps & Kubernetes",
                "SECURITY": "Cybersecurity",
                "AI/ML": "AI & Machine Learning",
                "DATA SCIENCE": "Data Science & Analytics",
                "CLOUD": "Cloud Computing",
            }
            domain_counts = {}
            for c in active_prof_certs:
                raw_dom = str(c.get("certification_domain") or "").strip()
                if not raw_dom or raw_dom.lower() == "none":
                    continue
                norm_dom = LEGACY_DOMAIN_MAP.get(raw_dom.upper(), raw_dom)
                domain_counts[norm_dom] = domain_counts.get(norm_dom, 0) + 1

            tot_team_certs = sum(domain_counts.values())
            dom_list = []
            if tot_team_certs > 0:
                raw_pcts = {
                    name: (domain_counts[name] / float(tot_team_certs)) * 100.0
                    for name in domain_counts
                }
                integer_parts = {name: int(raw_pcts[name]) for name in domain_counts}
                sum_int = sum(integer_parts.values())
                remaining_points = 100 - sum_int
                remainders = {
                    name: raw_pcts[name] - integer_parts[name]
                    for name in domain_counts
                }
                sorted_by_rem = sorted(
                    domain_counts.keys(),
                    key=lambda k: (remainders[k], domain_counts[k]),
                    reverse=True
                )
                for k in sorted_by_rem[:remaining_points]:
                    integer_parts[k] += 1

                for name, cnt in domain_counts.items():
                    whole_pct = integer_parts[name]
                    dom_list.append({
                        "name": name,
                        "label": name,
                        "percentage": whole_pct,
                        "value": whole_pct,
                        "count": cnt,
                        "hours": f"{cnt} certs",
                    })

                dom_list.sort(key=lambda x: (x["value"], x["count"]), reverse=True)

            return {
                "certifications": formatted_certs,
                "total_earned": len(active_prof_certs),
                "team_members_count": len(team_members),
                "top_domains": dom_list,
                "domains": dom_list
            }
        finally:
            conn.close()

    def get_all_certifications_for_records(self) -> List[Dict[str, Any]]:
        """Returns all employee certificates across enterprise."""
        all_emps = employee_service.get_all_employees()
        emp_map = {e["employee_id"]: e for e in all_emps if e.get("employee_id")}

        conn = connect_db()
        cursor = conn.cursor()
        try:
            raw_certs = employee_certification_repository.get_all_employee_certifications_with_profiles(cursor)
            # Filter strictly to genuine Professional Certification (exclude Course Completion certificates)
            prof_certs = [
                c for c in raw_certs 
                if "course completion" not in (c.get("certificate_type") or "").lower()
            ]

            formatted_certs = []
            for idx, c in enumerate(prof_certs):
                emp_id = c.get("employee_id")
                emp_info = emp_map.get(emp_id, {})
                emp_name = emp_info.get("name") or emp_info.get("full_name") or c.get("created_by") or "Employee"
                department = emp_info.get("department") or emp_info.get("job_title") or emp_info.get("role") or "Engineering"
                initials, avatar_bg = self._format_employee_avatar(emp_name, idx)
                status_label, status_type, formatted_expiry = self._calculate_status_and_formatting(c.get("expiry_date"))
                if status_type == "expired":
                    continue  # When expired don't show

                issuer, _ = self._parse_provider_and_type(c.get("certificate_type"), c.get("certification_name"))

                formatted_certs.append({
                    "id": c["id"],
                    "certification_id": c["id"],
                    "employeeId": emp_id,
                    "employeeName": emp_name,
                    "initials": initials,
                    "avatarBg": avatar_bg,
                    "designation": department,
                    "department": department,
                    "certificate": c.get("certification_name") or "",
                    "certification": c.get("certification_name") or "",
                    "certificateId": c.get("certificate_id") or f"CLM-2026-{c['id']:04d}",
                    "provider": issuer,
                    "issuer": issuer,
                    "status": status_label,
                    "statusType": status_type,
                    "submissionDate": c.get("issue_date") or "",
                    "expiryDate": formatted_expiry,
                    "rawExpiryDate": c.get("expiry_date"),
                    "certificateUrl": c.get("certificate_file_path"),
                })

            return formatted_certs
        finally:
            conn.close()

    def get_all_certifications_for_ld(self) -> List[Dict[str, Any]]:
        """
        Returns all employee certificates across enterprise for L&D Learning Records.
        Only returns Professional Certification (excluding Course Completion Certificates).
        """
        all_emps = employee_service.get_all_employees()
        emp_map = {e["employee_id"]: e for e in all_emps if e.get("employee_id")}

        conn = connect_db()
        cursor = conn.cursor()
        try:
            raw_certs = employee_certification_repository.get_all_employee_certifications_with_profiles(cursor)

            formatted_certs = []
            for idx, c in enumerate(raw_certs):
                raw_type = (c.get("certificate_type") or "").strip()
                is_course_completion = "course completion" in raw_type.lower() or "course certificate" in raw_type.lower()
                if is_course_completion:
                    continue  # Only display Professional Certification

                emp_id = c.get("employee_id")
                emp_info = emp_map.get(emp_id, {})
                emp_name = emp_info.get("name") or emp_info.get("full_name") or c.get("created_by") or "Employee"
                department = emp_info.get("department") or emp_info.get("job_title") or emp_info.get("role") or "Engineering"
                initials, avatar_bg = self._format_employee_avatar(emp_name, idx)

                cert_category = "Professional Certification"
                status_label, status_type, formatted_expiry = self._calculate_status_and_formatting(c.get("expiry_date"))
                issuer, _ = self._parse_provider_and_type(raw_type, c.get("certification_name"))

                formatted_certs.append({
                    "id": c["id"],
                    "certification_id": c["id"],
                    "employeeId": emp_id,
                    "employeeName": emp_name,
                    "initials": initials,
                    "avatarBg": avatar_bg,
                    "designation": department,
                    "department": department,
                    "certificate": c.get("certification_name") or "",
                    "certification": c.get("certification_name") or "",
                    "certificateId": c.get("certificate_id") or f"CLM-2026-{c['id']:04d}",
                    "certificateType": cert_category,
                    "provider": issuer,
                    "issuer": issuer,
                    "status": status_label,
                    "statusType": status_type,
                    "submissionDate": c.get("issue_date") or "",
                    "expiryDate": formatted_expiry,
                    "rawExpiryDate": c.get("expiry_date"),
                    "certificateUrl": c.get("certificate_file_path"),
                })

            return formatted_certs
        finally:
            conn.close()

    def get_top_certification_domains(self) -> List[Dict[str, Any]]:
        """
        Dynamically computes Top Certification Domains from dbo.lms_employee_certificates
        using Hamilton's Largest Remainder Method (guaranteeing exact 100% whole numbers)
        exclusively for unique domains existing in the database.
        """
        LEGACY_DOMAIN_MAP = {
            "SOFTWARE DEVELOPMENT": "Cloud Computing",
            "DEVELOPMENT": "Cloud Computing",
            "MANAGEMENT & AGILE": "DevOps & Kubernetes",
            "MANAGEMENT": "DevOps & Kubernetes",
            "SECURITY": "Cybersecurity",
            "AI/ML": "AI & Machine Learning",
            "DATA SCIENCE": "Data Science & Analytics",
            "CLOUD": "Cloud Computing",
            "DEVOPS": "DevOps & Kubernetes",
        }

        conn = connect_db()
        cursor = conn.cursor()
        try:
            tbl = "dbo." if is_sql_server() else ""
            cursor.execute(f"""
                SELECT 
                    c.certification_domain AS domain_name,
                    COUNT(*) AS cert_count
                FROM {tbl}lms_employee_certificates c
                WHERE c.certification_domain IS NOT NULL AND c.certification_domain != ''
                GROUP BY c.certification_domain
            """)
            rows = dictfetchall(cursor)

            domain_counts = {}
            for r in rows:
                raw_name = str(r.get("domain_name") or "").strip()
                if not raw_name or raw_name.lower() == "none":
                    continue
                cnt = int(r.get("cert_count") or 0)
                if cnt <= 0:
                    continue
                norm_name = LEGACY_DOMAIN_MAP.get(raw_name.upper(), raw_name)
                domain_counts[norm_name] = domain_counts.get(norm_name, 0) + cnt

            total_certs = sum(domain_counts.values())
            dom_list = []

            if total_certs > 0:
                raw_pcts = {
                    name: (domain_counts[name] / float(total_certs)) * 100.0
                    for name in domain_counts
                }
                integer_parts = {name: int(raw_pcts[name]) for name in domain_counts}
                sum_int = sum(integer_parts.values())
                remaining_points = 100 - sum_int
                remainders = {
                    name: raw_pcts[name] - integer_parts[name]
                    for name in domain_counts
                }
                sorted_by_rem = sorted(
                    domain_counts.keys(),
                    key=lambda k: (remainders[k], domain_counts[k]),
                    reverse=True
                )
                for k in sorted_by_rem[:remaining_points]:
                    integer_parts[k] += 1

                for name, cnt in domain_counts.items():
                    whole_pct = integer_parts[name]
                    dom_list.append({
                        "name": name,
                        "label": name,
                        "percentage": whole_pct,
                        "value": whole_pct,
                        "count": cnt,
                        "hours": f"{cnt} certs",
                    })

                dom_list.sort(key=lambda x: (x["value"], x["count"]), reverse=True)

            return dom_list
        finally:
            conn.close()

    def get_certified_employees_count(self) -> int:
        """
        Returns the count of distinct employees who have at least one valid certification
        (where expiry_date is NULL or expiry_date >= current date) from dbo.lms_employee_certificates.
        """
        conn = connect_db()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                SELECT COUNT(DISTINCT employee_id)
                FROM dbo.lms_employee_certificates
                WHERE expiry_date IS NULL OR expiry_date >= CAST(GETDATE() AS DATE)
            """)
            row = cursor.fetchone()
            return int(row[0]) if row and row[0] is not None else 0
        finally:
            conn.close()

    def get_certified_employees_summary(self) -> List[Dict[str, Any]]:
        """
        Retrieves detailed summary of all certified employees and their active certifications.
        Enriched with employee profile details (name, department, email).
        """
        conn = connect_db()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                SELECT 
                    c.employee_id,
                    c.id AS certificate_id,
                    c.certification_name,
                    c.certificate_type,
                    c.certification_domain,
                    CONVERT(VARCHAR(10), c.issue_date, 120) AS issue_date,
                    CONVERT(VARCHAR(10), c.expiry_date, 120) AS expiry_date
                FROM dbo.lms_employee_certificates c
                WHERE c.expiry_date IS NULL OR c.expiry_date >= CAST(GETDATE() AS DATE)
                ORDER BY c.employee_id ASC, c.issue_date DESC
            """)
            rows = cursor.fetchall()
            
            all_emps = employee_service.get_all_employees()
            emp_map = {e.get("employee_id"): e for e in all_emps if e.get("employee_id")}

            grouped: Dict[str, Dict[str, Any]] = {}
            for r in rows:
                emp_id, cert_id, cert_name, cert_type, domain, issue_d, expiry_d = r
                if emp_id not in grouped:
                    emp_info = emp_map.get(emp_id, {})
                    grouped[emp_id] = {
                        "employee_id": emp_id,
                        "name": emp_info.get("name") or emp_info.get("full_name") or emp_id,
                        "email": emp_info.get("work_email") or emp_info.get("email") or "",
                        "department": emp_info.get("department") or "General",
                        "job_title": emp_info.get("job_title") or "Employee",
                        "valid_certifications_count": 0,
                        "certifications": [],
                    }
                grouped[emp_id]["valid_certifications_count"] += 1
                grouped[emp_id]["certifications"].append({
                    "certificate_id": cert_id,
                    "certification_name": cert_name,
                    "certificate_type": cert_type,
                    "certification_domain": domain,
                    "issue_date": issue_d,
                    "expiry_date": expiry_d,
                })

            return list(grouped.values())
        finally:
            conn.close()


employee_certification_service = EmployeeCertificationService()

certification_reimbursement_service = employee_certification_service
