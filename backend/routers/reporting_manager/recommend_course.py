"""
Recommendations Router.
Presentation layer for Reporting Manager Course Recommendations.
Clean, dedicated domain router mounted under /api/recommendations.
"""

from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, status
from utils.auth import get_current_user
from models.reporting_manager.recommend_course import ManagerRecommendNewCourseCreate
from services.reporting_manager.recommend_course_service import manager_recommendation_service

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])

@router.post("/manager-course", status_code=status.HTTP_201_CREATED, summary="Recommend Manager Course")
def recommend_manager_course(
    data: ManagerRecommendNewCourseCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Reporting Manager recommends a new course.
    Stored in lms_course_recommendation_request with manager_id, provider_name, category_name.
    Broadcasts notifications to all employees + L&D in Azure AD.
    """
    payload = data.model_dump() if hasattr(data, "model_dump") else data
    return manager_recommendation_service.create_manager_recommendation(current_user, payload)

@router.get("/manager-courses", summary="Get Manager Recommended Courses")
def get_manager_recommended_courses(
    manager_id: Optional[int] = None,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Retrieve all courses recommended by reporting managers."""
    return manager_recommendation_service.get_all_manager_recommendations(manager_id)
