"""
Repository for dbo.lms_certification_domains.
Provides access to active certification domains and persists custom domains created via the 'Other' option.
"""

import re
from typing import List, Dict, Any, Optional
from database.connection import connect_db, dictfetchall, is_sql_server


def _normalize_whitespace(value: Optional[Any]) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


class CertificationDomainRepository:
    """Data access layer for dbo.lms_certification_domains."""

    def get_active_domains(self, cursor=None) -> List[Dict[str, Any]]:
        owns_conn = cursor is None
        conn = connect_db() if owns_conn else None
        cur = conn.cursor() if owns_conn else cursor
        try:
            tbl = "dbo.lms_certification_domains" if is_sql_server() else "lms_certification_domains"
            cur.execute(
                f"""
                SELECT domain_id, domain_name, is_active
                FROM {tbl}
                WHERE is_active = 1
                ORDER BY domain_id ASC
                """
            )
            rows = dictfetchall(cur)
            seen = set()
            items: List[Dict[str, Any]] = []
            for r in rows:
                raw_name = _normalize_whitespace(r.get("domain_name"))
                if not raw_name or raw_name.casefold() in seen or raw_name.casefold() in {"other", "others"}:
                    continue
                seen.add(raw_name.casefold())
                d_id = r.get("domain_id")
                items.append({
                    "id": d_id,
                    "domain_id": d_id,
                    "name": raw_name,
                    "domain_name": raw_name,
                    "value": raw_name,
                    "label": raw_name,
                    "is_active": bool(r.get("is_active", 1)),
                })
            return items
        finally:
            if owns_conn and conn is not None:
                conn.close()

    def create_or_get_domain(
        self,
        domain_name: str,
        created_by: Optional[str] = None,
        cursor=None
    ) -> Dict[str, Any]:
        """
        Retrieves existing domain by case-insensitive name, or inserts a new record into dbo.lms_certification_domains.
        """
        cleaned = _normalize_whitespace(domain_name)
        if not cleaned:
            raise ValueError("Domain name cannot be empty.")
        if cleaned.casefold() in {"other", "others"}:
            raise ValueError("Cannot persist 'Other' as a domain name.")
        if len(cleaned) < 2:
            raise ValueError("Domain name must be at least 2 characters.")
        if not re.search(r"[a-zA-Z]", cleaned):
            raise ValueError("Domain name must contain at least one letter.")

        owns_conn = cursor is None
        conn = connect_db() if owns_conn else None
        cur = conn.cursor() if owns_conn else cursor
        try:
            sql_server = is_sql_server()
            tbl = "dbo.lms_certification_domains" if sql_server else "lms_certification_domains"
            trim_expr = "LTRIM(RTRIM(domain_name))" if sql_server else "TRIM(domain_name)"
            top_clause = "TOP 1 " if sql_server else ""
            limit_clause = "" if sql_server else " LIMIT 1"

            cur.execute(
                f"SELECT {top_clause}domain_id, domain_name, is_active FROM {tbl} WHERE LOWER({trim_expr}) = LOWER(?){limit_clause}",
                (cleaned,),
            )
            row = cur.fetchone()
            if row and row[1]:
                d_id = row[0]
                canonical_name = _normalize_whitespace(row[1])
                if not row[2]:
                    cur.execute(f"UPDATE {tbl} SET is_active = 1 WHERE domain_id = ?", (d_id,))
                    if owns_conn and conn is not None:
                        conn.commit()
                return {
                    "id": d_id,
                    "domain_id": d_id,
                    "name": canonical_name,
                    "domain_name": canonical_name,
                    "created": False,
                }

            # Insert new domain
            clean_creator = str(created_by)[:7] if created_by else None
            try:
                if sql_server:
                    cur.execute(
                        f"""
                        INSERT INTO {tbl} (domain_name, is_active, created_at, created_by)
                        OUTPUT INSERTED.domain_id, INSERTED.domain_name
                        VALUES (?, 1, GETDATE(), ?)
                        """,
                        (cleaned, clean_creator),
                    )
                    ins_row = cur.fetchone()
                    d_id = ins_row[0] if ins_row else None
                    canonical_name = _normalize_whitespace(ins_row[1]) if ins_row else cleaned
                else:
                    cur.execute(
                        f"INSERT INTO {tbl} (domain_name, is_active, created_by) VALUES (?, 1, ?)",
                        (cleaned, clean_creator),
                    )
                    d_id = cur.lastrowid
                    canonical_name = cleaned

                if owns_conn and conn is not None:
                    conn.commit()
                return {
                    "id": d_id,
                    "domain_id": d_id,
                    "name": canonical_name,
                    "domain_name": canonical_name,
                    "created": True,
                }
            except Exception:
                # Handle concurrent insert
                cur.execute(
                    f"SELECT {top_clause}domain_id, domain_name FROM {tbl} WHERE LOWER({trim_expr}) = LOWER(?){limit_clause}",
                    (cleaned,),
                )
                retry_row = cur.fetchone()
                if retry_row and retry_row[1]:
                    return {
                        "id": retry_row[0],
                        "domain_id": retry_row[0],
                        "name": _normalize_whitespace(retry_row[1]),
                        "domain_name": _normalize_whitespace(retry_row[1]),
                        "created": False,
                    }
                raise
        finally:
            if owns_conn and conn is not None:
                conn.close()

    def resolve_domain_id(self, domain_name_or_id: Optional[Any], cursor=None) -> Optional[int]:
        """Resolves numeric domain_id or domain name into an integer domain_id FK."""
        if not domain_name_or_id:
            return None
        raw_str = str(domain_name_or_id).strip()
        if not raw_str or raw_str.casefold() in {"other", "others"}:
            return None

        if raw_str.isdigit():
            target_id = int(raw_str)
            active_domains = self.get_active_domains(cursor=cursor)
            for d in active_domains:
                if d.get("domain_id") == target_id:
                    return target_id
            return target_id

        # Name passed: lookup or create
        try:
            res = self.create_or_get_domain(raw_str, cursor=cursor)
            return res.get("domain_id")
        except Exception:
            return None


certification_domain_repository = CertificationDomainRepository()
