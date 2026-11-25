"""
Budget Repository.
Data access layer for L&D Budget analytics, spend streams, and purchase history.
Queries dbo.lms_course_requests, dbo.lms_courses, and dbo.lms_course_request_stages.
"""

from typing import List, Dict, Any, Optional
from database.connection import dictfetchall, is_sql_server

def get_course_purchase_history(
    cursor,
    search: Optional[str] = None,
    provider: Optional[str] = None,
    limit: int = 100
) -> List[Dict[str, Any]]:
    """
    Retrieves course purchase history records by joining course requests,
    their 'Course Purchase' milestone stage, and catalog course records.
    """
    query = """
        SELECT 
            r.id,
            r.request_code,
            r.employee_id,
            r.course_name,
            r.provider_id,
            r.category_id,
            COALESCE(cp.ProviderName, '-') AS provider,
            COALESCE(cc.CategoryName, '-') AS category,
            r.reason,
            r.created_at,
            s.stage_status AS purchase_status,
            s.stage_date AS purchase_date,
            s.updated_by AS approved_by_id,
            COALESCE(
                (SELECT TOP 1 c.price FROM lms_courses c WHERE c.request_id = r.id AND c.price IS NOT NULL ORDER BY c.id DESC),
                (SELECT TOP 1 c2.price FROM lms_courses c2 WHERE c2.course_name = r.course_name AND c2.price IS NOT NULL ORDER BY c2.id DESC),
                12500
            ) AS price
        FROM lms_course_requests r
        LEFT JOIN CourseProviders cp ON r.provider_id = cp.ProviderId
        LEFT JOIN CourseCategories cc ON r.category_id = cc.CategoryId
        JOIN lms_course_request_stages s 
            ON s.request_code = r.request_code 
            AND s.stage_name = 'Course Purchase'
        WHERE s.stage_status = 'Completed'
        ORDER BY s.stage_date DESC, r.id DESC
    """
    if is_sql_server():
        cursor.execute(query)
        rows = dictfetchall(cursor)
    else:
        sqlite_query = """
            SELECT 
                r.id,
                r.request_code,
                r.employee_id,
                r.course_name,
                r.provider_id,
                r.category_id,
                COALESCE(cp.ProviderName, '-') AS provider,
                COALESCE(cc.CategoryName, '-') AS category,
                r.reason,
                r.created_at,
                s.stage_status AS purchase_status,
                s.stage_date AS purchase_date,
                s.updated_by AS approved_by_id,
                COALESCE(
                    (SELECT c.price FROM lms_courses c WHERE c.request_id = r.id AND c.price IS NOT NULL LIMIT 1),
                    12500
                ) AS price
            FROM lms_course_requests r
            LEFT JOIN CourseProviders cp ON r.provider_id = cp.ProviderId
            LEFT JOIN CourseCategories cc ON r.category_id = cc.CategoryId
            JOIN lms_course_request_stages s 
                ON s.request_code = r.request_code 
                AND s.stage_name = 'Course Purchase'
            WHERE s.stage_status = 'Completed'
            ORDER BY s.stage_date DESC, r.id DESC
        """
        cursor.execute(sqlite_query)
        rows = dictfetchall(cursor)

    return rows

def get_request_stages(cursor, request_code: str) -> List[Dict[str, Any]]:
    """Fetches all 5 milestone stages for a course request in sequential order."""
    query = """
        SELECT 
            id,
            request_code,
            stage_name,
            stage_status,
            stage_date,
            created_at,
            created_by,
            updated_at,
            updated_by
        FROM lms_course_request_stages
        WHERE request_code = ?
        ORDER BY 
            CASE stage_name 
                WHEN 'Employee' THEN 1
                WHEN 'Notified to RM' THEN 2
                WHEN 'L&D' THEN 3
                WHEN 'CEO Approval' THEN 4
                WHEN 'Course Purchase' THEN 5
                ELSE 6
            END ASC
    """
    cursor.execute(query, (request_code,))
    return dictfetchall(cursor)

def get_certification_claims_history(cursor) -> List[Dict[str, Any]]:
    """
    Retrieves all certification reimbursement claims from dbo.lms_reimbursement_claims.
    """
    query = """
        SELECT 
            c.id,
            c.claim_code,
            c.employee_id,
            'Certification' AS claim_type,
            c.certification_name,
            COALESCE(cp.ProviderName, '-') AS provider,
            c.amount,
            c.purchase_date,
            c.completion_exam_date,
            c.validity_from,
            c.validity_to,
            c.supporting_document_path,
            c.status,
            c.processing_status,
            c.submitted_on,
            c.created_at
        FROM lms_reimbursement_claims c
        LEFT JOIN CourseProviders cp ON c.provider_id = cp.ProviderId
        ORDER BY c.id DESC
    """
    cursor.execute(query)
    return dictfetchall(cursor)

def get_claim_stages(cursor, request_code: str) -> List[Dict[str, Any]]:
    """Fetches all approval stages for a reimbursement claim in sequential order."""
    query = """
        SELECT 
            id,
            request_code,
            stage_name,
            stage_status,
            stage_date,
            created_at,
            created_by,
            updated_at,
            updated_by
        FROM lms_reimbursement_claim_stages
        WHERE request_code = ?
        ORDER BY 
            CASE stage_name 
                WHEN 'Employee Request' THEN 1
                WHEN 'Notified to RM' THEN 2
                WHEN 'L&D status' THEN 3
                WHEN 'HR Approval' THEN 4
                WHEN 'Reimbursed' THEN 5
                ELSE 6
            END ASC
    """
    cursor.execute(query, (request_code,))
    return dictfetchall(cursor)

def get_department_spends_data(cursor) -> List[Dict[str, Any]]:
    """
    Retrieves baseline department budget allocation records.
    """
    query = """
        SELECT 
            id,
            department,
            budget_amount,
            budget_year
        FROM lms_department_budgets
        ORDER BY id ASC
    """
    cursor.execute(query)
    return dictfetchall(cursor)

def get_workshops_history(cursor) -> List[Dict[str, Any]]:
    """
    Retrieves all workshops & training event records from dbo.lms_workshops_training.
    """
    query = """
        SELECT 
            id,
            event_name,
            event_category,
            department,
            start_date,
            end_date,
            participants_count,
            event_type,
            actual_spent,
            created_at
        FROM lms_workshops_training
        ORDER BY start_date DESC, id DESC
    """
    cursor.execute(query)
    return dictfetchall(cursor)

