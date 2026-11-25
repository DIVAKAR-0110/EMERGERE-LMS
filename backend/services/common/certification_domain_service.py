"""
Service layer for certification domains metadata.
"""

from typing import Dict, Any, List, Optional
from repositories.common.certification_domain_repository import certification_domain_repository


class CertificationDomainService:
    """Business logic for active certification domains."""

    def get_active_domains(self) -> List[Dict[str, Any]]:
        return certification_domain_repository.get_active_domains()

    def create_domain(self, name: str, created_by: Optional[str] = None) -> Dict[str, Any]:
        return certification_domain_repository.create_or_get_domain(name, created_by=created_by)

    def resolve_domain_id(self, domain_name_or_id: Optional[Any], cursor=None) -> Optional[int]:
        return certification_domain_repository.resolve_domain_id(domain_name_or_id, cursor=cursor)


certification_domain_service = CertificationDomainService()
