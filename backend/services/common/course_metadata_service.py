"""
Service layer for live CourseProviders and CourseCategories metadata.
"""

from typing import Dict, Any, List
from repositories.common.course_metadata_repository import course_metadata_repository
from repositories.common.certification_domain_repository import certification_domain_repository


class CourseMetadataService:
    """Business logic for live active course providers and categories."""

    def get_active_providers(self) -> List[Dict[str, Any]]:
        return course_metadata_repository.get_active_providers()

    def get_active_categories(self) -> List[Dict[str, Any]]:
        return course_metadata_repository.get_active_categories()

    def get_active_course_emails(self) -> List[Dict[str, Any]]:
        return course_metadata_repository.get_active_course_emails()

    def get_active_domains(self) -> List[Dict[str, Any]]:
        return certification_domain_repository.get_active_domains()

    def get_all_metadata(self) -> Dict[str, Any]:
        providers = self.get_active_providers()
        categories = self.get_active_categories()
        emails = self.get_active_course_emails()
        domains = self.get_active_domains()
        return {
            "providers": providers,
            "categories": categories,
            "emails": emails,
            "domains": domains,
            "provider_names": [p["name"] for p in providers],
            "category_names": [c["name"] for c in categories],
            "email_names": [e["name"] for e in emails],
            "domain_names": [d["name"] for d in domains],
        }

    def create_provider(self, name: str) -> Dict[str, Any]:
        return course_metadata_repository.create_or_get_provider(name)

    def create_category(self, name: str) -> Dict[str, Any]:
        return course_metadata_repository.create_or_get_category(name)

    def create_course_email(self, email: str) -> Dict[str, Any]:
        return course_metadata_repository.create_or_get_course_email(email)

    def create_domain(self, name: str, created_by: str = None) -> Dict[str, Any]:
        return certification_domain_repository.create_or_get_domain(name, created_by=created_by)


course_metadata_service = CourseMetadataService()

