"""
HR Activity Feed Router.
Handles endpoints for querying and logging activities in dbo.lms_hr_activity_feed.
Synchronizes with HR Dashboard Recent HR Activity component and Report Download events.
"""

from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from utils.auth import get_current_user
from services.hr.dashboard_service import hr_dashboard_service, format_relative_time

router = APIRouter(prefix="/hr", tags=["HR Activity"])


class LogActivityRequest(BaseModel):
    activity_type: str = Field(..., max_length=30, description="Activity category (max 30 chars, e.g. REPORT_GENERATED, EMPLOYEE_ONBOARDED, etc.)")
    message: str = Field(..., max_length=255, description="Human readable message description (max 255 chars)")


@router.get("/activity-feed", summary="Get Recent HR Activity Feed")
def get_hr_activity_feed(
    limit: int = 10,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Returns the latest activities from dbo.lms_hr_activity_feed,
    mapped to UI styling and relative timestamps for the HR Dashboard.
    Provides the 4 real-time activity cards (Onboarding, Cert Approvals, Payments, Report Downloads).
    """
    return hr_dashboard_service.get_activity_feed(limit=limit)


@router.post("/activity-feed", summary="Log an HR Activity Event", status_code=status.HTTP_201_CREATED)
def log_hr_activity(
    data: LogActivityRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Inserts a new event into dbo.lms_hr_activity_feed.
    Used for recording report generation, bulk approval, or payment triggers.
    """
    return hr_dashboard_service.log_activity(
        activity_type=data.activity_type,
        message=data.message,
        current_user=current_user
    )


__all__ = [
    "router",
    "LogActivityRequest",
    "format_relative_time",
    "get_hr_activity_feed",
    "log_hr_activity",
]
