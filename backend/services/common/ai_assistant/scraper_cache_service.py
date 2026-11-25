"""
Scraper Cache Service.
Provides lightweight, high-performance SQLite-backed caching with 24-hour TTL
for external course web scraping and search queries.
Prevents repeated network requests, eliminates external rate limiting,
and delivers sub-10ms response times for learners.
"""

import os
import json
import sqlite3
import hashlib
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

DB_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
CACHE_DB_PATH = os.path.join(DB_DIR, "database", "scraper_cache.db")

class ScraperCacheService:
    def __init__(self, db_path: str = CACHE_DB_PATH):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        """Initializes the cache SQLite table if not exists."""
        try:
            os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
            with sqlite3.connect(self.db_path) as conn:
                cur = conn.cursor()
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS lms_scraped_course_cache (
                        query_hash TEXT PRIMARY KEY,
                        search_term TEXT NOT NULL,
                        courses_json TEXT NOT NULL,
                        course_count INTEGER NOT NULL,
                        created_at TEXT NOT NULL,
                        expires_at TEXT NOT NULL
                    )
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS idx_expires_at ON lms_scraped_course_cache(expires_at)")
                conn.commit()
        except Exception as e:
            print(f"[ScraperCacheService] Warning initializing cache DB: {e}")

    def _hash_query(self, query: str) -> str:
        """Generates SHA-256 hash for normalized search term."""
        norm = (query or "").strip().lower()
        return hashlib.sha256(norm.encode("utf-8")).hexdigest()

    def get_cached_courses(self, search_term: str) -> Optional[List[Dict[str, Any]]]:
        """
        Retrieves cached courses if present and not expired.
        Returns list of course dicts, or None if cache miss or expired.
        """
        if not search_term or not search_term.strip():
            return None

        q_hash = self._hash_query(search_term)
        now_str = datetime.utcnow().isoformat()

        try:
            with sqlite3.connect(self.db_path) as conn:
                cur = conn.cursor()
                cur.execute(
                    "SELECT courses_json, expires_at FROM lms_scraped_course_cache WHERE query_hash = ?",
                    (q_hash,)
                )
                row = cur.fetchone()
                if not row:
                    return None

                courses_json, expires_at_str = row[0], row[1]
                if expires_at_str < now_str:
                    # Expired, clean up
                    cur.execute("DELETE FROM lms_scraped_course_cache WHERE query_hash = ?", (q_hash,))
                    conn.commit()
                    return None

                courses = json.loads(courses_json)
                return courses
        except Exception as e:
            print(f"[ScraperCacheService] Cache read notice: {e}")
            return None

    def save_cached_courses(self, search_term: str, courses: List[Dict[str, Any]], ttl_hours: int = 24) -> bool:
        """
        Caches course search results for the given search term with TTL.
        """
        if not search_term or not courses:
            return False

        q_hash = self._hash_query(search_term)
        now = datetime.utcnow()
        now_str = now.isoformat()
        expires_at_str = (now + timedelta(hours=ttl_hours)).isoformat()

        try:
            with sqlite3.connect(self.db_path) as conn:
                cur = conn.cursor()
                cur.execute("""
                    INSERT INTO lms_scraped_course_cache 
                    (query_hash, search_term, courses_json, course_count, created_at, expires_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(query_hash) DO UPDATE SET
                        search_term = excluded.search_term,
                        courses_json = excluded.courses_json,
                        course_count = excluded.course_count,
                        created_at = excluded.created_at,
                        expires_at = excluded.expires_at
                """, (
                    q_hash,
                    search_term.strip().lower(),
                    json.dumps(courses),
                    len(courses),
                    now_str,
                    expires_at_str
                ))
                conn.commit()
                return True
        except Exception as e:
            print(f"[ScraperCacheService] Cache write notice: {e}")
            return False

    def purge_expired(self):
        """Purges all expired cache records."""
        now_str = datetime.utcnow().isoformat()
        try:
            with sqlite3.connect(self.db_path) as conn:
                cur = conn.cursor()
                cur.execute("DELETE FROM lms_scraped_course_cache WHERE expires_at < ?", (now_str,))
                conn.commit()
        except Exception:
            pass

scraper_cache_service = ScraperCacheService()
