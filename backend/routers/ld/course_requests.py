"""
Course Requests Router.
Presentation layer exposing RESTful endpoints for Employee Course Requests:
Employee Request -> L&D Approval -> CEO Approval -> Course Purchase.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Query, status
from models.employee.course_library import (
    CourseRequestCreate,
    TrackerItem,
)
from models.ld.approvals_workflow import (
    CourseRequestDecision,
)
from models.ceo.approvals_analytics import CEOCourseApprovalDecision
from models.ld.course_request import CourseRequestResponse
from services.ld.course_request_service import course_request_service
from utils.auth import get_current_user, require_employee_id

router = APIRouter(prefix="/course-requests", tags=["Course Requests"])

@router.get("", response_model=List[CourseRequestResponse])
def get_course_requests(
    stage: Optional[str] = Query(None, description="Filter: 'pending_ld', 'pending_ceo', 'ceo_approved', 'ready_to_purchase', 'history'"),
    employee_id: Optional[str] = Query(None, description="Filter by employee ID "),
    employee_name: Optional[str] = Query(None, description="Filter by employee Name")
):
    """Retrieve course requests based on workflow stage or requesting employee."""
    return course_request_service.get_requests(
        stage=stage,
        employee_id=employee_id,
        employee_name=employee_name
    )

@router.get("/tracker", response_model=List[TrackerItem])
def get_course_request_tracker(
    employee_id: Optional[str] = Query(None, description="Optional employee ID filter "),
    employee_name: Optional[str] = Query(None, description="Optional employee name filter"),
    manager_id: Optional[str] = Query(None, description="Optional reporting manager ID or name to filter direct reports' requests")
):
    """Retrieve requests formatted for CourseRequestTracker.jsx horizontal milestone timeline."""
    return course_request_service.get_tracker_items(
        employee_id=employee_id,
        employee_name=employee_name,
        manager_id=manager_id
    )

@router.post("/auto-escalate")
def trigger_auto_escalation(days_threshold: int = Query(7, ge=1, description="Days pending before escalating")):
    """
    REQ-CRS-025: Triggers automated escalation for course requests pending >= 7 days.
    Dispatches urgent reminders and auto-escalates to Secondary Manager or L&D.
    """
    return course_request_service.auto_escalate_pending_requests(days_threshold=days_threshold)

@router.get("/{new_course_id}", response_model=CourseRequestResponse)
def get_course_request_by_id(new_course_id: int):
    """Get single course request details."""
    return course_request_service.get_request_by_id(new_course_id)

@router.post("", response_model=CourseRequestResponse, status_code=status.HTTP_201_CREATED)
def create_course_request(
    data: CourseRequestCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Employee submits a new course request. Generates Request ID, 5 stages, and notifies RM."""
    data.employee_id = require_employee_id(current_user, data.employee_id)
    if not data.employee_name:
        data.employee_name = current_user.get("name") or current_user.get("full_name")
    if not data.employee_role:
        data.employee_role = current_user.get("department") or current_user.get("job_title") or current_user.get("role")
    return course_request_service.create_request(data)

@router.put("/{new_course_id}/ld-approval", response_model=CourseRequestResponse)
def ld_decision(
    new_course_id: int,
    decision: CourseRequestDecision,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """L&D Admin approves or rejects the course request. On approval, advances to CEO queue."""
    decision.admin_id = require_employee_id(current_user, decision.admin_id)
    return course_request_service.ld_decision(new_course_id, decision)

@router.put("/{new_course_id}/ceo-approval", response_model=CourseRequestResponse)
def ceo_decision(
    new_course_id: int,
    decision: CEOCourseApprovalDecision,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """CEO approves or rejects the course request. On approval, advances to L&D for Purchase."""
    decision.admin_id = require_employee_id(current_user, decision.admin_id)
    return course_request_service.ceo_decision(new_course_id, decision)

@router.put("/{new_course_id}/purchase", response_model=CourseRequestResponse)
def mark_course_purchased(
    new_course_id: int,
    admin_id: Optional[str] = Query(None, description="L&D Admin ID"),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """L&D marks the course request as Purchased, adding it to the course catalog."""
    actor_id = require_employee_id(current_user, admin_id)
    return course_request_service.mark_purchased(new_course_id, admin_id=actor_id)
