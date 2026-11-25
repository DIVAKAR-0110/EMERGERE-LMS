"""
Pydantic schemas for L&D Approvals Workflow Page.
Matches frontend/src/pages/L&D/ApprovalsWorkflow.jsx.
Contains review decision schemas for Course Requests, Certification Requests, and Reimbursements.
"""

from typing import Optional, Union, List, Any
from enum import Enum
from pydantic import BaseModel, Field, field_validator


# ==============================================================================
# 1. Enums for Workflow Stages and Decisions
# ==============================================================================

class StageNameEnum(str, Enum):
    REQUESTED = "Requested"
    REPORTING_MANAGER_REVIEW = "Reporting Manager Review"
    LD_REVIEW = "L&D Review"
    CEO_REVIEW = "CEO Review"
    APPROVED = "Approved"
    PURCHASED = "Purchased"
    REJECTED = "Rejected"


class StageStatusEnum(str, Enum):
    COMPLETED = "Completed"
    PENDING = "Pending"
    IN_PROGRESS = "In Progress"
    REJECTED = "Rejected"
    SKIPPED = "Skipped"


class DecisionStatusEnum(str, Enum):
    APPROVED = "Approved"
    REJECTED = "Rejected"
    PENDING = "Pending"


# ==============================================================================
# 2. Certification Request Approvals (L&D / CEO Review)
# ==============================================================================

class CertificationApprovalDecision(BaseModel):
    status: str = Field(..., pattern=r"^(Approved|Rejected|Pending)$", description="Approved, Rejected, or Pending")
    admin_id: Optional[Any] = Field(default=None, description="Admin or approver ID")
    comments: Optional[str] = Field(None, max_length=500, description="Approval / reopen comments")
    bypass_ceo: bool = Field(False, description="Allow L&D to bypass CEO approval stage")


class CertificationRequestStatusUpdate(BaseModel):
    request_status: str = Field(..., pattern=r"^(Pending|Approved|Rejected)$")
    updated_by: Optional[str] = Field(default=None, description="User updating status")


# ==============================================================================
# 3. Course Request Approvals (L&D / CEO Review)
# ==============================================================================

class CourseRequestDecision(BaseModel):
    status: DecisionStatusEnum = Field(..., description="'Approved', 'Rejected', or 'Pending'")
    comment: Optional[str] = Field(None, max_length=500, description="Review / reopen remarks")
    admin_id: Optional[Union[str, int]] = Field(default=None, description="Admin/CEO user ID (max 7 chars)")
    bypass_ceo: bool = Field(False, description="Allow L&D to bypass CEO approval stage")

    @field_validator("admin_id")
    @classmethod
    def validate_admin_id(cls, v: Optional[Union[str, int]]) -> Optional[str]:
        if v is None:
            return None
        s = str(v).strip()
        if len(s) > 7:
            raise ValueError(f"Admin ID cannot exceed 7 characters (got {s})")
        return s


class CourseRequestStageResponse(BaseModel):
    id: int
    request_code: Optional[str] = None
    request_id: Optional[int] = None
    stage_name: str
    stage_status: str
    stage_date: Optional[str] = None
    created_at: Optional[str] = None
    created_by: Optional[str] = None
    updated_at: Optional[str] = None
    updated_by: Optional[str] = None


# ==============================================================================
# 4. Enrollment & Reimbursement Status Updates
# ==============================================================================

class EnrollmentHoldRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=250, description="Reason for placing request on hold")


class ReimbursementClaimStatusUpdate(BaseModel):
    status: Optional[str] = None
    processing_status: Optional[str] = None
    comments: Optional[str] = None
    updated_by: Optional[str] = Field(default=None, max_length=7, description="Updating employee ID")

