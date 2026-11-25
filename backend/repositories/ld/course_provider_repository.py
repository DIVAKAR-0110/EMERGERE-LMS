"""
Course Provider Repository.
Data access layer executing pure parameterized SQL queries (?).
No transaction management (commit/rollback) here.
"""

from typing import List, Dict, Any, Optional
from database.connection import dictfetchall, dictfetchone

def get_all_providers(cursor, is_active: Optional[bool] = None) -> List[Dict[str, Any]]:
    if is_active is not None:
        cursor.execute(
            "SELECT * FROM lms_course_providers WHERE is_active = ? ORDER BY provider_name ASC",
            (1 if is_active else 0,)
        )
    else:
        cursor.execute("SELECT * FROM lms_course_providers ORDER BY provider_name ASC")
    return dictfetchall(cursor)

def get_provider_by_id(cursor, id: int) -> Optional[Dict[str, Any]]:
    cursor.execute("SELECT * FROM lms_course_providers WHERE id = ?", (id,))
    return dictfetchone(cursor)

def get_provider_by_code(cursor, provider_code: str) -> Optional[Dict[str, Any]]:
    cursor.execute("SELECT * FROM lms_course_providers WHERE provider_code = ?", (provider_code,))
    return dictfetchone(cursor)

def get_provider_by_name(cursor, provider_name: str) -> Optional[Dict[str, Any]]:
    cursor.execute("SELECT * FROM lms_course_providers WHERE provider_name = ?", (provider_name.upper(),))
    return dictfetchone(cursor)

def insert_provider(
    cursor,
    provider_code: str,
    provider_name: str,
    description: Optional[str] = None,
    website_url: Optional[str] = None,
    logo_url: Optional[str] = None,
    is_active: bool = True,
    created_by: str = "SYSTEM",
    updated_by: str = "SYSTEM"
) -> int:
    cursor.execute(
        """
        INSERT INTO lms_course_providers (provider_code, provider_name, description, website_url, logo_url, is_active, created_by, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (provider_code, provider_name.upper(), description, website_url, logo_url, 1 if is_active else 0, created_by, updated_by)
    )
    # Return inserted ID
    cursor.execute("SELECT @@IDENTITY AS id")
    row = cursor.fetchone()
    return int(row[0]) if row and row[0] else 0

def update_provider(
    cursor,
    provider_name: str,
    description: Optional[str] = None,
    website_url: Optional[str] = None,
    logo_url: Optional[str] = None,
    is_active: Optional[bool] = None,
    updated_by: Optional[str] = None
) -> None:
    fields = []
    params = []
    if description is not None:
        fields.append("description = ?")
        params.append(description)
    if website_url is not None:
        fields.append("website_url = ?")
        params.append(website_url)
    if logo_url is not None:
        fields.append("logo_url = ?")
        params.append(logo_url)
    if is_active is not None:
        fields.append("is_active = ?")
        params.append(1 if is_active else 0)
    if updated_by is not None:
        fields.append("updated_by = ?")
        params.append(updated_by)

    if not fields:
        return

    fields.append("updated_at = SYSDATETIME()")
    query = f"UPDATE lms_course_providers SET {', '.join(fields)} WHERE provider_name = ?"
    params.append(provider_name.upper())
    cursor.execute(query, tuple(params))

def delete_provider(cursor, provider_name: str) -> None:
    cursor.execute("DELETE FROM lms_course_providers WHERE provider_name = ?", (provider_name.upper(),))

