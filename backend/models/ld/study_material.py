"""
Pydantic schemas for L&D Study Materials.
Aligns with attributes in dbo.lms_study_materials:
[id, title, description, category_type, file_type, material_type, file_path, created_at, created_by]
"""

from typing import Optional
from pydantic import BaseModel, Field, field_validator


class StudyMaterialCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=100, description="Title of study material")
    category_type: Optional[str] = Field(default="Development", max_length=50, description="Course category")
    file_type: Optional[str] = Field(default="PDF", max_length=20, description="Detected format (PDF, PPT, DOC, etc.)")
    description: Optional[str] = Field(None, max_length=250)
    file_path: str = Field(..., max_length=500, description="Storage path or document key")
    created_by: Optional[str] = Field(None, max_length=7, description="Employee ID of L&D creator")
    is_active: bool = True

    # Upload validation metadata
    material_file_name: Optional[str] = None
    material_file_size: Optional[int] = None

    @field_validator("title", "file_path")
    @classmethod
    def clean_required_str(cls, v: str) -> str:
        trimmed = (v or "").strip()
        if not trimmed:
            raise ValueError("Field cannot be empty")
        return trimmed


class StudyMaterialUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=100)
    category_type: Optional[str] = Field(None, max_length=50)
    file_type: Optional[str] = Field(None, max_length=20)
    description: Optional[str] = Field(None, max_length=250)
    file_path: Optional[str] = Field(None, max_length=500)
    is_active: Optional[bool] = None

    # Upload validation metadata
    material_file_name: Optional[str] = None
    material_file_size: Optional[int] = None


class StudyMaterialResponse(BaseModel):
    id: int
    title: str
    category_type: Optional[str] = "Development"
    file_type: Optional[str] = "PDF"
    description: Optional[str] = None
    file_path: Optional[str] = None
    is_active: bool = True
    created_at: Optional[str] = None
    created_by: Optional[str] = None
    updated_at: Optional[str] = None


__all__ = [
    "StudyMaterialCreate",
    "StudyMaterialUpdate",
    "StudyMaterialResponse",
]
