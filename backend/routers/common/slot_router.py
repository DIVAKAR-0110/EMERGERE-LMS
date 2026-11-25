"""
FastAPI Router for Email Providers & Active Learning Slots (Model B).
Exposes cascading provider/email options, live slot visualization, and slot allocation APIs.
"""

from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from services.common.slot_service import slot_service
from utils.auth import get_current_user

router = APIRouter(prefix="/email-providers", tags=["Email Providers & Slots"])

class SlotAcquireRequest(BaseModel):
    course_id: int = Field(..., description="Course ID to allocate slot for")
    employee_id: str = Field(..., description="Employee ID occupying the slot")
    enrollment_id: Optional[int] = Field(None, description="Optional enrollment ID")

class SlotReleaseRequest(BaseModel):
    slot_id: Optional[int] = Field(None, description="Direct slot ID to release")
    enrollment_id: Optional[int] = Field(None, description="Enrollment ID whose slot to release")
    course_id: Optional[int] = Field(None, description="Course ID")
    employee_id: Optional[str] = Field(None, description="Employee ID")

class SlotProgressSyncRequest(BaseModel):
    enrollment_id: int = Field(..., description="Enrollment ID to sync progress for")
    progress_percentage: float = Field(..., ge=0.0, le=100.0, description="Current course completion %")


@router.get("/options", summary="Cascading Course Providers and Corporate Emails with Slot Counts")
def get_cascading_options(
    user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Returns mapped providers and their corporate email accounts,
    including live available slot counts for modal dropdowns.
    """
    return slot_service.get_cascading_options()


@router.get("/summary", summary="Summary of all EmailProvider pairs and active capacity")
def get_email_providers_summary(
    provider_id: Optional[int] = Query(None, description="Filter by Course Provider ID"),
    user: Dict[str, Any] = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    """
    Returns a summary list of all (Email + Provider) configurations with occupied/available slots.
    """
    return slot_service.get_all_email_providers_summary(provider_id=provider_id)


@router.get("/{email_provider_id}/slots", summary="Get 4 active slots and learner details for an EmailProvider")
def get_email_provider_slots(
    email_provider_id: int,
    user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Retrieves full details for all 4 slots under a specific EmailProviderId,
    including current active learner names, departments, courses, and progress.
    """
    slots_data = slot_service.get_email_provider_slots(email_provider_id)
    if not slots_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"EmailProvider with ID {email_provider_id} not found."
        )
    return slots_data


@router.post("/acquire", summary="Acquires an available slot for a course learner (Model B Gatekeeper)")
def acquire_slot(
    payload: SlotAcquireRequest,
    user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Attempts to occupy 1 of the 4 slots for the course's (Email + Provider) pair.
    Returns HTTP 409 Conflict if all 4 slots are occupied.
    """
    result = slot_service.acquire_slot(
        course_id=payload.course_id,
        employee_id=payload.employee_id,
        enrollment_id=payload.enrollment_id
    )
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=result.get("message", "Slot capacity full for this provider/email configuration.")
        )
    return result


@router.post("/release", summary="Releases an occupied slot back to Available")
def release_slot(
    payload: SlotReleaseRequest,
    user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Releases a slot, clearing learner association and marking status = 'Available'.
    """
    result = slot_service.release_slot(
        slot_id=payload.slot_id,
        enrollment_id=payload.enrollment_id,
        course_id=payload.course_id,
        employee_id=payload.employee_id
    )
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("message", "Unable to release slot.")
        )
    return result


@router.post("/sync-progress", summary="Syncs learner progress and triggers 100% completion release cascade")
def sync_slot_progress(
    payload: SlotProgressSyncRequest,
    user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Updates slot progress. If progress reaches 100.0%, automatically marks enrollment Completed
    and cascades slot release.
    """
    return slot_service.update_slot_progress(
        enrollment_id=payload.enrollment_id,
        progress_percentage=payload.progress_percentage
    )
