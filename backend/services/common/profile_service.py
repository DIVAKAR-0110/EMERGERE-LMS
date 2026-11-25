import os
import re
"""
Profile Service.
Business logic layer uniting live Microsoft Entra ID (Azure AD) employee identity
with consolidated lms_employee_profiles (master profile, skills, interests)
and lms_employee_certifications (portfolio certifications).
"""

from typing import Dict, Any, Optional, List
from fastapi import HTTPException, status
from database.connection import connect_db
from repositories.common import profile_repository
from services.common.auth_service import employee_service
from models.common.profile import ProfileUpdateRequest

class ProfileService:
    def _compute_initials(self, name: str) -> str:
        clean = (name or "").split("(")[0].strip()
        parts = [p for p in clean.split(" ") if p]
        if len(parts) >= 2:
            return f"{parts[0][0]}{parts[1][0]}".upper()
        elif len(parts) == 1:
            return parts[0][:2].upper()
        return "EM"

    def get_full_profile(self, employee_id_or_oid: Any) -> Dict[str, Any]:
        """
        Retrieves combined profile by merging Microsoft Entra ID (Azure AD) directory details
        with persistent relational data from lms_employee_profiles and lms_employee_certifications.
        """
        if not employee_id_or_oid:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Employee identifier is required")

        if isinstance(employee_id_or_oid, dict):
            emp = employee_id_or_oid
        else:
            emp = employee_service.get_employee_by_id(str(employee_id_or_oid))

        if not emp:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Employee '{employee_id_or_oid}' not found in Microsoft Entra ID"
            )

        azure_oid = emp.get("microsoft_object_id") or emp.get("id") or ""
        emp_code = emp.get("employee_id") or ""
        upn = emp.get("email") or emp.get("work_email") or ""

        conn = connect_db()
        cursor = conn.cursor()
        try:
            # Query existing profile by employee_id without creating dummy rows
            db_profile = profile_repository.get_profile_by_employee_code(cursor, emp_code)
            if not db_profile and azure_oid:
                db_profile = profile_repository.get_profile_by_azure_oid(cursor, azure_oid)

            profile_id = db_profile.get("employee_id") if db_profile else None
            is_completed = profile_repository.has_completed_profile(db_profile)

            if db_profile:
                about_me = db_profile.get("about_me") or ""
                linkedin_url = db_profile.get("linkedin_url") or None
                avatar_url = db_profile.get("avatar_url") or None

                technical_skills = profile_repository.parse_json_list(db_profile.get("technical_skills"))
                professional_skills = profile_repository.parse_json_list(db_profile.get("professional_skills"))
                area_of_expertise = profile_repository.parse_json_list(db_profile.get("areas_of_expertise"))
                learning_interests = profile_repository.parse_json_list(db_profile.get("learning_interests"))
                certification_ids = [
                    int(cid)
                    for cid in profile_repository.parse_json_list(db_profile.get("certification_ids"))
                    if str(cid).strip().isdigit()
                ]
                raw_certs = profile_repository.get_certifications(cursor, profile_id or emp_code, employee_id=emp_code)
            else:
                about_me = ""
                linkedin_url = None
                avatar_url = None
                technical_skills = []
                professional_skills = []
                area_of_expertise = []
                raw_certs = []
                learning_interests = []
                certification_ids = []

            # Format certifications for frontend table (display only certifications, not course completion certificates)
            certifications = []
            for c in raw_certs:
                raw_type = str(c.get("certificate_type") or "").strip().lower()
                # Exclude Course Completion Certificates
                if "course completion" in raw_type or "course certificate" in raw_type:
                    continue

                file_path = c.get("certificate_file_path") or c.get("certificate_url") or ""
                file_name = c.get("certificate_file_name") or (os.path.basename(file_path.replace("\\", "/")) if file_path else None)

                certifications.append({
                    "id": c.get("cert_id"),
                    "name": c.get("certification_name"),
                    "credentialId": c.get("credential_id") or c.get("certificate_id"),
                    "certificate_id": c.get("certificate_id"),
                    "issuer": c.get("issuing_organization") or c.get("provider_name"),
                    "issueDate": c.get("issue_date"),
                    "expiryDate": c.get("expiry_date"),
                    "certificateUrl": c.get("certificate_url"),
                    "certificateFileName": file_name,
                    "certificateFileSize": c.get("certificate_file_size"),
                    "certificateType": c.get("certificate_type"),
                })

            initials = self._compute_initials(emp.get("name") or emp.get("full_name") or "")

            return {
                "isProfileCompleted": is_completed,
                "basicInfo": {
                    "employeeId": emp_code,
                    "microsoftObjectId": azure_oid,
                    "fullName": emp.get("name") or emp.get("full_name") or "User",
                    "workEmail": upn,
                    "department": emp.get("department") or "General",
                    "jobTitle": emp.get("job_title") or emp.get("role") or "Employee",
                    "jobLocation": emp.get("job_location") or "Coimbatore, India",
                    "mobileNumber": emp.get("mobile_number") or "",
                    "reportingManager": emp.get("reporting_manager") or "Not Assigned",
                    "reportingManagerId": emp.get("reporting_manager_id") or None,
                    "dateOfJoining": emp.get("date_of_joining") or "01/06/2024",
                    "linkedinUrl": linkedin_url,
                    "photoInitials": initials,
                    "avatarUrl": avatar_url
                },
                "skillsExpertise": {
                    "aboutMe": about_me,
                    "technicalSkills": technical_skills,
                    "professionalSkills": professional_skills,
                    "areaOfExpertise": area_of_expertise
                },
                "learningCertifications": {
                    "certifications": certifications,
                    "certification_ids": certification_ids,
                    "learningInterests": learning_interests
                }
            }
        finally:
            conn.close()

    def save_full_profile(
        self,
        employee_id_or_user: Any,
        update_data: Any,
        actor_email: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Updates the employee's consolidated profile in lms_employee_profiles and lms_employee_certifications.
        Sets audit columns (created_by, updated_by).
        """
        if isinstance(update_data, dict):
            update_data = ProfileUpdateRequest(**update_data)

        if isinstance(employee_id_or_user, dict):
            emp = employee_id_or_user
            emp_key = emp.get("employee_id") or emp.get("microsoft_object_id")
        else:
            emp = employee_service.get_employee_by_id(str(employee_id_or_user))
            emp_key = str(employee_id_or_user)

        if not emp:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Employee '{employee_id_or_user}' not found in Microsoft Entra ID"
            )

        azure_oid = emp.get("microsoft_object_id") or emp.get("id") or ""
        emp_code = emp.get("employee_id") or ""
        upn = emp.get("email") or emp.get("work_email") or ""
        if not actor_email:
            actor_email = upn or emp.get("name") or "SYSTEM"

        conn = connect_db()
        cursor = conn.cursor()
        try:
            # 1. Extract updates
            about_me = None
            linkedin_url = None
            avatar_url = None
            technical_skills = None
            professional_skills = None
            areas_of_expertise = None
            learning_interests = None

            if update_data.basicInfo:
                raw_linkedin = update_data.basicInfo.linkedinUrl
                if not raw_linkedin or not str(raw_linkedin).strip():
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail="LinkedIn URL is required."
                    )
                clean_linkedin = str(raw_linkedin).strip()
                if len(clean_linkedin) > 100:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail="Maximum URL length is 100 characters."
                    )
                if any(c.isspace() for c in clean_linkedin):
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail="Spaces are not allowed in LinkedIn URL."
                    )
                linkedin_regex = r"^(https?:\/\/)?(www\.)?linkedin\.com\/in\/[a-zA-Z0-9-]+(\/)?$"
                if not re.match(linkedin_regex, clean_linkedin, re.IGNORECASE):
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail="Invalid LinkedIn profile URL (e.g., https://www.linkedin.com/in/your-name). Letters, numbers, and hyphens (-) only."
                    )
                linkedin_url = clean_linkedin
                avatar_url = None

            if update_data.skillsExpertise:
                about_me = update_data.skillsExpertise.aboutMe
                if about_me and len(about_me.strip()) > 250:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail="Professional summary cannot exceed 250 characters."
                    )
                technical_skills = update_data.skillsExpertise.technicalSkills
                professional_skills = update_data.skillsExpertise.professionalSkills
                areas_of_expertise = update_data.skillsExpertise.areaOfExpertise

            if update_data.learningCertifications:
                learning_interests = update_data.learningCertifications.learningInterests

            # 2. Upsert lms_employee_profiles master record (consolidated)
            profile_id = profile_repository.upsert_employee_profile(
                cursor,
                azure_ad_oid=azure_oid,
                employee_code=emp_code,
                user_principal_name=upn,
                about_me=about_me,
                linkedin_url=linkedin_url,
                avatar_url=avatar_url,
                technical_skills=technical_skills,
                professional_skills=professional_skills,
                areas_of_expertise=areas_of_expertise,
                learning_interests=learning_interests,
                actor_email=actor_email
            )

            # 3. Synchronize Certifications in lms_employee_certifications
            if update_data.learningCertifications and update_data.learningCertifications.certifications is not None:
                certs_dicts = [c.model_dump() for c in update_data.learningCertifications.certifications]
                profile_repository.sync_certifications(
                    cursor,
                    profile_id,
                    certs_dicts,
                    actor_email=actor_email,
                    employee_id=emp_code
                )

            conn.commit()
        except Exception as e:
            conn.rollback()
            import traceback
            traceback.print_exc()
            print(f"[ERROR in save_full_profile] {e}", flush=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to save profile: {str(e)}"
            )
        finally:
            conn.close()

        return self.get_full_profile(emp)

profile_service = ProfileService()
