"""
Pydantic schemas for Employee Course Library Page.
Matches frontend/src/pages/employee/CourseLibrary.jsx and RequestCourseModal.jsx.
"""

from typing import Optional, Union, List, Dict, Any
from datetime import datetime, date
from enum import Enum
import html
from pydantic import BaseModel, Field, field_validator


# ==============================================================================
# 1. Course Request Form Schemas (RequestCourseModal.jsx)
# ==============================================================================

class CourseRequestCreate(BaseModel):
    employee_id: Optional[Union[str, int]] = Field(default=None, description="Requesting Employee ID (max 7 chars)")
    employee_name: Optional[str] = Field(default=None, description="Employee Name")
    employee_role: Optional[str] = Field(default=None, description="Employee Role / Department")
    course_name: str = Field(..., min_length=2, max_length=100, description="Name of the requested course")
    provider: Optional[str] = Field(default=None, max_length=150, description="Platform/Provider (e.g. Udemy, Coursera)")
    provider_id: Optional[int] = Field(default=None, description="FK to CourseProviders(ProviderId)")
    category: Optional[str] = Field(default=None, max_length=150, description="Category of the course")
    category_id: Optional[int] = Field(default=None, description="FK to CourseCategories(CategoryId)")
    course_link: Optional[str] = Field(None, max_length=255, description="URL of the course with query parameters and fragments intact")
    target_completion_date: Optional[Union[str, date]] = Field(default=None, description="Target completion date (YYYY-MM-DD)")
    reason: str = Field(..., min_length=1, max_length=500, description="Reason / justification for requesting")
    duration_minutes: Optional[int] = Field(default=None, description="Course duration in minutes")
    price: Optional[float] = Field(default=0.0, description="Estimated price in INR (whole number)")

    @field_validator("course_name")
    @classmethod
    def clean_course_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Course Name is required")
        return html.unescape(v.strip())

    @field_validator("category")
    @classmethod
    def clean_category(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v.strip():
            return v.strip()
        return None

    @field_validator("reason")
    @classmethod
    def clean_reason(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Reason is required")
        return v.strip()

    @field_validator("course_link")
    @classmethod
    def validate_course_link(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        trimmed = v.strip()
        if not (trimmed.startswith("http://") or trimmed.startswith("https://")):
            raise ValueError("Please enter a valid URL starting with http:// or https://")
        return trimmed

    @field_validator("target_completion_date", mode="before")
    @classmethod
    def validate_target_completion_date(cls, v: Any) -> Optional[str]:
        if not v:
            return None
        if isinstance(v, date):
            target_dt = v
            trimmed = target_dt.strftime("%Y-%m-%d")
        elif isinstance(v, str):
            trimmed = v.strip()
            try:
                target_dt = datetime.strptime(trimmed, "%Y-%m-%d").date()
            except ValueError:
                raise ValueError("Target completion date must be in YYYY-MM-DD format")
        else:
            raise ValueError("Target completion date must be in YYYY-MM-DD format")
        
        today = date.today()
        if target_dt <= today:
            raise ValueError("Target completion date must be a future date")
            
        if target_dt.weekday() in (5, 6): # 5=Saturday, 6=Sunday
            raise ValueError("Target completion date cannot fall on a weekend (Saturday or Sunday) according to company training policy. Please choose a weekday.")
        return trimmed

    @field_validator("price", mode="before")
    @classmethod
    def validate_cost_whole_number(cls, v: Any) -> Optional[float]:
        if v is None:
            return None
        if isinstance(v, str):
            trimmed = v.strip().replace("$", "").replace("₹", "").replace(",", "")
            if not trimmed:
                return 0.0
            if "." in trimmed:
                parts = trimmed.split(".")
                if len(parts) > 1 and parts[1] and int(parts[1]) > 0:
                    raise ValueError(f"Estimated cost must be a whole integer amount. Decimals (.{parts[1]}) cannot be silently truncated. Please enter a whole number or round to nearest integer.")
                v = float(parts[0])
            else:
                v = float(trimmed)
        elif isinstance(v, float):
            if not v.is_integer():
                raise ValueError("Estimated cost must be a whole integer amount. Decimals cannot be silently truncated. Please round to the nearest whole integer.")
        if v < 0:
            raise ValueError("Estimated cost cannot be negative")
        return float(v)

    @field_validator("employee_id")
    @classmethod
    def validate_employee_id(cls, v: Union[str, int]) -> str:
        s = str(v).strip()
        if not s:
            raise ValueError("Employee ID cannot be empty")
        if len(s) > 7:
            raise ValueError(f"Employee ID cannot exceed 7 characters (got {s})")
        return s


class TrackerStepStatusEnum(str, Enum):
    COMPLETED = "completed"
    COMPLETED_FINAL = "completed_final"
    PENDING = "pending"
    UPCOMING = "upcoming"
    REJECTED = "rejected"


class TrackerStep(BaseModel):
    id: int
    label: str
    subText: Optional[str] = ""
    date: Optional[str] = ""
    status: TrackerStepStatusEnum


class TrackerItem(BaseModel):
    id: int
    courseRequestId: str
    employeeId: Optional[str] = None
    employeeName: str
    employeeRole: str
    courseTitle: str
    provider: str
    category: Optional[str] = ""
    requestDate: Optional[str] = None
    estimatedCost: float
    steps: List[TrackerStep]


# ==============================================================================
# 2. Enrollment Action Schemas (Re-exported from models.employee.course_enrollment)
# ==============================================================================

from models.employee.course_enrollment import (
    EnrollmentRequestCreate,
    UnenrollRequest,
    OtherEmployeeDTO,
    EnrollmentResponse,
)

__all__ = [
    "CourseRequestCreate",
    "TrackerStepStatusEnum",
    "TrackerStep",
    "TrackerItem",
    "EnrollmentRequestCreate",
    "UnenrollRequest",
    "OtherEmployeeDTO",
    "EnrollmentResponse",
]

