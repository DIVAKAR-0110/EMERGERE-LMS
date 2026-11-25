"""
Leaderboard Router.
Presentation layer exposing RESTful endpoints for the Employee Leaderboard dashboard:
ranks, hours, points, percentile, and department breakdown.
"""

from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, Query, status
from services.employee.leaderboard_service import leaderboard_service
from utils.auth import get_current_user, require_employee_id

router = APIRouter(prefix="/leaderboard", tags=["Leaderboard"])

@router.get("")
def get_leaderboard(
    time_filter: str = Query("All Time", alias="timeFilter"),
    employee_id: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Retrieves full leaderboard information for the requesting employee:
    - Ranked team member list with hours and points
    - YourStats card with user rank, points to next rank, percentile, total points, total learning hours
    - Overview metrics and category breakdown
    """
    user_target = employee_id or current_user
    return leaderboard_service.get_leaderboard_data(user_target, time_filter=time_filter)

@router.post("/recompute", status_code=status.HTTP_200_OK)
def trigger_leaderboard_recompute(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Manually triggers recomputing and recording snapshots into dbo.lms_leaderboard_snapshots.
    """
    emp_id = require_employee_id(current_user)
    snapshots = leaderboard_service.recompute_snapshots(triggered_by_emp_id=emp_id)
    return {
        "success": True,
        "message": f"Successfully recorded {len(snapshots)} leaderboard snapshots.",
        "count": len(snapshots)
    }
