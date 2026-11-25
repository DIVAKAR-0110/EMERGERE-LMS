"""
Pydantic schemas for Authentication, Microsoft Entra ID Profiles, and User Identity.
"""

from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field

class UserProfileSchema(BaseModel):
    employee_id: str
    microsoft_object_id: Optional[str] = None
    name: str
    full_name: str
    display_name: Optional[str] = None
    email: str
    work_email: str
    role: str
    job_title: str
    department: str
    job_location: str
    mobile_number: str
    reporting_manager: str
    reporting_manager_id: Optional[str] = None
    date_of_joining: str
    linkedin_url: Optional[str] = None
    is_active: bool = True
    access_profile: Optional[Dict[str, Any]] = None

class DevLoginRequest(BaseModel):
    employee_id: str = Field(..., description="Target employee ID ")

class RoleUpdateRequest(BaseModel):
    role: str = Field(..., description="Target role e.g. Employee, Reporting Manager, L&D Team, HR Team, CEO")

class AuthResponse(BaseModel):
    authenticated: bool
    user: Optional[UserProfileSchema] = None
    token: Optional[str] = None
    access_profile: Optional[Dict[str, Any]] = None

class LogoutRequest(BaseModel):
    employee_id: Optional[str] = Field(None, description="Employee code performing logout")

class DailyLogItemResponse(BaseModel):
    employee_id: str
    log_date: str
    day_first_login: Optional[str] = None
    day_last_logout: Optional[str] = None
    total_sessions: int = 1
    duration_minutes: Optional[int] = None
    duration_formatted: Optional[str] = None
    is_active_today: bool = False

class EmployeeLogSessionResponse(BaseModel):
    id: int
    employee_id: str
    last_logged_in: str
    last_logged_out: Optional[str] = None
    duration_minutes: Optional[int] = None
    status: str = "Completed"
