"""
Pydantic schemas for Workshops & Training.
Aligns strictly with the schema in dbo.lms_workshops_training:
[id, event_name, event_category, department, start_date, end_date, participants_count, event_type, actual_spent, created_at, created_by, updated_at, updated_by]
"""

from typing import Optional
from pydantic import BaseModel, Field


class WorkshopCreate(BaseModel):
    event_name: str = Field(..., min_length=2, max_length=255, description="Workshop or Training event name")
    event_category: str = Field("Workshop", description="Category: Workshop or Training")
    department: Optional[str] = Field(None, max_length=150, description="Department (e.g. Software Development, Cybersecurity)")
    start_date: str = Field(..., description="Date the event begins (YYYY-MM-DD)")
    end_date: Optional[str] = Field(None, description="Date the event finishes (YYYY-MM-DD)")
    participants_count: int = Field(0, ge=0, description="Actual number of attendees")
    event_type: str = Field("Paid", description="Type of event: Paid or Unpaid")
    actual_spent: float = Field(0.0, ge=0.0, description="Final amount spent on the event (in INR)")
    created_by: Optional[str] = Field(None, max_length=100)


class WorkshopUpdate(BaseModel):
    event_name: Optional[str] = Field(None, min_length=2, max_length=255)
    event_category: Optional[str] = None
    department: Optional[str] = Field(None, max_length=150)
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    participants_count: Optional[int] = Field(None, ge=0)
    event_type: Optional[str] = None
    actual_spent: Optional[float] = Field(None, ge=0.0)
    updated_by: Optional[str] = Field(None, max_length=100)


class WorkshopResponse(BaseModel):
    id: int
    event_name: str
    event_category: str = "Workshop"
    department: Optional[str] = None
    start_date: str
    end_date: Optional[str] = None
    participants_count: int
    event_type: str = "Paid"
    actual_spent: float
    created_at: Optional[str] = None
    created_by: Optional[str] = None
    updated_at: Optional[str] = None
    updated_by: Optional[str] = None


class WorkshopStatsResponse(BaseModel):
    total_events: int
    workshops_count: int = 0
    training_count: int = 0
    total_participants: int
    paid_events_count: int = 0
    paid_participants_count: int = 0
    unpaid_events_count: int = 0
    unpaid_participants_count: int = 0
    total_spent: float
    total_spent_formatted: str
