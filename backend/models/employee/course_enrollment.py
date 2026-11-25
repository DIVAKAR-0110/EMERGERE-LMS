"""
Pydantic models for Course Enrollment Requests.
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class EnrollmentRequestCreate(BaseModel):
    course_id: int = Field(..., description="Target course ID to enroll in")
    employee_id: Optional[str] = Field(None, max_length=7, description="Employee identifier (max 7 chars)")
    employee_name: Optional[str] = Field(None, description="Employee display name")
    employee_email: Optional[str] = Field(None, description="Employee corporate email")
    employee_role: Optional[str] = Field(None, description="Job title / role")

class UnenrollRequest(BaseModel):
    course_id: int = Field(..., description="Target course ID to unenroll from")
    employee_id: Optional[str] = Field(None, max_length=7, description="Employee identifier")
    reason: Optional[str] = Field(None, max_length=250, description="Optional drop reason")

class OtherEmployeeDTO(BaseModel):
    name: str
    empId: str
    role: Optional[str] = None
    initials: Optional[str] = None
    avatarBg: Optional[str] = None
    isRequestedBy: Optional[bool] = False

class EnrollmentResponse(BaseModel):
    enrollment_id: int
    request_id: str
    course_id: int
    course_title: Optional[str] = None
    provider_name: Optional[str] = None
    employee_id: str
    employee_name: str
    employee_email: str
    employee_role: Optional[str] = None
    initials: Optional[str] = None
    avatar_bg: Optional[str] = None
    requested_on: str
    action_status: str
    on_hold_date: Optional[str] = None
    on_hold_reason: Optional[str] = None
    approved_date: Optional[str] = None
    approved_by: Optional[str] = None
    active_users: Optional[str] = "1/4"
    active_users_status: Optional[str] = "(3 Available)"
    is_full: Optional[bool] = False
    other_employees: Optional[List[Dict[str, Any]]] = []
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
