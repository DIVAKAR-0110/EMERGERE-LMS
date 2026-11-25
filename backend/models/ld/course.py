"""
Pydantic schemas for L&D Video Courses.
"""

from typing import Optional, Union, List, Dict, Any
from pydantic import BaseModel, Field, field_validator
from models.hr.approvals_workflow import CourseHRReview

class CourseCreate(BaseModel):
    ld_id: Optional[Union[int, str]] = Field(default=None, description="L&D Admin / Creator ID")
    course_url: str = Field(..., max_length=255, description="Web URL to course platform")
    course_title: str = Field(..., min_length=2, max_length=100, description="Title of the course")
    provider_id: Optional[int] = Field(None, description="Foreign key to dbo.CourseProviders")
    category_id: Optional[int] = Field(None, description="Foreign key to dbo.CourseCategories")
    course_email_id: Optional[int] = Field(None, description="Foreign key to dbo.CourseEmails")
    provider_name: Optional[str] = Field(None, max_length=50, description="Provider name")
    category_name: Optional[str] = Field(None, max_length=50, description="Category name")
    duration: Optional[str] = Field(None, max_length=50, description="Course length (e.g., 20h 30m)")
    duration_minutes: Optional[int] = Field(None, description="Course length in minutes")
    course_account_email: Optional[str] = Field(None, max_length=100, description="Registered organizational/L&D account email")
    price: Optional[int] = Field(default=0, description="Course purchase price in INR (whole number)")
    description: Optional[str] = Field(None, max_length=500)
    supported_document: Optional[str] = Field(None, max_length=255, description="Supported document or attachment file name")
    course_thumbnail_name: Optional[str] = None
    course_thumbnail_size: Optional[int] = None
    request_id: Optional[int] = Field(None, description="Linked new course request ID from lms_request_new_course")
    claim_id: Optional[str] = Field(None, max_length=50, description="13-character claim ID (e.g. CLM-2026-0030)")
    is_active: bool = True
    hr_status: Optional[str] = Field(default="Pending", max_length=20, description="HR reimbursement status: Pending, Approved, Rejected")
    created_by: Optional[str] = Field(default=None, max_length=7, description="Employee code of creator")
    updated_by: Optional[str] = Field(default=None, max_length=7, description="Employee code of updater")

    @field_validator("course_title")
    @classmethod
    def clean_title(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Course title cannot be empty")
        return trimmed

    model_config = {
        "json_schema_extra": {
            "example": {
                "course_url": "https://www.udemy.com/course/docker-and-kubernetes-the-complete-guide/",
                "course_title": "Docker and Kubernetes: The Complete Guide",
                "provider_name": "UDEMY",
                "category_name": "DEVOPS",
                "duration": "23h 30m",
                "course_account_email": "lnd.admin@emergertech.com",
                "price": 2999,
                "description": "Master Docker, Kubernetes, compose, and multi-container deployments.",
                "supported_document": "docker-k8s-guide.png",
                "is_active": True,
                "request_id": 1,
                "claim_id": "CLM-2026-0030"
            }
        }
    }

class CourseUpdate(BaseModel):
    course_title: Optional[str] = Field(None, min_length=2, max_length=100)
    course_url: Optional[str] = Field(None, max_length=255)
    provider_id: Optional[int] = None
    category_id: Optional[int] = None
    course_email_id: Optional[int] = None
    provider_name: Optional[str] = Field(None, max_length=50)
    category_name: Optional[str] = Field(None, max_length=50)
    duration: Optional[str] = None
    duration_minutes: Optional[int] = None
    price: Optional[int] = None
    course_account_email: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    supported_document: Optional[str] = None
    course_thumbnail_name: Optional[str] = None
    course_thumbnail_size: Optional[int] = None
    claim_id: Optional[str] = Field(None, max_length=50)
    hr_status: Optional[str] = Field(None, max_length=20)
    hr_reviewed_at: Optional[str] = None
    hr_id: Optional[int] = None
    request_id: Optional[int] = None
    is_active: Optional[bool] = None
    updated_by: Optional[str] = Field(None, max_length=7)

class CourseResponse(BaseModel):
    id: int
    claim_id: Optional[str] = None
    course_code: Optional[str] = None
    course_url: Optional[str] = ""
    course_title: str
    provider_id: Optional[int] = None
    category_id: Optional[int] = None
    course_email_id: Optional[int] = None
    provider_name: Optional[str] = None
    category_name: Optional[str] = None
    duration: Optional[str] = None
    duration_minutes: Optional[int] = None
    price: Optional[int] = 0
    course_account_email: Optional[str] = ""
    description: Optional[str] = None
    supported_document: Optional[str] = None
    course_thumbnail_name: Optional[str] = None
    course_thumbnail_size: Optional[int] = None
    is_active: bool = True
    hr_status: Optional[str] = "Pending"
    payment_status: Optional[str] = "Pending Payment"
    hr_reviewed_at: Optional[str] = None
    hr_id: Optional[int] = None
    request_id: Optional[int] = None
    paid_on: Optional[str] = None
    payment_code: Optional[str] = None
    payment_slip_path: Optional[str] = None
    payment_slip_name: Optional[str] = None
    payment_description: Optional[str] = None

    # Pipeline audit fields resolved from lms_request_new_course & creator
    creator_name: Optional[str] = None
    employee_name: Optional[str] = None
    employee_role: Optional[str] = None
    employee_department: Optional[str] = None
    department: Optional[str] = None
    employee_request_date: Optional[str] = None
    ld_approval_date: Optional[str] = None
    ceo_status_date: Optional[str] = None
    course_request_code: Optional[str] = None
    stages: Optional[List[Dict[str, Any]]] = None

    created_at: Optional[str] = None
    created_by: Optional[str] = None
    updated_at: Optional[str] = None
    updated_by: Optional[str] = None

