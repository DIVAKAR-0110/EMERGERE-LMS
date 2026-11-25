"""
Repository for live CourseProviders and CourseCategories database tables.
Queries only active records (IsActive = 1), guarantees case-insensitive uniqueness,
and persists genuinely new custom provider/category entries into DB.
"""

import re
from typing import List, Dict, Any, Optional
from database.connection import connect_db, dictfetchall, is_sql_server


def _normalize_whitespace(value: Optional[Any]) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def _deduplicate_items(rows: List[Dict[str, Any]], id_key: str, name_key: str, field_alias: str) -> List[Dict[str, Any]]:
    """Return case-insensitively deduplicated active items preserving first-seen DB order."""
    seen = set()
    items: List[Dict[str, Any]] = []
    for row in rows:
        raw_name = _normalize_whitespace(row.get(name_key))
        if not raw_name:
            continue
        norm_key = raw_name.casefold()
        if norm_key in seen:
            continue
        seen.add(norm_key)
        item_id = row.get(id_key)
        items.append({
            "id": item_id,
            id_key: item_id,
            "name": raw_name,
            field_alias: raw_name,
            name_key: raw_name,
            "value": raw_name,
            "label": raw_name,
            "is_active": bool(row.get("IsActive", 1)),
        })
    return items


class CourseMetadataRepository:
    """Data access layer for dbo.CourseProviders and dbo.CourseCategories."""

    def get_active_providers(self, cursor=None) -> List[Dict[str, Any]]:
        owns_conn = cursor is None
        conn = connect_db() if owns_conn else None
        cur = conn.cursor() if owns_conn else cursor
        try:
            if is_sql_server():
                cur.execute(
                    """
                    SELECT ProviderId, ProviderName, IsActive
                    FROM dbo.CourseProviders
                    WHERE IsActive = 1
                      AND LTRIM(RTRIM(ISNULL(ProviderName, N''))) <> N''
                    ORDER BY ProviderId ASC
                    """
                )
            else:
                cur.execute(
                    """
                    SELECT ProviderId, ProviderName, IsActive
                    FROM CourseProviders
                    WHERE IsActive = 1
                      AND TRIM(COALESCE(ProviderName, '')) <> ''
                    ORDER BY ProviderId ASC
                    """
                )
            rows = dictfetchall(cur)
            return _deduplicate_items(rows, "ProviderId", "ProviderName", "provider_name")
        finally:
            if owns_conn and conn is not None:
                conn.close()

    def get_active_categories(self, cursor=None) -> List[Dict[str, Any]]:
        owns_conn = cursor is None
        conn = connect_db() if owns_conn else None
        cur = conn.cursor() if owns_conn else cursor
        try:
            if is_sql_server():
                cur.execute(
                    """
                    SELECT CategoryId, CategoryName, IsActive
                    FROM dbo.CourseCategories
                    WHERE IsActive = 1
                      AND LTRIM(RTRIM(ISNULL(CategoryName, N''))) <> N''
                    ORDER BY CategoryId ASC
                    """
                )
            else:
                cur.execute(
                    """
                    SELECT CategoryId, CategoryName, IsActive
                    FROM CourseCategories
                    WHERE IsActive = 1
                      AND TRIM(COALESCE(CategoryName, '')) <> ''
                    ORDER BY CategoryId ASC
                    """
                )
            rows = dictfetchall(cur)
            return _deduplicate_items(rows, "CategoryId", "CategoryName", "category_name")
        finally:
            if owns_conn and conn is not None:
                conn.close()

    def get_active_course_emails(self, cursor=None) -> List[Dict[str, Any]]:
        owns_conn = cursor is None
        conn = connect_db() if owns_conn else None
        cur = conn.cursor() if owns_conn else cursor
        try:
            if is_sql_server():
                cur.execute(
                    """
                    SELECT CourseEmailId, CourseEmail, IsActive
                    FROM dbo.CourseEmails
                    WHERE IsActive = 1
                      AND LTRIM(RTRIM(ISNULL(CourseEmail, N''))) <> N''
                    ORDER BY CourseEmailId ASC
                    """
                )
            else:
                cur.execute(
                    """
                    SELECT CourseEmailId, CourseEmail, IsActive
                    FROM CourseEmails
                    WHERE IsActive = 1
                      AND TRIM(COALESCE(CourseEmail, '')) <> ''
                    ORDER BY CourseEmailId ASC
                    """
                )
            rows = dictfetchall(cur)
            return _deduplicate_items(rows, "CourseEmailId", "CourseEmail", "course_email")
        finally:
            if owns_conn and conn is not None:
                conn.close()

    def _upsert_metadata_row(
        self,
        cleaned: str,
        table_sql: str,
        table_sqlite: str,
        id_col: str,
        name_col: str,
        cursor=None,
    ) -> Dict[str, Any]:
        """Finds an existing entry case-insensitively (reactivating if needed) or inserts a new active row."""
        cleaned = cleaned[:150]
        owns_conn = cursor is None
        conn = connect_db() if owns_conn else None
        cur = conn.cursor() if owns_conn else cursor
        try:
            sql_server = is_sql_server()
            tbl = table_sql if sql_server else table_sqlite
            trim_expr = f"LTRIM(RTRIM({name_col}))" if sql_server else f"TRIM({name_col})"
            top_clause = "TOP 1 " if sql_server else ""
            limit_clause = "" if sql_server else " LIMIT 1"

            cur.execute(
                f"SELECT {top_clause}{id_col}, {name_col}, IsActive FROM {tbl} WHERE LOWER({trim_expr}) = LOWER(?){limit_clause}",
                (cleaned,),
            )
            row = cur.fetchone()
            if row and row[1]:
                item_id = row[0]
                canonical_name = _normalize_whitespace(row[1])
                if not row[2]:
                    cur.execute(
                        f"UPDATE {tbl} SET IsActive = 1 WHERE {id_col} = ?",
                        (item_id,),
                    )
                    if owns_conn and conn is not None:
                        conn.commit()
                return {"id": item_id, "name": canonical_name, "created": False}

            try:
                if sql_server:
                    cur.execute(
                        f"INSERT INTO {tbl} ({name_col}, IsActive) OUTPUT INSERTED.{id_col}, INSERTED.{name_col} VALUES (?, 1)",
                        (cleaned,),
                    )
                    ins_row = cur.fetchone()
                    item_id = ins_row[0] if ins_row else None
                    canonical_name = _normalize_whitespace(ins_row[1]) if ins_row else cleaned
                else:
                    cur.execute(
                        f"INSERT INTO {tbl} ({name_col}, IsActive) VALUES (?, 1)",
                        (cleaned,),
                    )
                    item_id = cur.lastrowid
                    canonical_name = cleaned
                if owns_conn and conn is not None:
                    conn.commit()
                return {"id": item_id, "name": canonical_name, "created": True}
            except Exception:
                # Handle concurrent insert on unique constraint gracefully
                cur.execute(
                    f"SELECT {top_clause}{id_col}, {name_col} FROM {tbl} WHERE LOWER({trim_expr}) = LOWER(?){limit_clause}",
                    (cleaned,),
                )
                retry_row = cur.fetchone()
                if retry_row and retry_row[1]:
                    return {
                        "id": retry_row[0],
                        "name": _normalize_whitespace(retry_row[1]),
                        "created": False,
                    }
                raise
        finally:
            if owns_conn and conn is not None:
                conn.close()

    def _ensure_item_exists(
        self,
        raw_val: Optional[Any],
        table_sql: str,
        table_sqlite: str,
        id_col: str,
        name_col: str,
        default_name: str,
        cursor=None,
    ) -> str:
        """
        Ensures a non-empty, non-'Other' name exists in the metadata table without
        case-insensitive duplicates, inserting it with IsActive = 1 if absent.
        """
        cleaned = _normalize_whitespace(raw_val)
        if not cleaned or cleaned.casefold() in {"other", "others"}:
            return default_name

        # If numeric ID was passed, resolve against active rows without inserting a number
        if cleaned.isdigit():
            target_id = int(cleaned)
            items = (
                self.get_active_providers(cursor=cursor)
                if name_col == "ProviderName"
                else self.get_active_categories(cursor=cursor)
            )
            for item in items:
                if item.get("id") == target_id:
                    return item["name"]
            return default_name

        if len(cleaned) < 2 or not re.search(r"[a-zA-Z]", cleaned):
            return default_name

        res = self._upsert_metadata_row(cleaned, table_sql, table_sqlite, id_col, name_col, cursor=cursor)
        return res["name"]

    def _create_or_get_item(
        self,
        raw_val: Optional[Any],
        table_sql: str,
        table_sqlite: str,
        id_col: str,
        name_col: str,
        field_alias: str,
    ) -> Dict[str, Any]:
        """Creates a new active item in the metadata table or returns/reactivates an existing match."""
        cleaned = _normalize_whitespace(raw_val)
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

        res = self._upsert_metadata_row(cleaned, table_sql, table_sqlite, id_col, name_col)
        item_id = res["id"]
        canonical_name = res["name"]
        return {
            "id": item_id,
            id_col: item_id,
            "name": canonical_name,
            field_alias: canonical_name,
            name_col: canonical_name,
            "value": canonical_name,
            "label": canonical_name,
            "is_active": True,
            "created": res["created"],
        }

    def create_or_get_provider(self, provider_name: str) -> Dict[str, Any]:
        return self._create_or_get_item(
            provider_name,
            "dbo.CourseProviders",
            "CourseProviders",
            "ProviderId",
            "ProviderName",
            "provider_name",
        )

    def create_or_get_category(self, category_name: str) -> Dict[str, Any]:
        return self._create_or_get_item(
            category_name,
            "dbo.CourseCategories",
            "CourseCategories",
            "CategoryId",
            "CategoryName",
            "category_name",
        )

    def normalize_metadata_name(self, val: Optional[Any], default: str) -> str:
        """Normalize a provider/category string without persisting it to metadata tables."""
        cleaned = _normalize_whitespace(val)
        if not cleaned or cleaned.casefold() in {"other", "others"}:
            return default
        return cleaned[:150]

    def ensure_provider_exists(self, provider_val: Optional[Any], cursor=None, default: str = "-") -> str:
        return self._ensure_item_exists(
            provider_val,
            "dbo.CourseProviders",
            "CourseProviders",
            "ProviderId",
            "ProviderName",
            default,
            cursor=cursor,
        )

    def resolve_provider_id(self, val: Optional[Any], cursor=None) -> Optional[int]:
        """Resolves an integer ProviderId from either an ID or a provider name string."""
        if val is None:
            return None
        if isinstance(val, int) or (isinstance(val, str) and str(val).strip().isdigit()):
            target_id = int(val)
            providers = self.get_active_providers(cursor=cursor)
            for p in providers:
                if p.get("id") == target_id or p.get("ProviderId") == target_id:
                    return target_id
            return target_id
        cleaned = _normalize_whitespace(val)
        if not cleaned or cleaned.casefold() in {"other", "others"}:
            return None
        res = self._upsert_metadata_row(
            cleaned,
            "dbo.CourseProviders",
            "CourseProviders",
            "ProviderId",
            "ProviderName",
            cursor=cursor,
        )
        return res.get("id")

    def ensure_category_exists(self, category_val: Optional[Any], cursor=None, default: str = "-") -> str:
        return self._ensure_item_exists(
            category_val,
            "dbo.CourseCategories",
            "CourseCategories",
            "CategoryId",
            "CategoryName",
            default,
            cursor=cursor,
        )

    def resolve_category_id(self, val: Optional[Any], cursor=None) -> Optional[int]:
        """Resolves an integer CategoryId from either an ID or a category name string."""
        if val is None:
            return None
        if isinstance(val, int) or (isinstance(val, str) and str(val).strip().isdigit()):
            target_id = int(val)
            categories = self.get_active_categories(cursor=cursor)
            for c in categories:
                if c.get("id") == target_id or c.get("CategoryId") == target_id:
                    return target_id
            return target_id
        cleaned = _normalize_whitespace(val)
        if not cleaned or cleaned.casefold() in {"other", "others"}:
            return None
        res = self._upsert_metadata_row(
            cleaned,
            "dbo.CourseCategories",
            "CourseCategories",
            "CategoryId",
            "CategoryName",
            cursor=cursor,
        )
        return res.get("id")

    def create_or_get_course_email(self, course_email: str) -> Dict[str, Any]:
        cleaned = (course_email or "").strip().lower()
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", cleaned):
            raise ValueError("Please enter a valid course account email address.")
        res = self._upsert_metadata_row(
            cleaned,
            "dbo.CourseEmails",
            "CourseEmails",
            "CourseEmailId",
            "CourseEmail",
        )
        item_id = res["id"]
        canonical_email = res["name"]
        return {
            "id": item_id,
            "CourseEmailId": item_id,
            "name": canonical_email,
            "course_email": canonical_email,
            "CourseEmail": canonical_email,
            "value": canonical_email,
            "label": canonical_email,
            "is_active": True,
            "created": res["created"],
        }

    def ensure_course_email_exists(self, email_val: Optional[Any], cursor=None, default: str = "-") -> str:
        return self._ensure_item_exists(
            email_val,
            "dbo.CourseEmails",
            "CourseEmails",
            "CourseEmailId",
            "CourseEmail",
            default,
            cursor=cursor,
        )

    def resolve_course_email_id(self, val: Optional[Any], cursor=None) -> Optional[int]:
        """Resolves an integer CourseEmailId from either an ID or an email string."""
        if val is None:
            return None
        if isinstance(val, int) or (isinstance(val, str) and str(val).strip().isdigit()):
            target_id = int(val)
            emails = self.get_active_course_emails(cursor=cursor)
            for e in emails:
                if e.get("id") == target_id or e.get("CourseEmailId") == target_id:
                    return target_id
            return target_id
        cleaned = (str(val) or "").strip().lower()
        if not cleaned or cleaned.casefold() in {"other", "others"}:
            return None
        if "@" not in cleaned and "outlook.com" in cleaned:
            cleaned = cleaned.replace("outlook.com", "@outlook.com")
        res = self._upsert_metadata_row(
            cleaned,
            "dbo.CourseEmails",
            "CourseEmails",
            "CourseEmailId",
            "CourseEmail",
            cursor=cursor,
        )
        return res.get("id")


course_metadata_repository = CourseMetadataRepository()
