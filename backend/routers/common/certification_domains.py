"""
FastAPI Router for certification domains.
Exposes active domains and allows dynamic creation of custom domains from 'Other' selections.
"""

from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status
from services.common.certification_domain_service import certification_domain_service
from utils.auth import get_current_user


class DomainCreatePayload(BaseModel):
    name: Optional[str] = Field(None, description="Domain name (e.g. Cloud Computing)")
    domain_name: Optional[str] = Field(None, description="Alternative field for domain name")


router = APIRouter(prefix="/certification-domains", tags=["Certification Domains"])


@router.get("", summary="Fetch active unique certification domains")
def get_certification_domains(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    domains = certification_domain_service.get_active_domains()
    return {
        "domains": domains,
        "domain_names": [d["name"] for d in domains],
    }


@router.post("", summary="Create or return an active certification domain")
def create_certification_domain(
    payload: DomainCreatePayload,
    user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    name = (payload.name or payload.domain_name or "").strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Domain name is required."
        )
    try:
        emp_id = user.get("employee_id") or user.get("id")
        item = certification_domain_service.create_domain(name, created_by=emp_id)
        return {"domain": item, **item}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
