"""
Browser Extension Router.
Exposes endpoints consumed by the LMS Learning Tracker browser extension:
- /api/extension/test-graph (diagnostics)
- /api/extension/latest-otp (OTP retrieval from Microsoft Graph)
- /api/extension/sync-learning (heartbeat and tab close session sync)
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field
from services.common.ms_graph_service import ms_graph_service
from services.common.learning_sync_service import learning_sync_service

router = APIRouter(prefix="/extension", tags=["Browser Extension Learning Tracker"])

class LearningSyncPayload(BaseModel):
    employee_id: str = Field(..., description="Employee ID (e.g. EMP019)")
    course_id: int = Field(..., description="Database ID of the course")
    session_seconds: int = Field(..., ge=0, description="Active watch time elapsed in seconds")
    is_completed: bool = Field(default=False, description="Whether the course video reached 100%")
    progress_percentage: Optional[float] = Field(default=None, ge=0, le=100)

@router.get("/health")
def health_check():
    return {
        "status": "online",
        "service": "LMS Extension Learning Bridge",
        "default_test_account": ms_graph_service.default_account
    }

@router.get("/test-graph")
def test_microsoft_graph(email: Optional[str] = Query(default=None)):
    """Runs a live diagnostic test against Microsoft Graph API for the specified or default account."""
    try:
        res = ms_graph_service.test_connection(email)
        return res
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Microsoft Graph Test Error: {str(e)}"
        )

@router.get("/latest-otp")
def get_latest_otp(
    email: Optional[str] = Query(default=None, description="Corporate account email to inspect"),
    max_age_minutes: int = Query(default=5, ge=1, le=30),
    since: Optional[str] = Query(default=None, description="ISO timestamp to filter newer messages")
):
    """
    Fetches the latest OTP verification code sent to the corporate account inbox.
    Called by the browser extension during automated provider login.
    """
    try:
        result = ms_graph_service.get_latest_otp(
            user_email=email,
            max_age_minutes=max_age_minutes,
            since_iso=since
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error reading OTP from Microsoft Graph: {str(e)}"
        )

class SetOtpPayload(BaseModel):
    email: Optional[str] = None
    otp: str

@router.post("/set-otp")
def set_manual_otp(payload: SetOtpPayload):
    """Sets a manual OTP override for testing."""
    target_email = payload.email or ms_graph_service.default_account
    ms_graph_service.set_manual_otp(target_email, payload.otp)
    return {
        "status": "success",
        "message": f"Manual OTP set to {payload.otp} for {target_email}",
        "email": target_email,
        "otp": payload.otp
    }

@router.post("/sync-learning")
def sync_learning_progress(payload: LearningSyncPayload):
    """
    Synchronizes active learning watch duration from the browser extension into LMS database.
    Called periodically every 60 seconds (heartbeat) and on tab close (sendBeacon).
    """
    try:
        res = learning_sync_service.sync_learning_session(
            employee_id=payload.employee_id,
            course_id=payload.course_id,
            session_seconds=payload.session_seconds,
            is_completed=payload.is_completed,
            progress_percentage=payload.progress_percentage
        )
        return res
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to record learning progress: {str(e)}"
        )
