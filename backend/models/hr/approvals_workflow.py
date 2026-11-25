"""
Pydantic schemas for HR Approvals Workflow Page.
Matches frontend/src/pages/hr/ApprovalsWorkflow.jsx.
Includes HR review decisions for Reimbursement Claims and Courses.
"""

from typing import Optional
from pydantic import BaseModel, Field


class ReimbursementHRDecision(BaseModel):
    status: str = Field(..., pattern=r"^(Approved|Rejected)$", description="'Approved' or 'Rejected'")
    comments: Optional[str] = Field(None, max_length=500, description="HR review comments")
    admin_id: Optional[str] = Field(default=None, max_length=7, description="HR reviewing Admin ID")


class CourseHRReview(BaseModel):
    hr_status: str = Field(..., max_length=20, description="'Approved' / 'Accept' or 'Rejected' / 'Reject'")
    hr_id: Optional[int] = Field(default=None, description="HR Profile ID from lms_employee_profiles")
    hr_employee_id: Optional[str] = Field(default=None, max_length=7, description="HR Employee ID code ")
    hr_email: Optional[str] = Field(default=None, max_length=50, description="HR Work Email")
    hr_comment: Optional[str] = Field(default=None, max_length=500, description="Optional review comment")

