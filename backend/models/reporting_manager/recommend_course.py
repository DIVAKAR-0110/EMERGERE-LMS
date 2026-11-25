"""
Pydantic schemas for Reporting Manager Recommend Course Page.
Matches frontend/src/pages/ReportingManager/Recommendcourse.jsx.
"""

from typing import Optional, List
from pydantic import BaseModel, Field

# 1. Existing Course Recommendation Schema (Card "Recommend" Button -> POST /api/notifications/recommend-course)
from models.common.notification import CourseRecommendationCreate

# 2. Display DTOs (Course Cards & Study Material Cards)
from models.ld.course_management import CourseResponse, StudyMaterialResponse


# 3. Form Validation Schema for "+ Recommend New Course" Button (POST /api/recommendations/manager-course)
class ManagerRecommendNewCourseCreate(BaseModel):
    course_name: str = Field(..., min_length=2, max_length=100, description="Name of the course being recommended")
    employee_ids: List[str] = Field(default=[], description="Selected team member employee IDs")
    provider_id: Optional[int] = Field(None, description="FK to CourseProviders(ProviderId)")
    category_id: Optional[int] = Field(None, description="FK to CourseCategories(CategoryId)")
    provider: Optional[str] = Field("Udemy", max_length=50, description="Provider/Platform name")
    category: Optional[str] = Field("Development", max_length=50, description="Course category")
    course_link: Optional[str] = Field(None, max_length=255, description="Course link URL")
    reason_for_new_course: str = Field(..., min_length=1, max_length=500, description="Business justification")
    manager_id: Optional[str] = Field(None, max_length=20, description="Reporting Manager Employee ID")
    manager_name: Optional[str] = Field(None, max_length=100, description="Reporting Manager Name")


__all__ = [
    "CourseRecommendationCreate",
    "ManagerRecommendNewCourseCreate",
    "CourseResponse",
    "StudyMaterialResponse",
]
