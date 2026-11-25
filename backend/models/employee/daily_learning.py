"""
Pydantic models for Employee Daily Learning Log.
Matches frontend/src/pages/employee/Daily_Learning.jsx and LearningForm.jsx.
Strictly aligned with dbo.lms_learning_logs schema.
"""

from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class LearningLogCreate(BaseModel):
    employee_id: str = Field(..., min_length=1, max_length=7, description="Employee code (max 7 chars)")
    course_id: Optional[int] = Field(None, description="Enrolled course ID")
    video_duration_minutes: Optional[int] = Field(None, ge=0, description="Video watch duration in minutes")
    practice_duration_minutes: Optional[int] = Field(None, ge=0, description="Practice duration in minutes")
    learning_notes: Optional[str] = Field(None, max_length=250, description="Summary notes of session (max 250 chars)")
    points: Optional[int] = Field(default=0, ge=0, description="Gamification points earned")
    created_by: Optional[str] = Field(None, max_length=7, description="Creator employee ID (max 7 chars)")


class LearningLogResponse(BaseModel):
    id: int
    employee_id: str
    course_id: Optional[int] = None
    video_duration_minutes: Optional[int] = None
    practice_duration_minutes: Optional[int] = None
    learning_notes: Optional[str] = None
    points: Optional[int] = None
    created_at: Optional[datetime] = None
    created_by: Optional[str] = None
    updated_at: Optional[datetime] = None
    updated_by: Optional[str] = None

