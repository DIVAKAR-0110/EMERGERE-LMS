"""
Study Materials Router.
Presentation layer exposing RESTful endpoints for Study Materials uploaded by L&D.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, status, Query
from models.ld.study_material import StudyMaterialCreate, StudyMaterialUpdate, StudyMaterialResponse
from services.ld.study_material_service import study_material_service
from utils.auth import get_current_user, require_employee_id

router = APIRouter(prefix="/study-materials", tags=["Study Materials"])

@router.get("", response_model=List[StudyMaterialResponse])
def list_study_materials(
    is_active: Optional[bool] = Query(None, description="Filter active materials")
):
    """Retrieve all study materials uploaded by L&D."""
    return study_material_service.get_all(is_active=is_active)

@router.get("/{material_id}", response_model=StudyMaterialResponse)
def get_study_material(material_id: int):
    """Retrieve a single study material by ID."""
    return study_material_service.get_by_id(material_id)

@router.post("", response_model=StudyMaterialResponse, status_code=status.HTTP_201_CREATED)
def create_study_material(
    data: StudyMaterialCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Upload a new study material to catalogue by L&D."""
    data.created_by = require_employee_id(current_user, data.created_by)
    return study_material_service.create(data)

@router.put("/{material_id}", response_model=StudyMaterialResponse)
def update_study_material(material_id: int, data: StudyMaterialUpdate):
    """Update details of an existing study material."""
    return study_material_service.update(material_id, data)

@router.delete("/{material_id}")
def delete_study_material(material_id: int):
    """Delete a study material from the catalogue."""
    return study_material_service.delete(material_id)
