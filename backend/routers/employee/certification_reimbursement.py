"""
Employee Certifications Router.
Endpoints for employee certificate upload, retrieval, download, and deletion.
Persists records in dbo.lms_employee_certificates.
"""

import os
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, Form, File, UploadFile, status, Query
from fastapi.responses import FileResponse

from services.employee.certification_reimbursement_service import employee_certification_service
from utils.auth import get_current_user

router = APIRouter(prefix="/employee/certifications", tags=["Employee Certifications"])


@router.get("", response_model=List[Dict[str, Any]])
def get_my_certifications(
    employee_id: Optional[str] = Query(None, description="Optional employee ID override"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Retrieves all certifications for the current employee."""
    return employee_certification_service.get_certifications_for_employee(current_user, employee_id=employee_id)


@router.get("/stats")
def get_employee_cert_and_reimb_stats(
    employee_id: Optional[str] = Query(None, description="Optional employee ID override "),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Retrieves dynamic KPI stats for employee certifications and reimbursements."""
    return employee_certification_service.get_employee_kpi_stats(current_user, employee_id=employee_id)


@router.get("/team")
def get_team_certifications(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Retrieves certifications earned by direct reports of the reporting manager.
    Used for Reporting Manager Dashboard KPI and CertificationsTeamCard.
    """
    return employee_certification_service.get_team_certifications(current_user)


@router.get("/all")
def get_all_certifications(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Retrieves all employee certifications across enterprise with computed status (Active, Expired, Expiring Soon).
    Used for Reporting Manager Learning Records Certification Table.
    """
    return employee_certification_service.get_all_certifications_for_records()


@router.get("/ld-records")
def get_ld_learning_records_certifications(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Retrieves all employee certificates across enterprise for L&D Learning Records.
    Includes BOTH Professional Certification and Course Completion Certificates.
    """
    return employee_certification_service.get_all_certifications_for_ld()


@router.get("/top-domains")
def get_top_certification_domains():
    """
    Retrieves dynamic top certification domains and percentages from dbo.lms_employee_certificates.
    """
    return employee_certification_service.get_top_certification_domains()


@router.get("/certified-count")
def get_certified_employees_count(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Returns the count of distinct employees holding at least one valid certification
    (where expiry_date is NULL or expiry_date >= current date) from dbo.lms_employee_certificates.
    """
    count = employee_certification_service.get_certified_employees_count()
    return {"certified_employees": count}


@router.get("/certified-employees")
def get_certified_employees_summary(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Retrieves detailed breakdown of all employees holding at least one valid certification,
    including their valid certifications from dbo.lms_employee_certificates.
    """
    return employee_certification_service.get_certified_employees_summary()


@router.post("", status_code=status.HTTP_201_CREATED)
async def upload_certificate(
    title: Optional[str] = Form(None),
    name: Optional[str] = Form(None),
    certification_name: Optional[str] = Form(None),
    type: Optional[str] = Form("Course Completion Certificate"),
    certificate_type: Optional[str] = Form(None),
    provider: Optional[str] = Form(None),
    provider_name: Optional[str] = Form(None),
    provider_id: Optional[int] = Form(None),
    issuer: Optional[str] = Form(None),
    issueDate: Optional[str] = Form(None),
    issue_date: Optional[str] = Form(None),
    expiryDate: Optional[str] = Form(None),
    expiry_date: Optional[str] = Form(None),
    credentialId: Optional[str] = Form(None),
    certificate_id: Optional[str] = Form(None),
    domain: Optional[str] = Form(None),
    certification_domain: Optional[str] = Form(None),
    category_id: Optional[int] = Form(None),
    domain_id: Optional[int] = Form(None),
    certificate_file: Optional[UploadFile] = File(None),
    supporting_file: Optional[UploadFile] = File(None),
    employee_id: Optional[str] = Form(None),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Uploads a certificate and records details in dbo.lms_employee_certificates.
    """
    effective_title = (title or name or certification_name or "").strip()
    effective_type = (type or certificate_type or "Course Completion Certificate").strip()
    effective_provider = (provider or provider_name or issuer or "").strip()
    effective_domain = (domain or certification_domain or "").strip() or None
    effective_issue_date = (issueDate or issue_date or "").strip()
    effective_expiry_date = (expiryDate or expiry_date or "").strip() or None
    effective_credential_id = (credentialId or certificate_id or "").strip() or None

    return await employee_certification_service.upload_certification(
        current_user=current_user,
        title=effective_title,
        cert_type=effective_type,
        provider=effective_provider,
        provider_name=effective_provider,
        provider_id=provider_id,
        domain=effective_domain,
        category_id=category_id,
        domain_id=domain_id,
        issue_date=effective_issue_date,
        expiry_date=effective_expiry_date,
        credential_id=effective_credential_id,
        file=certificate_file,
        supporting_file=supporting_file,
        employee_id=employee_id
    )


@router.delete("/{certification_id}")
def delete_certificate(
    certification_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Deletes an employee certificate."""
    return employee_certification_service.delete_certification(current_user, certification_id)


@router.get("/{certification_id}/download")
def download_certificate(
    certification_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Downloads or views the certificate file with appropriate media_type."""
    fpath, fname = employee_certification_service.get_certificate_file_for_download(current_user, certification_id)
    ext = os.path.splitext(fname)[1].lower()
    media_type = "application/pdf" if ext == ".pdf" else "image/png" if ext == ".png" else "image/jpeg" if ext in [".jpg", ".jpeg"] else "application/octet-stream"
    return FileResponse(path=fpath, filename=fname, media_type=media_type)
