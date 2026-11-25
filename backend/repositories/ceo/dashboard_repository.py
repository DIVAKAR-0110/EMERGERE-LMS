"""
CEO Dashboard Repository.
Data access layer executing queries for enterprise-wide CEO analytics and KPIs.
"""

from typing import List, Dict, Any, Optional
from database.connection import dictfetchall, dictfetchone


def get_executive_summary_counts(cursor) -> Dict[str, Any]:
    """Retrieves high-level counts for enterprise learning analytics."""
    cursor.execute("""
        SELECT 
            (SELECT COUNT(*) FROM dbo.lms_courses WHERE is_active = 1) AS total_active_courses,
            (SELECT COUNT(*) FROM dbo.lms_certifications WHERE status = 'Approved') AS total_approved_certifications
    """)
    return dictfetchone(cursor) or {}

