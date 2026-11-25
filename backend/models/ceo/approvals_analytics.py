"""
Pydantic schemas for CEO Approvals & Analytics Page.
Matches frontend/src/pages/ceo/ApprovalsAnalytics.jsx.
Defines CEO review decisions for Course Requests and Certification Requests.
"""

from typing import Optional, Union, Any
from enum import Enum
from pydantic import BaseModel, Field, field_validator


class CEODecisionStatusEnum(str, Enum):
    APPROVED = "Approved"
    REJECTED = "Rejected"
    PENDING = "Pending"


# ==============================================================================
# 1. CEO Course Request Approval Decision Schema
# ==============================================================================

class CEOCourseApprovalDecision(BaseModel):
    status: Union[CEODecisionStatusEnum, str] = Field(..., description="'Approved' or 'Rejected'")
    comment: Optional[str] = Field(None, max_length=500, description="CEO review remarks")
    admin_id: Optional[Union[str, int]] = Field(default=None, description="CEO / Admin user ID (max 7 chars)")

    @field_validator("admin_id")
    @classmethod
    def validate_admin_id(cls, v: Optional[Union[str, int]]) -> Optional[str]:
        if v is None:
            return None
        s = str(v).strip()
        if len(s) > 7:
            raise ValueError(f"Admin ID cannot exceed 7 characters (got {s})")
        return s


# ==============================================================================
# 2. CEO Certification Request Approval Decision Schema
# ==============================================================================

class CEOCertificationApprovalDecision(BaseModel):
    status: str = Field(..., pattern=r"^(Approved|Rejected|Pending)$", description="Approved, Rejected, or Pending")
    admin_id: Optional[Any] = Field(default=None, description="CEO / Admin approver ID")
    comments: Optional[str] = Field(None, max_length=500, description="CEO approval comments / remarks")


# Aliases for 100% backward compatibility
CourseRequestDecision = CEOCourseApprovalDecision
CertificationApprovalDecision = CEOCertificationApprovalDecision

__all__ = [
    "CEODecisionStatusEnum",
    "CEOCourseApprovalDecision",
    "CEOCertificationApprovalDecision",
    "CourseRequestDecision",
    "CertificationApprovalDecision",
]

