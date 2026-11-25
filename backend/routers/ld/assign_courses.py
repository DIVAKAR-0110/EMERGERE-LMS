"""
Assign Courses Router.
Endpoints for L&D team to assign courses to employees using dbo.lms_LD_assign_course.
"""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, Query, status
from models.ld.course_management import (
    CourseAssignmentCreate,
    BatchCourseAssignmentCreate,
)
from utils.auth import get_current_user
from services.ld.assign_course_service import assign_course_service

router = APIRouter(prefix="/ld", tags=["L&D Course Assignment"])


@router.post("/assign-course", status_code=status.HTTP_201_CREATED)
def assign_course_to_employees(
    data: CourseAssignmentCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    L&D assigns a course to one or more employees:
    - Inserts into dbo.lms_LD_assign_course
    - Adds course to lms_employee_course
    - Dispatches in-app Bell Notification to each assigned employee
    """
    return assign_course_service.assign_course(current_user, data.model_dump())


@router.post("/batch-assign", status_code=status.HTTP_201_CREATED)
def batch_assign_course(
    data: BatchCourseAssignmentCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    L&D batch assigns a course to employees:
    - Accepts CSV text payload or an array of employee assignments
    - Validates emails against active organizational directory
    - Persists assignments into dbo.lms_LD_assign_course and dbo.lms_employee_course
    - Dispatches notifications to all successfully assigned employees
    """
    return assign_course_service.batch_assign_course(current_user, data.model_dump())


@router.get("/assigned-courses", response_model=List[Dict[str, Any]])
def get_assigned_courses(
    course_id: Optional[int] = Query(None, description="Filter by course ID"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Fetches all assigned course records for L&D dashboard.
    Optionally filters by specific course_id.
    """
    return assign_course_service.get_assigned_courses(course_id)
