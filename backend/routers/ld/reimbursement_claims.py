"""
Reimbursement Claims Router.
Presentation layer exposing RESTful endpoints for reimbursement claims.
"""

from typing import List, Optional, Any, Dict
from fastapi import APIRouter, Depends, status, Query, File, UploadFile, Form
from models.employee.certification_reimbursement import (
    ReimbursementClaimCreate,
    ReimbursementClaimResponse,
    ReimbursementClaimStageResponse,
)
from models.hr.approvals_workflow import ReimbursementHRDecision
from models.ld.approvals_workflow import ReimbursementClaimStatusUpdate
from services.ld.reimbursement_claim_service import reimbursement_claim_service
from utils.auth import get_current_user, require_employee_id

router = APIRouter(prefix="/reimbursements/claims", tags=["Reimbursement Claims"])

@router.get("", response_model=List[ReimbursementClaimResponse])
def list_reimbursement_claims(
    employee_id: Optional[str] = Query(None, description="Filter by employee ID "),
    status: Optional[str] = Query(None, description="Filter by status (Pending, Approved, Rejected)"),
    processing_status: Optional[str] = Query(None, description="Filter by processing status (In Progress, Submitted to HR, Paid)")
):
    """Retrieve all reimbursement claims, optionally filtered by employee ID, status, or processing_status."""
    return reimbursement_claim_service.get_all(
        employee_id=employee_id,
        status_filter=status,
        processing_status=processing_status
    )

@router.get("/{claim_id}", response_model=ReimbursementClaimResponse)
def get_reimbursement_claim(claim_id: int):
    """Retrieve a single reimbursement claim by ID."""
    return reimbursement_claim_service.get_by_id(claim_id)

@router.get("/{claim_id}/stages", response_model=List[ReimbursementClaimStageResponse])
def get_reimbursement_claim_stages(claim_id: int):
    """Retrieve 5 approval timeline stages for a reimbursement claim."""
    return reimbursement_claim_service.get_stages(claim_id)

@router.post("", response_model=ReimbursementClaimResponse, status_code=status.HTTP_201_CREATED)
def create_reimbursement_claim(
    data: ReimbursementClaimCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Submit a new reimbursement claim."""
    data.employee_id = require_employee_id(current_user, data.employee_id)
    return reimbursement_claim_service.create(data)

@router.post("/{claim_id}/hr-decision", response_model=ReimbursementClaimResponse)
def hr_decision_reimbursement_claim(
    claim_id: int,
    decision: ReimbursementHRDecision,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """HR accepts or rejects reimbursement claim and marks processing status as Paid."""
    decision.admin_id = require_employee_id(current_user, decision.admin_id)
    return reimbursement_claim_service.hr_decision(claim_id, decision)

@router.patch("/{claim_id}/status", response_model=ReimbursementClaimResponse)
def update_reimbursement_claim_status(
    claim_id: int,
    status_update: ReimbursementClaimStatusUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Update status of a reimbursement claim (Pending -> Approved / Rejected)."""
    status_update.updated_by = require_employee_id(current_user, status_update.updated_by)
    return reimbursement_claim_service.update_status(claim_id, status_update)


@router.post("/{claim_id}/pay-slip", response_model=ReimbursementClaimResponse)
async def upload_payment_slip(
    claim_id: int,
    file: Optional[UploadFile] = File(None, description="Payment slip document (PDF, DOC, DOCX, JPG, JPEG, or PNG — max 5MB)"),
    description: Optional[str] = Form(None, max_length=500, description="Optional payment note or reference"),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    HR marks an Approved reimbursement claim as Paid.
    Accepts multipart/form-data with a payment slip file, description, or both.
    """
    if not file and not (description and description.strip()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide at least one: a payment slip file or a description."
        )
    actor_id = require_employee_id(current_user, None)
    return await reimbursement_claim_service.pay_claim(
        claim_id=claim_id,
        file=file,
        description=description,
        actor_id=actor_id
    )


@router.get("/records/payments", response_model=List[Dict[str, Any]])
def get_payment_records(
    employee_id: Optional[str] = Query(None, description="Filter by employee ID"),
    claim_type: Optional[str] = Query(None, description="Filter by claim type (Certification, Course)"),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Retrieve all payment records from dbo.lms_payment_records."""
    from database.connection import connect_db
    from repositories.ld import payment_record_repository
    conn = connect_db()
    cursor = conn.cursor()
    try:
        return payment_record_repository.get_all_payment_records(
            cursor=cursor,
            employee_id=employee_id,
            claim_type=claim_type
        )
    finally:
        conn.close()
