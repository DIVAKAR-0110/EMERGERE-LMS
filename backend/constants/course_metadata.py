"""
Live Course Providers and Course Categories resolvers backed by dbo.CourseProviders and dbo.CourseCategories.
Static mock arrays have been removed.
"""

from typing import Optional, Any
from repositories.common.course_metadata_repository import course_metadata_repository


def resolve_provider_name(provider_val: Optional[Any], default: str = "Udemy", cursor=None) -> str:
    """Resolve a provider ID or name against active database CourseProviders (case-insensitive)."""
    if provider_val is None:
        return default
    providers = course_metadata_repository.get_active_providers(cursor=cursor)
    if isinstance(provider_val, int) or (isinstance(provider_val, str) and provider_val.strip().isdigit()):
        pid = int(str(provider_val).strip())
        for p in providers:
            if p.get("id") == pid:
                return p["name"]
        return default
    s = str(provider_val).strip()
    if not s:
        return default
    s_cf = s.casefold()
    for p in providers:
        if p["name"].casefold() == s_cf:
            return p["name"]
    return s


def resolve_category_name(category_val: Optional[Any], default: str = "Development", cursor=None) -> str:
    """Resolve a category ID or name against active database CourseCategories (case-insensitive)."""
    if category_val is None:
        return default
    categories = course_metadata_repository.get_active_categories(cursor=cursor)
    if isinstance(category_val, int) or (isinstance(category_val, str) and category_val.strip().isdigit()):
        cid = int(str(category_val).strip())
        for c in categories:
            if c.get("id") == cid:
                return c["name"]
        return default
    s = str(category_val).strip()
    if not s:
        return default
    s_cf = s.casefold()
    for c in categories:
        if c["name"].casefold() == s_cf:
            return c["name"]
    return s
