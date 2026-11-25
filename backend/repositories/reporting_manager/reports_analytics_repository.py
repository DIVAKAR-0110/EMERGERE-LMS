"""
Reporting Manager Reports & Analytics Repository.
Data access layer for Reports & Analytics page (frontend/src/pages/ReportingManager/ReportsAnalytics.jsx).
Coordinates team-wide metrics and individual report data extraction.
"""

from typing import List, Dict, Any, Optional
from database.connection import dictfetchall, dictfetchone


def get_team_learning_summary(cursor, employee_ids: List[str]) -> List[Dict[str, Any]]:
    """Retrieves learning summary records for a list of team employee IDs."""
    if not employee_ids:
        return []
    placeholders = ", ".join(["?"] * len(employee_ids))
    query = f"""
        SELECT 
            e.employee_id,
            e.name,
            e.designation,
            COUNT(DISTINCT ec.course_id) AS enrolled_courses,
            COUNT(DISTINCT cert.id) AS approved_certifications
        FROM dbo.lms_employees e
        LEFT JOIN dbo.lms_employee_courses ec ON e.employee_id = ec.employee_id
        LEFT JOIN dbo.lms_certifications cert ON e.employee_id = cert.employee_id AND cert.status = 'Approved'
        WHERE e.employee_id IN ({placeholders})
        GROUP BY e.employee_id, e.name, e.designation
    """
    cursor.execute(query, tuple(employee_ids))
    return dictfetchall(cursor)

