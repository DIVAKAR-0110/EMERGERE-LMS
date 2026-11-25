"""
Daily Learning Router.
Presentation layer for Employee Daily Learning Logs and Points Calculation.
"""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, status, Query
from services.employee.daily_learning_service import daily_learning_service
from utils.auth import get_current_user

router = APIRouter(prefix="/daily-learning", tags=["Daily Learning"])

@router.post("", status_code=status.HTTP_201_CREATED)
def create_learning_log(
    payload: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Submits a daily learning log.
    Converts hours + minutes to total minutes, computes points automatically,
    and stores in LMS_DAILY_LEARNING table.
    """
    target = payload.get("employee_id") or current_user
    return daily_learning_service.create_learning_log(target, payload)

@router.get("")
def get_my_learning_logs(
    limit: int = Query(50, ge=1, le=200),
    employee_id: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Retrieves learning logs recorded by the current employee."""
    target = employee_id or current_user
    return daily_learning_service.get_logs_for_employee(target, limit)

@router.get("/my-courses")
def get_my_approved_courses(
    employee_id: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Retrieves all approved courses for the currently logged-in employee.
    Used by Daily Learning Log course selection dropdown.
    """
    target = employee_id or current_user
    return daily_learning_service.get_approved_courses_for_employee(target)

@router.get("/summary")
def get_my_learning_summary(
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    employee_id: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Retrieves monthly learning summary metrics for the current employee."""
    target = employee_id or current_user
    return daily_learning_service.get_summary_for_employee(target, year, month)

@router.post("/calculate-points")
def preview_learning_points(
    payload: Dict[str, Any]
):
    """
    Previews points calculation based on minutes entered:
    - 45m video -> 15 pts
    - 30m video -> 10 pts
    """
    v_h = int(payload.get("video_hours") or 0)
    v_m = int(payload.get("video_minutes") or 0)
    v_min = int(payload.get("video_learning_duration_min") or (v_h * 60 + v_m))

    p_h = int(payload.get("practice_hours") or 0)
    p_m = int(payload.get("practice_minutes") or 0)
    p_min = int(payload.get("practice_handson_min") or (p_h * 60 + p_m))

    v_rate = int(payload.get("video_learning_point") or 20)
    p_rate = int(payload.get("practice_handson_point") or 10)

    return daily_learning_service.calculate_points(v_min, p_min, v_rate, p_rate)

@router.put("/{daily_learning_id}")
def update_learning_log(
    daily_learning_id: int,
    payload: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Updates an existing daily learning log.
    Recalculates minutes and mathematical points automatically,
    and updates LMS_DAILY_LEARNING table.
    """
    target = payload.get("employee_id") or current_user
    return daily_learning_service.update_learning_log(target, daily_learning_id, payload)

