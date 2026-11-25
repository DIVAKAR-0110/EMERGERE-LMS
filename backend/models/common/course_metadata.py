"""Pydantic models for CourseProviders and CourseCategories metadata."""

import re
from pydantic import BaseModel, Field, field_validator


class MetadataEntryCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150, description="New provider or category name")

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        cleaned = re.sub(r"\s+", " ", (v or "").strip())
        if len(cleaned) < 2:
            raise ValueError("Name must be at least 2 characters.")
        if len(cleaned) > 150:
            raise ValueError("Name cannot exceed 150 characters.")
        if cleaned.casefold() in {"other", "others"}:
            raise ValueError("Please enter a valid custom name instead of 'Other'.")
        if cleaned.isdigit():
            raise ValueError("Name cannot be purely numeric.")
        if not re.search(r"[a-zA-Z]", cleaned):
            raise ValueError("Name must contain at least one letter.")
        return cleaned[:150]


class CourseEmailCreate(BaseModel):
    email: str = Field(..., min_length=5, max_length=255, description="Corporate course account email")

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        cleaned = (v or "").strip().lower()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", cleaned):
            raise ValueError("Please enter a valid course account email address (e.g. name@domain.com).")
        return cleaned[:255]


