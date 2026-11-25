"""
Workshops & Training Router.
Presentation layer exposing RESTful endpoints for Workshops and Training events.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, status, Query, Request
from models.ld.workshops_training import WorkshopCreate, WorkshopUpdate, WorkshopResponse, WorkshopStatsResponse
from services.ld.workshops_training_service import workshop_service

router = APIRouter(prefix="/workshops", tags=["Workshops & Training"])


@router.get("", response_model=List[WorkshopResponse])
def list_workshops(
    search: Optional[str] = Query(None, description="Search by event name or department")
):
    """Retrieve all workshops and training events."""
    return workshop_service.get_all(search=search)


@router.get("/stats", response_model=WorkshopStatsResponse)
def get_workshop_stats():
    """Retrieve summary KPI metrics for workshops & training."""
    return workshop_service.get_stats()


@router.get("/departments", response_model=List[str])
def get_workshop_departments():
    """Retrieve unique enterprise departments from Azure AD and workshops records."""
    return workshop_service.get_unique_departments()


@router.get("/{workshop_id}", response_model=WorkshopResponse)
def get_workshop(workshop_id: int):
    """Retrieve a single workshop event by ID."""
    return workshop_service.get_by_id(workshop_id)


@router.post("", response_model=WorkshopResponse, status_code=status.HTTP_201_CREATED)
def create_workshop(data: WorkshopCreate, request: Request):
    """Create a new event / workshop record."""
    user_header = request.headers.get("x-employee-id") or request.headers.get("x-user-id") or "L&D Admin"
    payload = data.model_dump()
    return workshop_service.create(payload, created_by=user_header)


@router.put("/{workshop_id}", response_model=WorkshopResponse)
def update_workshop(workshop_id: int, data: WorkshopUpdate, request: Request):
    """Update details of an existing workshop event."""
    user_header = request.headers.get("x-employee-id") or request.headers.get("x-user-id") or "L&D Admin"
    payload = {k: v for k, v in data.model_dump().items() if v is not None}
    return workshop_service.update(workshop_id, payload, updated_by=user_header)


@router.delete("/{workshop_id}")
def delete_workshop(workshop_id: int):
    """Delete a workshop event."""
    return workshop_service.delete(workshop_id)
