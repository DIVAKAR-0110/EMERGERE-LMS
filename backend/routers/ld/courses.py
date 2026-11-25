"""
Courses Router.
Presentation layer exposing RESTful endpoints for Video Courses.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, status, Query, UploadFile, File, Form, HTTPException
from models.ld.course import CourseCreate, CourseUpdate, CourseResponse, CourseHRReview
from services.ld.course_service import course_service
from utils.auth import get_current_user, require_employee_id

router = APIRouter(prefix="/courses", tags=["Courses"])

@router.get("", response_model=List[CourseResponse])
def list_courses(
    is_active: Optional[bool] = Query(None, description="Filter active courses"),
    hr_status: Optional[str] = Query(None, description="Filter by HR reimbursement status (Pending, Approved, Rejected)"),
    search: Optional[str] = Query(None, description="Course title or keyword search (fast indexed search)")
):
    """Retrieve all video courses added by L&D with fast indexed search."""
    return course_service.get_all(is_active=is_active, hr_status=hr_status, search=search)

@router.get("/analytics/employee-records", summary="Retrieve live Courses Data metrics and monthly learning hours trends for HR Employee Records")
def get_hr_employee_records_analytics() -> Dict[str, Any]:
    """
    Returns live metrics for HR Employee Records:
    - Assigned Courses (L&D assignments)
    - Completed Courses
    - Active Courses (in progress)
    - Overdue Courses
    - Rolling 6 months learning hours trends
    """
    return course_service.get_hr_employee_records_analytics()

@router.get("/{course_id}", response_model=CourseResponse)
def get_course(course_id: int):
    """Retrieve a single course by its ID."""
    return course_service.get_by_id(course_id)

@router.post("", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
def create_course(
    data: CourseCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Create a new video course in catalogue."""
    actor_id = require_employee_id(current_user, data.created_by)
    data.created_by = actor_id
    return course_service.create(data)

@router.patch("/{course_id}/hr-review", response_model=CourseResponse)
def review_course_hr(
    course_id: int,
    data: CourseHRReview,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """HR review (Accept/Reject) for purchased course reimbursement claim."""
    data.hr_employee_id = require_employee_id(current_user, data.hr_employee_id)
    return course_service.review_course_hr(course_id, data)


@router.post("/{course_id}/pay-slip")
async def upload_course_payment_slip(
    course_id: int,
    file: Optional[UploadFile] = File(None, description="Optional payment slip file (PDF, DOC, DOCX, JPG, PNG)"),
    description: Optional[str] = Form(None, max_length=500, description="Optional payment reference / description"),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """HR marks an approved course reimbursement claim as Paid and records in lms_payment_records."""
    if not file and not (description and description.strip()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide at least one: a payment slip file or a description."
        )
    from services.ld.reimbursement_claim_service import reimbursement_claim_service
    actor_id = require_employee_id(current_user, None)
    return await reimbursement_claim_service.pay_course(
        course_id=course_id,
        file=file,
        description=description,
        actor_id=actor_id
    )

@router.put("/{course_id}", response_model=CourseResponse)
def update_course(
    course_id: int,
    data: CourseUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Update details of an existing course."""
    actor_id = require_employee_id(current_user)
    if hasattr(data, "updated_by"):
        data.updated_by = actor_id
    return course_service.update(course_id, data)

@router.delete("/{course_id}")
def delete_course(course_id: int):
    """Delete a course from the catalogue."""
    return course_service.delete(course_id)

