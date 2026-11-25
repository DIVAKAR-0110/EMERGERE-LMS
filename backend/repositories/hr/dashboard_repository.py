"""
HR Activity Repository.
Handles data access and audit trail persistence for dbo.lms_hr_activity_feed.
Conforms to Microsoft SQL Server database schema and LMS audit requirements.
"""

from typing import List, Dict, Any, Optional
from database.connection import dictfetchall, dictfetchone

def insert_hr_activity(
    cursor,
    activity_type: str,
    message: str,
    created_by: Optional[str] = None
) -> int:
    """
    Inserts an event into dbo.lms_hr_activity_feed.
    Returns the newly generated primary key id.
    """
    clean_type = str(activity_type).strip()[:30]
    clean_msg = str(message).strip()[:255]
    clean_creator = str(created_by).strip()[:7] if created_by and str(created_by).strip() else None

    query = """
        INSERT INTO dbo.lms_hr_activity_feed (
            activity_type,
            message,
            created_at,
            created_by
        )
        VALUES (?, ?, GETDATE(), ?);
    """
    cursor.execute(query, (clean_type, clean_msg, clean_creator))
    try:
        cursor.execute("SELECT @@IDENTITY AS id")
        row = cursor.fetchone()
        return int(row[0]) if row and row[0] else 0
    except Exception:
        return 0

def has_employee_onboard_logged(cursor, employee_id: str) -> bool:
    """
    Checks if an EMPLOYEE_ONBOARDED activity has already been logged for the given employee ID.
    Prevents duplicate onboarding feed items on repeated logins.
    """
    clean_emp = str(employee_id).strip()[:7]
    query = """
        SELECT TOP 1 id
        FROM dbo.lms_hr_activity_feed
        WHERE activity_type = 'EMPLOYEE_ONBOARDED'
          AND (created_by = ? OR message LIKE ?)
    """
    pattern = f"%{clean_emp}%"
    cursor.execute(query, (clean_emp, pattern))
    row = cursor.fetchone()
    return bool(row)

def get_recent_hr_activities(cursor, limit: int = 20) -> List[Dict[str, Any]]:
    """
    Retrieves the most recent activities from dbo.lms_hr_activity_feed.
    """
    query = f"""
        SELECT TOP {int(limit)}
            id,
            activity_type,
            message,
            created_at,
            created_by
        FROM dbo.lms_hr_activity_feed
        ORDER BY created_at DESC, id DESC
    """
    cursor.execute(query)
    rows = dictfetchall(cursor)
    return rows
