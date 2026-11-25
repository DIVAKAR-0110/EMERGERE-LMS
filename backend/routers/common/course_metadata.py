"""
FastAPI Router for live Course Providers and Course Categories metadata.
Exposes active, unique values fetched from dbo.CourseProviders and dbo.CourseCategories.
"""

from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from models.common.course_metadata import MetadataEntryCreate, CourseEmailCreate
from services.common.course_metadata_service import course_metadata_service
from utils.auth import get_current_user

router = APIRouter(prefix="/course-metadata", tags=["Course Metadata"])


@router.get("", summary="Fetch active unique course providers and categories")
def get_course_metadata(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    return course_metadata_service.get_all_metadata()


@router.get("/providers", summary="Fetch active unique course providers")
def get_active_providers(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    providers = course_metadata_service.get_active_providers()
    return {
        "providers": providers,
        "provider_names": [p["name"] for p in providers],
    }


@router.post("/providers", summary="Create or return an active course provider")
def create_provider(
    payload: MetadataEntryCreate,
    user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    try:
        item = course_metadata_service.create_provider(payload.name)
        return {"provider": item, **item}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/categories", summary="Fetch active unique course categories")
def get_active_categories(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    categories = course_metadata_service.get_active_categories()
    return {
        "categories": categories,
        "category_names": [c["name"] for c in categories],
    }


@router.post("/categories", summary="Create or return an active course category")
def create_category(
    payload: MetadataEntryCreate,
    user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    try:
        item = course_metadata_service.create_category(payload.name)
        return {"category": item, **item}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/domains", summary="Fetch active unique certification domains")
def get_active_domains(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    domains = course_metadata_service.get_active_domains()
    return {
        "domains": domains,
        "domain_names": [d["name"] for d in domains],
    }


@router.post("/domains", summary="Create or return an active certification domain")
def create_domain(
    payload: MetadataEntryCreate,
    user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    try:
        emp_id = user.get("employee_id") or user.get("id")
        item = course_metadata_service.create_domain(payload.name, created_by=emp_id)
        return {"domain": item, **item}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/emails", summary="Fetch active unique corporate course account emails")
def get_active_course_emails(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    emails = course_metadata_service.get_active_course_emails()
    return {
        "emails": emails,
        "email_names": [e["name"] for e in emails],
    }


@router.post("/emails", summary="Create or return an active course account email")
def create_course_email(
    payload: CourseEmailCreate,
    user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    try:
        item = course_metadata_service.create_course_email(payload.email)
        return {"email": item, **item}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


