"""
Manager Course Recommendation Repository.
Data access layer for dbo.lms_recommend_new_course.
Pure parameterized SQL queries conforming to SQL Server database schema.
"""

from typing import List, Dict, Any, Optional
from database.connection import dictfetchall, dictfetchone
from constants.course_metadata import resolve_provider_name, resolve_category_name

def insert_manager_recommended_course(
    cursor,
    manager_id: Any,
    course_name: str,
    provider_name: Optional[str] = None,
    category_name: Optional[str] = None,
    course_link: Optional[str] = None,
    reason_for_new_course: str = "",
    target_employee_id: Optional[Any] = None,
    target_employee_ids: Optional[str] = None,
    created_by: Optional[Any] = None,
    provider_id: Optional[int] = None,
    category_id: Optional[int] = None,
    **kwargs
) -> int:
    """Inserts records into dbo.lms_recommend_new_course."""
    p_id = provider_id or kwargs.get("provider_id")
    c_id = category_id or kwargs.get("category_id")

    if not manager_id or not str(manager_id).strip():
        raise ValueError("manager_id is required for course recommendations.")
    clean_rm = str(manager_id).strip()[:7]
    clean_emp = str(target_employee_id or "ALL")[:7]
    clean_course = str(course_name)[:100]
    clean_link = str(course_link)[:255] if course_link else None
    clean_reason = str(reason_for_new_course)[:500] if reason_for_new_course else None
    clean_creator = str(created_by or clean_rm)[:7]

    query = """
        INSERT INTO dbo.lms_recommend_new_course (
            rm_id, employee_id, course_name, provider_id, category_id,
            course_link, reason, created_at, created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, GETDATE(), ?)
    """
    cursor.execute(
        query,
        (
            clean_rm,
            clean_emp,
            clean_course,
            p_id,
            c_id,
            clean_link,
            clean_reason,
            clean_creator
        )
    )
    cursor.execute("SELECT @@IDENTITY AS id")
    row = cursor.fetchone()
    return int(row[0]) if row and row[0] else 0

def get_manager_recommended_courses(
    cursor,
    manager_id: Optional[Any] = None
) -> List[Dict[str, Any]]:
    """Retrieves recommended courses from dbo.lms_recommend_new_course."""
    base_query = """
        SELECT 
            rc.id AS request_id,
            rc.id AS recommendation_id,
            rc.id,
            rc.rm_id AS manager_id,
            rc.rm_id,
            rc.employee_id AS target_employee_id,
            rc.employee_id,
            rc.course_name,
            rc.provider_id,
            COALESCE(cp.ProviderName, 'Udemy') AS provider_name,
            COALESCE(cp.ProviderName, 'Udemy') AS provider,
            rc.category_id,
            COALESCE(cc.CategoryName, 'Development') AS category_name,
            COALESCE(cc.CategoryName, 'Development') AS category,
            rc.course_link,
            rc.reason AS reason_for_new_course,
            rc.reason,
            'Pending' AS status,
            CONVERT(VARCHAR(19), rc.created_at, 120) AS created_at,
            rc.created_by
        FROM dbo.lms_recommend_new_course rc
        LEFT JOIN dbo.CourseProviders cp ON rc.provider_id = cp.ProviderId
        LEFT JOIN dbo.CourseCategories cc ON rc.category_id = cc.CategoryId
    """
    if manager_id:
        clean_rm = str(manager_id)[:7]
        query = base_query + " WHERE LOWER(rc.rm_id) = LOWER(?) ORDER BY rc.created_at DESC, rc.id DESC"
        cursor.execute(query, (clean_rm,))
    else:
        query = base_query + " ORDER BY rc.created_at DESC, rc.id DESC"
        cursor.execute(query)
    return dictfetchall(cursor)

def get_manager_recommended_course_by_id(
    cursor,
    request_id: int
) -> Optional[Dict[str, Any]]:
    """Retrieves a single recommended course by ID."""
    query = """
        SELECT 
            rc.id AS request_id,
            rc.id AS recommendation_id,
            rc.id,
            rc.rm_id AS manager_id,
            rc.rm_id,
            rc.employee_id AS target_employee_id,
            rc.employee_id,
            rc.course_name,
            rc.provider_id,
            COALESCE(cp.ProviderName, 'Udemy') AS provider_name,
            COALESCE(cp.ProviderName, 'Udemy') AS provider,
            rc.category_id,
            COALESCE(cc.CategoryName, 'Development') AS category_name,
            COALESCE(cc.CategoryName, 'Development') AS category,
            rc.course_link,
            rc.reason AS reason_for_new_course,
            rc.reason,
            'Pending' AS status,
            CONVERT(VARCHAR(19), rc.created_at, 120) AS created_at,
            rc.created_by
        FROM dbo.lms_recommend_new_course rc
        LEFT JOIN dbo.CourseProviders cp ON rc.provider_id = cp.ProviderId
        LEFT JOIN dbo.CourseCategories cc ON rc.category_id = cc.CategoryId
        WHERE rc.id = ?
    """
    cursor.execute(query, (request_id,))
    return dictfetchone(cursor)
