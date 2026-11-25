"""
Pydantic schemas for L&D Course Management Page.
Re-exports canonical schemas from models.ld.course, models.ld.study_material,
models.ld.approvals_workflow, and models.employee.course_enrollment,
and defines Course Assignment schemas.
"""

from typing import Optional, Any, List, Dict
from pydantic import BaseModel, Field

from models.ld.course import CourseCreate, CourseUpdate, CourseResponse
from models.ld.study_material import (
    StudyMaterialCreate,
    StudyMaterialUpdate,
    StudyMaterialResponse,
)
from models.ld.approvals_workflow import EnrollmentHoldRequest
from models.employee.course_enrollment import (
    EnrollmentRequestCreate,
    EnrollmentResponse,
    OtherEmployeeDTO,
    UnenrollRequest,
)


# ==============================================================================
# Course Assignment Schemas (AssignCourseModal.jsx)
# ==============================================================================

class CourseAssignmentCreate(BaseModel):
    course_id: int = Field(..., description="ID of the course being assigned")
    employee_ids: List[str] = Field(..., description="List of employee codes or IDs to assign the course to")
    learning_starting_date: str = Field(..., description="Start date (YYYY-MM-DD)")
    target_completion_date: str = Field(..., description="Target completion date (YYYY-MM-DD)")
    assignment_note: Optional[str] = Field(None, max_length=250, description="Optional note from L&D")


class BatchCourseAssignmentCreate(BaseModel):
    course_id: int = Field(..., description="ID of the course being assigned")
    assignments: Optional[List[Dict[str, Any]]] = Field(default=[], description="List of dicts with email / employee_id")
    csv_text: Optional[str] = Field(None, description="Raw CSV text content")
    learning_starting_date: str = Field(..., description="Start date (YYYY-MM-DD)")
    target_completion_date: str = Field(..., description="Target completion date (YYYY-MM-DD)")
    assignment_note: Optional[str] = Field(None, max_length=250, description="Optional note from L&D")


__all__ = [
    "CourseCreate",
    "CourseUpdate",
    "CourseResponse",
    "StudyMaterialCreate",
    "StudyMaterialUpdate",
    "StudyMaterialResponse",
    "CourseAssignmentCreate",
    "BatchCourseAssignmentCreate",
    "EnrollmentHoldRequest",
    "EnrollmentRequestCreate",
    "EnrollmentResponse",
    "OtherEmployeeDTO",
    "UnenrollRequest",
]
