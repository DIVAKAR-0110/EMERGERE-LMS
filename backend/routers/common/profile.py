"""
Profile Router.
Presentation layer exposing professional RESTful endpoints for the LMS Profile module:
- GET /api/profile/view (View authenticated employee's full profile)
- GET /api/profile/view/{employee_id} (View specific employee's profile by ID)
- PUT /api/profile/update (Update profile basic info, skills, certs, and interests)
- POST /api/profile/avatar/update (Update profile avatar)
"""

from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from utils.auth import get_current_user
from services.common.profile_service import profile_service
from models.common.profile import ProfileResponse, ProfileUpdateRequest, BasicInfoSchema

router = APIRouter(prefix="/profile", tags=["Profile Management"])

class AvatarUpdateRequest(BaseModel):
    avatarUrl: Optional[str] = None

# --- Professional Profile Endpoints ---

@router.get("/view", response_model=ProfileResponse)
@router.get("/me", response_model=ProfileResponse, include_in_schema=False)
def view_my_profile(user: Dict[str, Any] = Depends(get_current_user)):
    """Retrieve full profile of the currently authenticated employee."""
    return profile_service.get_full_profile(user)

@router.get("/view/{employee_id}", response_model=ProfileResponse)
@router.get("/{employee_id}", response_model=ProfileResponse, include_in_schema=False)
def view_employee_profile(
    employee_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Retrieve profile of a specific employee (for managers, peers, or L&D)."""
    return profile_service.get_full_profile(employee_id)

@router.put("/update", response_model=ProfileResponse)
@router.put("/me", response_model=ProfileResponse, include_in_schema=False)
def update_profile(
    update_data: ProfileUpdateRequest,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Update employee profile sections (Skills, Expertise, Certifications, Interests, LinkedIn/Avatar)."""
    return profile_service.save_full_profile(user, update_data)

@router.post("/avatar/update", response_model=ProfileResponse)
@router.post("/me/avatar", response_model=ProfileResponse, include_in_schema=False)
def update_avatar(
    payload: AvatarUpdateRequest,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """Update profile avatar URL / base64 string for the authenticated employee."""
    update_req = ProfileUpdateRequest(
        basicInfo=BasicInfoSchema(avatarUrl=payload.avatarUrl)
    )
    return profile_service.save_full_profile(user, update_req)

