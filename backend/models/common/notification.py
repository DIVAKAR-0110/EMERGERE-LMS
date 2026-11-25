"""
Notification & Course Recommendation Pydantic schemas.
"""

from typing import List, Optional, Any, Union
from pydantic import BaseModel, Field, field_validator

class CourseRecommendationCreate(BaseModel):
    course_id: Optional[int] = None
    study_material_id: Optional[int] = None
    course_title: str = Field(..., min_length=2, max_length=100)
    course_url: str = Field(..., min_length=5, max_length=500)
    employee_ids: List[Union[str, int]] = Field(..., min_length=1, description="List of recipient employee IDs or profile IDs")
    message: Optional[str] = Field(None, max_length=1000)
    resource_type: Optional[str] = Field("course", description="Resource type: course or material")
    due_date: Optional[str] = Field(None, max_length=50, description="Target completion due date (YYYY-MM-DD)")

    @field_validator("due_date", mode="before")
    @classmethod
    def clean_due_date(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        s = str(v).strip()
        # Handle ISO strings with timezone offsets (e.g. 2026-10-31T18:30:00Z -> 2026-11-01 in UTC+5:30)
        if "T" in s:
            from datetime import datetime, timezone, timedelta
            try:
                # Parse ISO and normalize to local calendar date YYYY-MM-DD
                dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
                # If UTC+5:30 or local offset
                local_dt = dt.astimezone(timezone(timedelta(hours=5, minutes=30)))
                return local_dt.strftime("%Y-%m-%d")
            except Exception:
                return s.split("T")[0]
        return s[:10]

class CourseRecommendationRequestCreate(BaseModel):
    course_name: str = Field(..., min_length=2, max_length=100, description="Course name (max 100 chars)")
    provider_platform: Optional[str] = Field(None, max_length=50, description="Provider/Platform name (max 50 chars)")
    category: Optional[str] = Field(None, max_length=30, description="Course category (max 30 chars)")
    course_link: Optional[str] = Field(None, max_length=255, description="Course URL (max 255 chars)")
    required_reason: Optional[str] = Field(None, max_length=500, description="Reason for request (max 500 chars)")

class NotificationResponse(BaseModel):
    notification_id: int
    recipient_user_id: Optional[int] = 0
    employee_id: Optional[str] = None
    notification_type: Optional[str] = "NOTIFICATION"
    reference_id: Optional[int] = None
    title: Optional[str] = "Notification"
    message: str
    is_read: bool = False
    created_at: str
    course_id: Optional[int] = None
    course_url: Optional[str] = None
    course_title: Optional[str] = None
    provider_name: Optional[str] = None
    category_name: Optional[str] = None
    duration: Optional[Union[str, int]] = None
    recommender_name: Optional[str] = None
    recommender_email: Optional[str] = None
    requester_name: Optional[str] = None
    course_request_id: Optional[str] = None
    request_code: Optional[str] = None
    notification_scope: Optional[str] = "EMPLOYEE"

