"""
Course Request schemas.
Re-exports form models from models.employee.course_library
and approval decision models from models.ld.approvals_workflow.
"""

from typing import Optional, List
from pydantic import BaseModel

from models.employee.course_library import (
    CourseRequestCreate,
    TrackerStepStatusEnum,
    TrackerStep,
    TrackerItem,
)
from models.ld.approvals_workflow import (
    StageNameEnum,
    StageStatusEnum,
    DecisionStatusEnum,
    CourseRequestDecision,
    CourseRequestStageResponse,
)


class CourseRequestResponse(BaseModel):
    id: int
    request_code: str
    employee_id: str
    employee_name: str
    employee_role: str
    department: Optional[str] = None
    course_name: str
    provider: Optional[str] = None
    provider_id: Optional[int] = None
    category: Optional[str] = None
    category_id: Optional[int] = None
    course_link: Optional[str] = None
    target_completion_date: Optional[str] = None
    reason: Optional[str] = None
    duration_minutes: Optional[int] = None
    price: Optional[float] = 0.0
    created_at: Optional[str] = None
    created_by: Optional[str] = None
    updated_at: Optional[str] = None
    updated_by: Optional[str] = None
    ld_status: str
    ld_status_date: Optional[str] = None
    ld_comment: Optional[str] = None
    ceo_status: str
    ceo_status_date: Optional[str] = None
    ceo_comment: Optional[str] = None
    purchase_status: str
    purchase_date: Optional[str] = None
    notified_reporting_manager: Optional[str] = None
    is_ceo_bypassed: Optional[bool] = False
    reopen_reason: Optional[str] = None
    stages: Optional[List[CourseRequestStageResponse]] = None


__all__ = [
    "CourseRequestCreate",
    "TrackerStepStatusEnum",
    "TrackerStep",
    "TrackerItem",
    "StageNameEnum",
    "StageStatusEnum",
    "DecisionStatusEnum",
    "CourseRequestDecision",
    "CourseRequestStageResponse",
    "CourseRequestResponse",
]
