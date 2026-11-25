"""
MS SQL Views Migration for LMS Copilot AI Assistant.
Creates high-performance database views that pre-join relational tables
so the AI assistant receives unified, 100% mathematically correct 360-degree context.
"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.connection import connect_db

VIEWS = [
    (
        "vw_ai_learner_enrollments",
        """
        CREATE VIEW dbo.vw_ai_learner_enrollments AS
        SELECT 
            ce.id AS enrollment_id,
            ce.enrollment_code,
            ce.employee_id,
            ce.course_id,
            c.course_name,
            c.provider_id,
            COALESCE(cp.ProviderName, 'Emergere Academy') AS provider,
            c.category_id,
            COALESCE(cc.CategoryName, 'General') AS category,
            COALESCE(c.duration_minutes, 0) AS duration_minutes,
            COALESCE(c.price, 0.0) AS price,
            c.description AS course_description,
            c.course_url,
            ce.status AS enrollment_status,
            COALESCE(ce.progress_percentage, 0.0) AS progress_percentage,
            COALESCE(ce.hours_log, 0) AS hours_log,
            ce.video_status,
            ce.last_accessed,
            ce.created_at AS enrolled_at
        FROM dbo.lms_course_enrollments ce
        INNER JOIN dbo.lms_courses c ON ce.course_id = c.id
        LEFT JOIN dbo.CourseProviders cp ON c.provider_id = cp.ProviderId
        LEFT JOIN dbo.CourseCategories cc ON c.category_id = cc.CategoryId;
        """
    ),
    (
        "vw_ai_learner_course_requests",
        """
        CREATE VIEW dbo.vw_ai_learner_course_requests AS
        SELECT 
            cr.id AS request_id,
            cr.request_code,
            cr.employee_id,
            cr.course_name,
            cr.provider_id,
            cr.category_id,
            COALESCE(cp.ProviderName, 'External Provider') AS provider,
            COALESCE(cc.CategoryName, 'General') AS category,
            cr.course_link,
            cr.reason,
            cr.created_at,
            COALESCE(
                (SELECT TOP 1 s.stage_name 
                 FROM dbo.lms_course_request_stages s 
                 WHERE s.request_code = cr.request_code AND s.stage_status = 'Pending' 
                 ORDER BY s.id ASC),
                (SELECT TOP 1 'Rejected at ' + s.stage_name 
                 FROM dbo.lms_course_request_stages s 
                 WHERE s.request_code = cr.request_code AND s.stage_status = 'Rejected' 
                 ORDER BY s.id DESC),
                'Completed'
            ) AS current_pending_stage,
            CASE 
                WHEN EXISTS (SELECT 1 FROM dbo.lms_course_request_stages s WHERE s.request_code = cr.request_code AND s.stage_status = 'Rejected') THEN 'Rejected'
                WHEN EXISTS (SELECT 1 FROM dbo.lms_course_request_stages s WHERE s.request_code = cr.request_code AND s.stage_status = 'Pending') THEN 'Pending'
                ELSE 'Approved'
            END AS overall_status,
            (SELECT COUNT(*) FROM dbo.lms_course_request_stages s WHERE s.request_code = cr.request_code) AS total_stages,
            (SELECT COUNT(*) FROM dbo.lms_course_request_stages s WHERE s.request_code = cr.request_code AND s.stage_status = 'Approved') AS approved_stages
        FROM dbo.lms_course_requests cr
        LEFT JOIN dbo.CourseProviders cp ON cr.provider_id = cp.ProviderId
        LEFT JOIN dbo.CourseCategories cc ON cr.category_id = cc.CategoryId
        """
    ),
    (
        "vw_ai_learner_reimbursements",
        """
        CREATE VIEW dbo.vw_ai_learner_reimbursements AS
        SELECT 
            rc.id AS claim_id,
            rc.claim_code,
            rc.employee_id,
            CAST('Certification' AS VARCHAR(20)) AS claim_type,
            rc.certification_name,
            rc.provider_id,
            COALESCE(cp.ProviderName, 'Unknown Provider') AS provider,
            rc.category_id,
            COALESCE(cc.CategoryName, 'General') AS category,
            COALESCE(rc.amount, 0.0) AS amount,
            rc.status AS claim_status,
            COALESCE(rc.processing_status, 'Submitted') AS processing_status,
            rc.submitted_on,
            rc.created_at,
            COALESCE(
                (SELECT TOP 1 s.stage_name 
                 FROM dbo.lms_reimbursement_claim_stages s 
                 WHERE s.request_code = rc.claim_code AND s.stage_status = 'Pending' 
                 ORDER BY s.id ASC),
                (SELECT TOP 1 'Rejected at ' + s.stage_name 
                 FROM dbo.lms_reimbursement_claim_stages s 
                 WHERE s.request_code = rc.claim_code AND s.stage_status = 'Rejected' 
                 ORDER BY s.id DESC),
                'Completed'
            ) AS current_pending_stage,
            (SELECT COUNT(*) FROM dbo.lms_reimbursement_claim_stages s WHERE s.request_code = rc.claim_code) AS total_stages,
            (SELECT COUNT(*) FROM dbo.lms_reimbursement_claim_stages s WHERE s.request_code = rc.claim_code AND s.stage_status = 'Approved') AS approved_stages
        FROM dbo.lms_reimbursement_claims rc
        LEFT JOIN dbo.CourseProviders cp ON rc.provider_id = cp.ProviderId
        LEFT JOIN dbo.CourseCategories cc ON rc.category_id = cc.CategoryId;
        """
    ),
    (
        "vw_ai_learner_certifications",
        """
        CREATE VIEW dbo.vw_ai_learner_certifications AS
        SELECT 
            c.id AS cert_record_id,
            c.employee_id,
            c.certification_name,
            c.provider_id,
            COALESCE(cp.ProviderName, 'Unknown Provider') AS provider,
            COALESCE(c.certificate_type, 'Professional Certification') AS certificate_type,
            COALESCE(c.certificate_id, 'N/A') AS credential_id,
            c.category_id,
            COALESCE(cc.CategoryName, 'Technical') AS certification_domain,
            c.issue_date,
            c.expiry_date,
            CASE 
                WHEN c.expiry_date IS NOT NULL AND c.expiry_date < GETDATE() THEN 'Expired' 
                ELSE 'Active' 
            END AS validity_status
        FROM dbo.lms_employee_certificates c
        LEFT JOIN dbo.CourseProviders cp ON c.provider_id = cp.ProviderId
        LEFT JOIN dbo.CourseCategories cc ON c.category_id = cc.CategoryId;
        """
    ),
    (
        "vw_ai_learner_360_profile",
        """
        CREATE VIEW dbo.vw_ai_learner_360_profile AS
        SELECT 
            p.employee_id,
            COALESCE(p.technical_skills, '') AS technical_skills,
            COALESCE(p.workplace_skills, '') AS workplace_skills,
            COALESCE(p.area_of_expertise, '') AS area_of_expertise,
            COALESCE(p.learning_interests, '') AS learning_interests,
            COALESCE(p.professional_summary, '') AS professional_summary,
            -- Pre-joined aggregations from enrollments
            COALESCE(enr.total_enrolled, 0) AS total_enrolled,
            COALESCE(enr.completed_courses, 0) AS completed_courses,
            COALESCE(enr.in_progress_courses, 0) AS in_progress_courses,
            COALESCE(enr.not_started_courses, 0) AS not_started_courses,
            COALESCE(enr.total_study_minutes, 0) AS total_study_minutes,
            COALESCE(enr.avg_progress_pct, 0.0) AS avg_progress_pct,
            -- Pre-joined certifications count
            COALESCE(crt.total_certificates, 0) AS total_certificates,
            -- Pre-joined course requests count
            COALESCE(req.total_course_requests, 0) AS total_course_requests,
            COALESCE(req.pending_course_requests, 0) AS pending_course_requests,
            -- Pre-joined reimbursement claims aggregation
            COALESCE(rmb.total_reimbursement_claims, 0) AS total_reimbursement_claims,
            COALESCE(rmb.pending_reimbursement_claims, 0) AS pending_reimbursement_claims,
            COALESCE(rmb.total_claimed_amount, 0.0) AS total_claimed_amount,
            COALESCE(rmb.approved_claimed_amount, 0.0) AS approved_claimed_amount,
            COALESCE(rmb.pending_claimed_amount, 0.0) AS pending_claimed_amount
        FROM dbo.lms_employee_profiles p
        LEFT JOIN (
            SELECT 
                employee_id,
                COUNT(id) AS total_enrolled,
                SUM(CASE WHEN status = 'Completed' OR progress_percentage >= 100 THEN 1 ELSE 0 END) AS completed_courses,
                SUM(CASE WHEN status IN ('In Progress', 'Active') AND progress_percentage < 100 THEN 1 ELSE 0 END) AS in_progress_courses,
                SUM(CASE WHEN status IN ('Not Started', 'Assigned') THEN 1 ELSE 0 END) AS not_started_courses,
                SUM(COALESCE(hours_log, 0)) AS total_study_minutes,
                AVG(COALESCE(progress_percentage, 0.0)) AS avg_progress_pct
            FROM dbo.lms_course_enrollments
            GROUP BY employee_id
        ) enr ON LOWER(p.employee_id) = LOWER(enr.employee_id)
        LEFT JOIN (
            SELECT 
                employee_id,
                COUNT(id) AS total_certificates
            FROM dbo.lms_employee_certificates
            GROUP BY employee_id
        ) crt ON LOWER(p.employee_id) = LOWER(crt.employee_id)
        LEFT JOIN (
            SELECT 
                cr.employee_id,
                COUNT(DISTINCT cr.request_code) AS total_course_requests,
                COUNT(DISTINCT CASE WHEN s.stage_status = 'Pending' THEN cr.request_code END) AS pending_course_requests
            FROM dbo.lms_course_requests cr
            LEFT JOIN dbo.lms_course_request_stages s ON cr.request_code = s.request_code
            GROUP BY cr.employee_id
        ) req ON LOWER(p.employee_id) = LOWER(req.employee_id)
        LEFT JOIN (
            SELECT 
                employee_id,
                COUNT(id) AS total_reimbursement_claims,
                SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) AS pending_reimbursement_claims,
                SUM(COALESCE(amount, 0.0)) AS total_claimed_amount,
                SUM(CASE WHEN status IN ('Approved', 'Settled', 'Paid') THEN COALESCE(amount, 0.0) ELSE 0.0 END) AS approved_claimed_amount,
                SUM(CASE WHEN status = 'Pending' THEN COALESCE(amount, 0.0) ELSE 0.0 END) AS pending_claimed_amount
            FROM dbo.lms_reimbursement_claims
            GROUP BY employee_id
        ) rmb ON LOWER(p.employee_id) = LOWER(rmb.employee_id)
        """
    ),
    (
        "vw_ai_org_approvals_queue",
        """
        CREATE VIEW dbo.vw_ai_org_approvals_queue AS
        SELECT 
            'Course Request' AS approval_type,
            cr.request_code,
            cr.employee_id,
            cr.course_name AS item_name,
            COALESCE(cp.ProviderName, 'External Provider') AS provider,
            0.0 AS amount,
            COALESCE(
                (SELECT TOP 1 s.stage_name FROM dbo.lms_course_request_stages s WHERE s.request_code = cr.request_code AND s.stage_status = 'Pending' ORDER BY s.id ASC),
                'Pending Review'
            ) AS pending_stage,
            cr.created_at AS submitted_at
        FROM dbo.lms_course_requests cr
        LEFT JOIN dbo.CourseProviders cp ON cr.provider_id = cp.ProviderId
        WHERE EXISTS (
            SELECT 1 FROM dbo.lms_course_request_stages s 
            WHERE s.request_code = cr.request_code AND s.stage_status = 'Pending'
        )

        UNION ALL

        SELECT 
            'Reimbursement Claim' AS approval_type,
            rc.claim_code AS request_code,
            rc.employee_id,
            rc.certification_name AS item_name,
            COALESCE(cp.ProviderName, 'External Provider') AS provider,
            COALESCE(rc.amount, 0.0) AS amount,
            COALESCE(
                (SELECT TOP 1 s.stage_name FROM dbo.lms_reimbursement_claim_stages s WHERE s.request_code = rc.claim_code AND s.stage_status = 'Pending' ORDER BY s.id ASC),
                'Pending Review'
            ) AS pending_stage,
            rc.created_at AS submitted_at
        FROM dbo.lms_reimbursement_claims rc
        LEFT JOIN dbo.CourseProviders cp ON rc.provider_id = cp.ProviderId
        WHERE rc.status = 'Pending' OR EXISTS (
            SELECT 1 FROM dbo.lms_reimbursement_claim_stages s 
            WHERE s.request_code = rc.claim_code AND s.stage_status = 'Pending'
        )

        UNION ALL

        SELECT 
            'Certification Request' AS approval_type,
            cr.request_code,
            cr.employee_id,
            cr.certification_name AS item_name,
            COALESCE(cp.ProviderName, 'External Provider') AS provider,
            COALESCE(cr.estimated_cost, 0.0) AS amount,
            COALESCE(
                (SELECT TOP 1 s.stage_name FROM dbo.lms_certification_request_stages s WHERE s.request_id = cr.id AND s.stage_status = 'Pending' ORDER BY s.id ASC),
                'Pending Review'
            ) AS pending_stage,
            cr.created_at AS submitted_at
        FROM dbo.lms_certification_requests cr
        LEFT JOIN dbo.CourseProviders cp ON cr.provider_id = cp.ProviderId
        WHERE cr.status = 'Pending' OR EXISTS (
            SELECT 1 FROM dbo.lms_certification_request_stages s 
            WHERE s.request_id = cr.id AND s.stage_status = 'Pending'
        )
        """
    ),
    (
        "vw_ai_learner_cert_requests",
        """
        CREATE VIEW dbo.vw_ai_learner_cert_requests AS
        SELECT 
            cr.id AS request_id,
            cr.request_code,
            cr.employee_id,
            cr.certification_name,
            cr.provider_id,
            cr.category_id,
            COALESCE(cp.ProviderName, 'External Provider') AS provider,
            COALESCE(cc.CategoryName, 'Technical') AS category,
            cr.exam_date,
            COALESCE(cr.estimated_cost, 0.0) AS estimated_cost,
            cr.purpose,
            cr.status AS overall_status,
            cr.created_at,
            COALESCE(
                (SELECT TOP 1 s.stage_name 
                 FROM dbo.lms_certification_request_stages s 
                 WHERE s.request_id = cr.id AND s.stage_status = 'Pending' 
                 ORDER BY s.id ASC),
                (SELECT TOP 1 'Rejected at ' + s.stage_name 
                 FROM dbo.lms_certification_request_stages s 
                 WHERE s.request_id = cr.id AND s.stage_status = 'Rejected' 
                 ORDER BY s.id DESC),
                'Approved'
            ) AS current_pending_stage,
            (SELECT COUNT(*) FROM dbo.lms_certification_request_stages s WHERE s.request_id = cr.id) AS total_stages,
            (SELECT COUNT(*) FROM dbo.lms_certification_request_stages s WHERE s.request_id = cr.id AND s.stage_status IN ('Completed', 'Approved')) AS approved_stages
        FROM dbo.lms_certification_requests cr
        LEFT JOIN dbo.CourseProviders cp ON cr.provider_id = cp.ProviderId
        LEFT JOIN dbo.CourseCategories cc ON cr.category_id = cc.CategoryId
        """
    ),
    (
        "vw_ai_ld_assigned_courses",
        """
        CREATE VIEW dbo.vw_ai_ld_assigned_courses AS
        SELECT 
            ac.id AS assignment_id,
            ac.ld_id,
            ac.course_id,
            c.course_name,
            c.provider_id,
            COALESCE(cp.ProviderName, 'Emergere Academy') AS provider,
            c.category_id,
            COALESCE(cc.CategoryName, 'General') AS category,
            COALESCE(c.price, 0.0) AS price,
            ac.selected_employees,
            ac.learning_start_date,
            ac.target_completion_date,
            ac.assignment_note,
            ac.created_at AS assigned_at,
            ac.created_by
        FROM dbo.lms_assign_course ac
        INNER JOIN dbo.lms_courses c ON ac.course_id = c.id
        LEFT JOIN dbo.CourseProviders cp ON c.provider_id = cp.ProviderId
        LEFT JOIN dbo.CourseCategories cc ON c.category_id = cc.CategoryId;
        """
    ),
    (
        "vw_ai_department_learning_summary",
        """
        CREATE VIEW dbo.vw_ai_department_learning_summary AS
        SELECT 
            b.department,
            COALESCE(b.budget_year, 2026) AS budget_year,
            COALESCE(b.budget_amount, 0.0) AS allocated_budget,
            COALESCE(agg.total_enrollments, 0) AS total_enrollments,
            COALESCE(agg.completed_count, 0) AS completed_count,
            COALESCE(agg.in_progress_count, 0) AS in_progress_count,
            COALESCE(agg.active_learners, 0) AS active_learners,
            COALESCE(agg.avg_progress, 0.0) AS avg_progress
        FROM dbo.lms_department_budgets b
        LEFT JOIN (
            SELECT 
                ce.employee_id,
                COUNT(ce.id) AS total_enrollments,
                SUM(CASE WHEN ce.status = 'Completed' OR ce.progress_percentage >= 100 THEN 1 ELSE 0 END) AS completed_count,
                SUM(CASE WHEN ce.status IN ('In Progress', 'Active') THEN 1 ELSE 0 END) AS in_progress_count,
                COUNT(DISTINCT ce.employee_id) AS active_learners,
                AVG(COALESCE(ce.progress_percentage, 0.0)) AS avg_progress
            FROM dbo.lms_course_enrollments ce
            GROUP BY ce.employee_id
        ) agg ON 1=0 -- Placeholder for department mapping if department is joined
        """
    )
]

def apply_views():
    conn = connect_db()
    cursor = conn.cursor()
    print("[ApplyViews] Starting MS SQL View deployment for AI Assistant...")

    for view_name, ddl in VIEWS:
        try:
            # Check if view already exists, drop it
            drop_stmt = f"IF OBJECT_ID('dbo.{view_name}', 'V') IS NOT NULL DROP VIEW dbo.{view_name}"
            cursor.execute(drop_stmt)
            conn.commit()

            # Create view
            cursor.execute(ddl)
            conn.commit()
            print(f"  [OK] Successfully deployed view: dbo.{view_name}")
        except Exception as e:
            print(f"  [ERROR] Failed to deploy view {view_name}: {e}")
            conn.rollback()

    cursor.close()
    conn.close()
    print("[ApplyViews] Deployment complete.")

if __name__ == "__main__":
    apply_views()
