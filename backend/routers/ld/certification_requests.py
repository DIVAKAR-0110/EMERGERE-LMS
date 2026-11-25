"""
Certification Requests Router.
Presentation layer exposing RESTful endpoints for multi-stage certification requests.
"""

from typing import List, Optional, Any, Dict
from fastapi import APIRouter, Depends, status, Query
from models.employee.certification_reimbursement import (
    CertificationRequestCreate,
    CertificationRequestResponse,
    CertificationStageItem,
)
from models.ld.approvals_workflow import (
    CertificationRequestStatusUpdate,
    CertificationApprovalDecision,
)
from models.ceo.approvals_analytics import CEOCertificationApprovalDecision
from services.ld.certification_request_service import certification_request_service
from utils.auth import get_current_user, require_employee_id

router = APIRouter(prefix="/certifications/requests", tags=["Certification Requests"])

@router.get("", response_model=List[CertificationRequestResponse])
def list_certification_requests(
    employee_id: Optional[Any] = Query(None, description="Filter by employee ID"),
    request_status: Optional[str] = Query(None, alias="status", description="Filter by status (Pending, Approved, Rejected)"),
    stage: Optional[str] = Query(None, description="Filter by workflow stage (pending_ld, pending_ceo, approved, rejected, history)"),
    exclude_active_claims: bool = Query(False, description="Exclude certifications with existing Pending or Approved reimbursement claims")
):
    """Retrieve all certification requests, optionally filtered by employee ID, status, or workflow stage."""
    return certification_request_service.get_all(
        employee_id=employee_id,
        status_filter=request_status,
        stage=stage,
        exclude_active_claims=exclude_active_claims
    )

@router.get("/{request_id}", response_model=CertificationRequestResponse)
def get_certification_request(request_id: str):
    """Retrieve a single certification request by ID or code with stages."""
    return certification_request_service.get_by_id(request_id)

@router.get("/{request_id}/stages", response_model=List[CertificationStageItem])
def get_certification_request_stages(request_id: str):
    """Retrieve the 4 workflow milestone stages for a certification request."""
    return certification_request_service.get_stages(request_id)

@router.post("", response_model=CertificationRequestResponse, status_code=status.HTTP_201_CREATED)
def create_certification_request(
    data: CertificationRequestCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Submit a new certification request and initialize 4 workflow stages."""
    data.employee_id = require_employee_id(current_user, data.employee_id)
    if not data.created_by:
        data.created_by = data.employee_id
    return certification_request_service.create(data)

@router.put("/{request_id}/ld-approval", response_model=CertificationRequestResponse)
def update_ld_approval(
    request_id: str,
    decision: CertificationApprovalDecision,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Update L&D Approval stage decision (Approved -> Moves to CEO Approval, Rejected -> Rejects request)."""
    decision.admin_id = require_employee_id(current_user, decision.admin_id)
    return certification_request_service.ld_approval(request_id, decision)

@router.put("/{request_id}/ceo-approval", response_model=CertificationRequestResponse)
def update_ceo_approval(
    request_id: str,
    decision: CEOCertificationApprovalDecision,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Update CEO Approval stage decision (Approved -> Marks Certificate Approved, Rejected -> Rejects request)."""
    decision.admin_id = require_employee_id(current_user, decision.admin_id)
    return certification_request_service.ceo_approval(request_id, decision)

@router.patch("/{request_id}/status", response_model=CertificationRequestResponse)
def update_certification_request_status(
    request_id: str,
    status_update: CertificationRequestStatusUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Update status of a certification request (compatibility endpoint)."""
    status_update.updated_by = require_employee_id(current_user, status_update.updated_by)
    return certification_request_service.update_status(request_id, status_update)

@router.delete("/{request_id}")
def delete_certification_request(request_id: str):
    """Delete a certification request."""
    return certification_request_service.delete(request_id)
