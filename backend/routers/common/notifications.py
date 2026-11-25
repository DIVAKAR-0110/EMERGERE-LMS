"""
Notifications & Course Recommendations Router.
Endpoints for sending recommendations and fetching notifications for the header bell dialog.
"""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, Query, Request, status
from models.common.notification import CourseRecommendationCreate, NotificationResponse
from services.common.notification_service import notification_service
from utils.auth import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.post("/recommend-course", status_code=status.HTTP_201_CREATED)
def recommend_course_to_team(
    data: CourseRecommendationCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Reporting Manager recommends a course to one or more direct report employees.
    Creates records in lms_course_recommendation, lms_course_recommendation_recipient,
    and lms_notification.
    """
    return notification_service.recommend_course(current_user, data)

@router.get("", response_model=List[NotificationResponse])
def get_my_notifications(
    request: Request,
    view_mode: Optional[str] = Query(None, description="Active portal mode: PRIMARY or EMPLOYEE"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Retrieve notifications for the currently logged-in user scoped to the active view mode.
    Used by the PageHeader bell icon dialog.
    """
    effective_view = view_mode or request.headers.get("x-view-mode")
    return notification_service.get_user_notifications(current_user, view_mode=effective_view)

@router.put("/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Mark a single notification as read."""
    return notification_service.mark_as_read(current_user, notification_id)

@router.put("/read-all")
def mark_all_notifications_read(
    request: Request,
    view_mode: Optional[str] = Query(None, description="Active portal mode: PRIMARY or EMPLOYEE"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Mark all notifications as read for current user within active view scope."""
    effective_view = view_mode or request.headers.get("x-view-mode")
    return notification_service.mark_all_as_read(current_user, view_mode=effective_view)

@router.delete("/{notification_id}")
def delete_notification(
    notification_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Delete a single notification for current user."""
    return notification_service.delete_notification(current_user, notification_id)

@router.post("/trigger-course-expiry-check")
def trigger_course_expiry_check(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Manually triggers checking of courses expiring in 30 days (Stage 1)
    or 1 day (Stage 2) and sends notifications to assigned employees.
    """
    return notification_service.check_and_send_course_expiry_notifications()

@router.get("/my-recommendations")
def get_my_course_recommendations(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Retrieve all course recommendations created by the current Reporting Manager."""
    return notification_service.get_my_recommendations(current_user)

@router.put("/recommendations/{recommendation_id}/view")
def mark_recommendation_viewed(
    recommendation_id: int,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Record that an employee viewed a course recommendation."""
    return notification_service.mark_recommendation_viewed(current_user, recommendation_id)

@router.post("/recommendation-requests", status_code=status.HTTP_201_CREATED)
def create_recommendation_request(
    data: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Submit a request for a new course recommendation not currently in the catalog."""
    class ReqData:
        course_name = data.get("course_name") or data.get("title") or ""
        provider_platform = data.get("provider") or data.get("provider_platform") or ""
        category = data.get("category") or ""
        course_link = data.get("course_link") or data.get("course_url") or ""
        required_reason = data.get("reason") or data.get("required_reason") or ""

    return notification_service.create_recommendation_request(current_user, ReqData())



