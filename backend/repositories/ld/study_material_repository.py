"""
Study Material Repository.
Data access layer for dbo.lms_study_materials.
Executes pure parameterized SQL queries (?).
"""

from typing import List, Dict, Any, Optional
from database.connection import dictfetchall, dictfetchone


def get_all_materials(cursor, is_active: Optional[bool] = None) -> List[Dict[str, Any]]:
    """Retrieves all study materials from dbo.lms_study_materials."""
    try:
        query = """
            SELECT 
                m.id,
                m.title,
                COALESCE(m.category_type, 'Development') AS category_type,
                COALESCE(m.file_type, m.material_type, 'PDF') AS file_type,
                m.description,
                m.file_path,
                CAST(1 AS BIT) AS is_active,
                m.created_by,
                CONVERT(VARCHAR(19), m.created_at, 120) AS created_at,
                CONVERT(VARCHAR(19), m.created_at, 120) AS updated_at
            FROM dbo.lms_study_materials m
            ORDER BY m.created_at DESC, m.id DESC
        """
        cursor.execute(query)
    except Exception:
        # Fallback if category_type / file_type columns are not yet added
        query = """
            SELECT 
                m.id,
                m.title,
                'Development' AS category_type,
                COALESCE(m.material_type, 'PDF') AS file_type,
                m.description,
                m.file_path,
                CAST(1 AS BIT) AS is_active,
                m.created_by,
                CONVERT(VARCHAR(19), m.created_at, 120) AS created_at,
                CONVERT(VARCHAR(19), m.created_at, 120) AS updated_at
            FROM dbo.lms_study_materials m
            ORDER BY m.created_at DESC, m.id DESC
        """
        cursor.execute(query)

    rows = dictfetchall(cursor)
    for r in rows:
        r["is_active"] = bool(r.get("is_active", True))
    return rows


def get_material_by_id(cursor, material_id: int) -> Optional[Dict[str, Any]]:
    """Retrieves a single study material by ID."""
    try:
        query = """
            SELECT 
                m.id,
                m.title,
                COALESCE(m.category_type, 'Development') AS category_type,
                COALESCE(m.file_type, m.material_type, 'PDF') AS file_type,
                m.description,
                m.file_path,
                CAST(1 AS BIT) AS is_active,
                m.created_by,
                CONVERT(VARCHAR(19), m.created_at, 120) AS created_at,
                CONVERT(VARCHAR(19), m.created_at, 120) AS updated_at
            FROM dbo.lms_study_materials m
            WHERE m.id = ?
        """
        cursor.execute(query, (material_id,))
    except Exception:
        query = """
            SELECT 
                m.id,
                m.title,
                'Development' AS category_type,
                COALESCE(m.material_type, 'PDF') AS file_type,
                m.description,
                m.file_path,
                CAST(1 AS BIT) AS is_active,
                m.created_by,
                CONVERT(VARCHAR(19), m.created_at, 120) AS created_at,
                CONVERT(VARCHAR(19), m.created_at, 120) AS updated_at
            FROM dbo.lms_study_materials m
            WHERE m.id = ?
        """
        cursor.execute(query, (material_id,))

    row = dictfetchone(cursor)
    if row:
        row["is_active"] = bool(row.get("is_active", True))
    return row


def get_material_by_code(cursor, material_code: str) -> Optional[Dict[str, Any]]:
    return None


def insert_material(
    cursor,
    ld_id: Any = 1,
    title: Optional[str] = None,
    material_title: Optional[str] = None,
    category_type: Optional[str] = None,
    category: Optional[str] = None,
    file_type: Optional[str] = None,
    material_type: Optional[str] = None,
    file_path: Optional[str] = None,
    material_file: Optional[str] = None,
    description: Optional[str] = None,
    is_active: bool = True,
    created_by: str = "SYSTEM",
    updated_by: str = "SYSTEM",
    **kwargs
) -> int:
    """Inserts a new study material into dbo.lms_study_materials."""
    resolved_title = (title or material_title or "").strip()
    resolved_file = (file_path or material_file or "").strip()
    resolved_cat = (category_type or category or "Development").strip()
    resolved_ft = (file_type or "PDF").strip()
    resolved_mat = (material_type or resolved_ft or resolved_cat).strip()

    try:
        query = """
            INSERT INTO dbo.lms_study_materials (
                title, description, category_type, file_type, material_type, file_path, created_at, created_by
            )
            VALUES (?, ?, ?, ?, ?, ?, GETDATE(), ?)
        """
        cursor.execute(
            query,
            (
                resolved_title,
                (description or "")[:250],
                resolved_cat[:50],
                resolved_ft[:20],
                resolved_mat[:50],
                resolved_file[:500],
                (str(created_by) or "SYSTEM")[:7]
            )
        )
    except Exception:
        # Fallback if category_type / file_type not in schema yet
        fallback_query = """
            INSERT INTO dbo.lms_study_materials (
                title, description, material_type, file_path, created_at, created_by
            )
            VALUES (?, ?, ?, ?, GETDATE(), ?)
        """
        cursor.execute(
            fallback_query,
            (
                resolved_title,
                (description or "")[:250],
                resolved_mat[:50],
                resolved_file[:500],
                (str(created_by) or "SYSTEM")[:7]
            )
        )

    cursor.execute("SELECT @@IDENTITY AS id")
    row = cursor.fetchone()
    return int(row[0]) if row and row[0] else 0


def update_material(
    cursor,
    material_id: int,
    title: Optional[str] = None,
    material_title: Optional[str] = None,
    category_type: Optional[str] = None,
    category: Optional[str] = None,
    file_type: Optional[str] = None,
    material_type: Optional[str] = None,
    description: Optional[str] = None,
    file_path: Optional[str] = None,
    material_file: Optional[str] = None,
    is_active: Optional[bool] = None,
    updated_by: Optional[str] = None,
    **kwargs
) -> None:
    fields = []
    params = []
    resolved_title = title if title is not None else material_title
    if resolved_title is not None:
        fields.append("title = ?")
        params.append(resolved_title.strip())

    resolved_cat = category_type if category_type is not None else category
    if resolved_cat is not None:
        fields.append("category_type = ?")
        params.append(resolved_cat[:50])

    if file_type is not None:
        fields.append("file_type = ?")
        params.append(file_type[:20])

    if material_type is not None:
        fields.append("material_type = ?")
        params.append(material_type[:50])

    if description is not None:
        fields.append("description = ?")
        params.append(description[:250])

    resolved_file = file_path if file_path is not None else material_file
    if resolved_file is not None:
        fields.append("file_path = ?")
        params.append(resolved_file[:500])

    if not fields:
        return

    query = f"UPDATE dbo.lms_study_materials SET {', '.join(fields)} WHERE id = ?"
    params.append(material_id)
    try:
        cursor.execute(query, tuple(params))
    except Exception:
        # Fallback without category_type/file_type if not present
        safe_fields = []
        safe_params = []
        for f, p in zip(fields, params[:-1]):
            if "category_type" not in f and "file_type" not in f:
                safe_fields.append(f)
                safe_params.append(p)
        if safe_fields:
            safe_query = f"UPDATE dbo.lms_study_materials SET {', '.join(safe_fields)} WHERE id = ?"
            safe_params.append(material_id)
            cursor.execute(safe_query, tuple(safe_params))


def delete_material(cursor, material_id: int) -> None:
    cursor.execute("DELETE FROM dbo.lms_study_materials WHERE id = ?", (material_id,))
