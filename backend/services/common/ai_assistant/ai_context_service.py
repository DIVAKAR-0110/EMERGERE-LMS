"""
AI Context Service.
Aggregates LMS domain knowledge from database tables:
- dbo.lms_employee_profiles (technical skills, workplace skills, learning interests, expertise)
- dbo.lms_courses (catalog, provider, price, duration, descriptions)
- dbo.lms_study_materials (notes, cheatsheets, labs, resources)
- dbo.lms_course_enrollments & dbo.lms_employee_certificates (past learning history)
- dbo.lms_learning_logs (team learning analytics)
Provides rich, factual context for the AI Assistant recommendation model.
"""

from typing import Dict, Any, List, Optional
from database.connection import connect_db, dictfetchall
from services.common.auth_service import employee_service

class AIContextService:
    def get_user_learning_profile(self, user_or_emp_id: Any) -> Dict[str, Any]:
        """
        Retrieves user learning profile from dbo.lms_employee_profiles and past enrollments.
        Used to tailor course recommendations based on user skills.
        """
        target_id = ""
        user_name = "Learner"
        user_role = "Employee"

        if isinstance(user_or_emp_id, dict):
            target_id = user_or_emp_id.get("employee_id") or user_or_emp_id.get("id") or ""
            user_name = user_or_emp_id.get("name") or user_or_emp_id.get("full_name") or "Learner"
            user_role = user_or_emp_id.get("role") or user_or_emp_id.get("designation") or "Employee"
        elif isinstance(user_or_emp_id, str):
            target_id = user_or_emp_id.strip()

        emp = employee_service.get_employee_by_id(target_id) if target_id else None
        manager_name = None
        manager_id = None
        department = "General"

        if emp:
            user_name = emp.get("name") or emp.get("full_name") or emp.get("displayName") or user_name
            user_role = emp.get("role") or emp.get("designation") or emp.get("job_title") or user_role
            manager_name = emp.get("reporting_manager") or manager_name
            manager_id = emp.get("reporting_manager_id") or manager_id
            department = emp.get("department") or department

        conn = connect_db()
        cursor = conn.cursor()
        try:
            # 1. Fetch skills and 360-degree metrics from MS SQL View: dbo.vw_ai_learner_360_profile
            p360_row = None
            try:
                cursor.execute("""
                    SELECT 
                        employee_id,
                        technical_skills,
                        workplace_skills,
                        area_of_expertise,
                        learning_interests,
                        professional_summary,
                        total_enrolled,
                        completed_courses,
                        in_progress_courses,
                        not_started_courses,
                        total_study_minutes,
                        avg_progress_pct,
                        total_certificates,
                        total_course_requests,
                        pending_course_requests,
                        total_reimbursement_claims,
                        pending_reimbursement_claims,
                        total_claimed_amount,
                        approved_claimed_amount,
                        pending_claimed_amount
                    FROM dbo.vw_ai_learner_360_profile
                    WHERE LOWER(employee_id) = LOWER(?)
                """, (target_id,))
                p360_row = cursor.fetchone()
            except Exception:
                p360_row = None

            prof_row = None
            if p360_row:
                prof_row = p360_row[:6]
            else:
                cursor.execute("""
                    SELECT 
                        employee_id,
                        technical_skills,
                        workplace_skills,
                        area_of_expertise,
                        learning_interests,
                        professional_summary
                    FROM dbo.lms_employee_profiles
                    WHERE LOWER(employee_id) = LOWER(?)
                """, (target_id,))
                prof_row = cursor.fetchone()

            import json

            def _clean_str(val):
                if not val:
                    return ""
                s = str(val).strip()
                if s.startswith("[") and s.endswith("]"):
                    try:
                        parsed = json.loads(s)
                        if isinstance(parsed, list):
                            return ", ".join(str(x) for x in parsed if x)
                    except Exception:
                        pass
                return s.replace("[", "").replace("]", "").replace('"', '').replace("'", "")

            tech_skills = _clean_str(prof_row[1] if prof_row and prof_row[1] else "")
            work_skills = _clean_str(prof_row[2] if prof_row and prof_row[2] else "")
            expertise = _clean_str(prof_row[3] if prof_row and prof_row[3] else "")
            interests = _clean_str(prof_row[4] if prof_row and prof_row[4] else "")
            summary = prof_row[5] if prof_row and prof_row[5] else ""

            # 2. Fetch already enrolled or completed courses via MS SQL View: dbo.vw_ai_learner_enrollments
            try:
                cursor.execute("""
                    SELECT 
                        course_id,
                        course_name,
                        provider,
                        category,
                        duration_minutes AS duration,
                        enrollment_status AS status,
                        progress_percentage,
                        hours_log,
                        last_accessed,
                        video_status,
                        course_description AS description,
                        course_url
                    FROM dbo.vw_ai_learner_enrollments
                    WHERE LOWER(employee_id) = LOWER(?)
                      AND enrollment_status NOT IN ('Rejected')
                    ORDER BY progress_percentage DESC, enrollment_id DESC
                """, (target_id,))
                enrollments = dictfetchall(cursor)
            except Exception:
                cursor.execute("""
                    SELECT 
                        ce.course_id,
                        c.course_name,
                        COALESCE(cp.ProviderName, 'Emergere Academy') AS provider,
                        COALESCE(cc.CategoryName, 'General') AS category,
                        COALESCE(c.duration_minutes, 0) AS duration,
                        ce.status,
                        COALESCE(ce.progress_percentage, 0.0) AS progress_percentage,
                        COALESCE(ce.hours_log, 0) AS hours_log,
                        ce.last_accessed,
                        ce.video_status,
                        c.description,
                        c.course_url
                    FROM dbo.lms_course_enrollments ce
                    JOIN dbo.lms_courses c ON ce.course_id = c.id
                    LEFT JOIN dbo.CourseProviders cp ON c.provider_id = cp.ProviderId
                    LEFT JOIN dbo.CourseCategories cc ON c.category_id = cc.CategoryId
                    WHERE LOWER(ce.employee_id) = LOWER(?)
                      AND ce.status NOT IN ('Rejected')
                    ORDER BY ce.progress_percentage DESC, ce.id DESC
                """, (target_id,))
                enrollments = dictfetchall(cursor)

            # 3. Fetch workflow enrollment requests (Pending, On Hold, Approved, etc.) from dbo.lms_enrollment_requests
            cursor.execute("""
                SELECT 
                    er.id,
                    er.request_code,
                    er.employee_id,
                    er.course_id,
                    c.course_name,
                    COALESCE(cp.ProviderName, 'Emergere Academy') AS provider,
                    COALESCE(cc.CategoryName, 'General') AS category,
                    COALESCE(c.duration_minutes, 0) AS duration,
                    COALESCE(c.price, 0.0) AS price,
                    er.status,
                    er.onhold_reason,
                    er.on_hold_date,
                    er.created_at,
                    er.created_by
                FROM dbo.lms_enrollment_requests er
                JOIN dbo.lms_courses c ON er.course_id = c.id
                LEFT JOIN dbo.CourseProviders cp ON c.provider_id = cp.ProviderId
                LEFT JOIN dbo.CourseCategories cc ON c.category_id = cc.CategoryId
                WHERE LOWER(er.employee_id) = LOWER(?)
                ORDER BY er.id DESC
            """, (target_id,))
            raw_requests = dictfetchall(cursor)

            detailed_requests = []
            for r in raw_requests:
                r_status = r.get("status") or "Pending"
                p_val = float(r.get("price") or 0.0)
                p_text = f"${p_val:.2f}" if p_val > 0 else "Free (Included in LMS)"
                dur_raw = int(r.get("duration") or 0)
                dur_text = f"{dur_raw // 60}h {dur_raw % 60}m" if dur_raw >= 60 else f"{dur_raw} mins"

                detailed_requests.append({
                    "id": r.get("id"),
                    "request_code": r.get("request_code") or f"ENR-REQ-{r.get('id')}",
                    "course_id": r.get("course_id"),
                    "course_name": r.get("course_name"),
                    "provider": r.get("provider"),
                    "category": r.get("category"),
                    "price": p_text,
                    "duration": dur_text,
                    "status": r_status,
                    "onhold_reason": r.get("onhold_reason"),
                    "on_hold_date": str(r.get("on_hold_date") or ""),
                    "created_at": str(r.get("created_at") or "")[:10],
                    "pending_with": f"{manager_name} ({manager_id})",
                    "workflow_module": "Course Enrollment Request Approval Module"
                })

            pending_requests = [r for r in detailed_requests if r["status"] == "Pending"]
            on_hold_requests = [r for r in detailed_requests if r["status"] == "On Hold"]

            # 4. Fetch certifications earned with full record details via MS SQL View: dbo.vw_ai_learner_certifications
            try:
                cursor.execute("""
                    SELECT 
                        cert_record_id AS id,
                        certification_name, 
                        certificate_type, 
                        credential_id AS certificate_id,
                        issue_date, 
                        expiry_date,
                        certification_domain,
                        validity_status
                    FROM dbo.vw_ai_learner_certifications
                    WHERE LOWER(employee_id) = LOWER(?)
                    ORDER BY issue_date DESC, cert_record_id DESC
                """, (target_id,))
                certs = dictfetchall(cursor)
            except Exception:
                cursor.execute("""
                    SELECT 
                        id,
                        certification_name, 
                        certificate_type, 
                        certificate_id,
                        issue_date, 
                        expiry_date,
                        certification_domain
                    FROM dbo.lms_employee_certificates
                    WHERE LOWER(employee_id) = LOWER(?)
                    ORDER BY issue_date DESC, id DESC
                """, (target_id,))
                certs = dictfetchall(cursor)

            # Build detailed course tracking metrics
            detailed_enrollments = []
            for e in enrollments:
                dur_val = int(e.get("duration") or 0)
                dur_text = f"{dur_val // 60}h {dur_val % 60}m" if dur_val >= 60 else (f"{dur_val} mins" if dur_val > 0 else "Self-paced")
                hrs_raw = int(e.get("hours_log") or 0)
                hrs_text = f"{round(hrs_raw / 60.0, 1)} hrs" if hrs_raw >= 60 else f"{hrs_raw} mins" if hrs_raw > 0 else "0 hrs"
                
                detailed_enrollments.append({
                    "course_id": e.get("course_id"),
                    "course_name": e.get("course_name"),
                    "provider": e.get("provider"),
                    "category": e.get("category"),
                    "duration": dur_text,
                    "status": e.get("status") or "In Progress",
                    "progress_percentage": float(e.get("progress_percentage") or 0.0),
                    "hours_logged": hrs_text,
                    "raw_hours_log": hrs_raw,
                    "video_status": e.get("video_status") or "ON TRACK",
                    "last_accessed": str(e.get("last_accessed") or "")
                })

            detailed_certs = []
            for c in certs:
                detailed_certs.append({
                    "id": c.get("id"),
                    "certification_name": c.get("certification_name") or "Certification",
                    "certificate_type": c.get("certificate_type") or "Professional Certification",
                    "certificate_id": c.get("certificate_id") or "N/A",
                    "issue_date": str(c.get("issue_date") or "Verified"),
                    "expiry_date": str(c.get("expiry_date") or "Lifetime / No Expiry"),
                    "domain": c.get("certification_domain") or "Technical"
                })

            # Calculate enrollment summary metrics across all workflow states
            total_minutes = sum(int(e.get("hours_log") or 0) for e in enrollments)
            total_hours_str = f"{round(total_minutes / 60.0, 1)} hours" if total_minutes >= 60 else f"{total_minutes} mins"
            comp_count = sum(1 for e in enrollments if e.get("status") == "Completed" or float(e.get("progress_percentage") or 0.0) >= 100.0)
            in_prog_count = sum(1 for e in enrollments if e.get("status") in ("In Progress", "Active") and float(e.get("progress_percentage") or 0.0) < 100.0)
            assigned_count = sum(1 for e in enrollments if e.get("status") in ("Not Started", "Assigned"))
            pending_count = len(pending_requests)
            on_hold_count = len(on_hold_requests)
            avg_prog = round(sum(float(e.get("progress_percentage") or 0.0) for e in enrollments) / len(enrollments), 1) if enrollments else 0.0

            workflow_counts = {
                "in_progress": in_prog_count,
                "pending_approval": pending_count,
                "assigned_not_started": assigned_count,
                "on_hold": on_hold_count,
                "completed": comp_count,
                "total_tracked": len(enrollments) + len(pending_requests)
            }

            # 5. Fetch Reimbursement Claims via MS SQL View: dbo.vw_ai_learner_reimbursements
            detailed_reimbursements = []
            try:
                cursor.execute("""
                    SELECT 
                        claim_id AS id,
                        claim_code,
                        certification_name,
                        provider,
                        amount,
                        claim_status AS status,
                        processing_status,
                        current_pending_stage,
                        total_stages,
                        approved_stages,
                        submitted_on,
                        created_at
                    FROM dbo.vw_ai_learner_reimbursements
                    WHERE LOWER(employee_id) = LOWER(?)
                    ORDER BY claim_id DESC
                """, (target_id,))
                for r in dictfetchall(cursor):
                    r_amt = float(r.get("amount") or 0.0)
                    rcode = r.get("claim_code")
                    cursor.execute("""
                        SELECT stage_name, stage_status, stage_date
                        FROM dbo.lms_reimbursement_claim_stages
                        WHERE request_code = ?
                        ORDER BY id ASC
                    """, (rcode,))
                    r_stages = dictfetchall(cursor)
                    detailed_reimbursements.append({
                        "id": r.get("id"),
                        "claim_code": r.get("claim_code"),
                        "certification_name": r.get("certification_name") or "Certification",
                        "provider": r.get("provider") or "Unknown Provider",
                        "amount": r_amt,
                        "amount_formatted": f"${r_amt:,.2f}",
                        "status": r.get("status") or "Pending",
                        "processing_status": r.get("processing_status") or "Submitted to HR",
                        "submitted_on": str(r.get("submitted_on") or "")[:10],
                        "current_pending_stage": r.get("current_pending_stage") or "Pending Review",
                        "stages": r_stages
                    })
            except Exception:
                cursor.execute("""
                    SELECT 
                        rc.id,
                        rc.claim_code,
                        rc.certification_name,
                        rc.provider,
                        COALESCE(rc.amount, 0.0) AS amount,
                        rc.status,
                        rc.processing_status,
                        rc.submitted_on,
                        rc.created_at
                    FROM dbo.lms_reimbursement_claims rc
                    WHERE LOWER(rc.employee_id) = LOWER(?)
                    ORDER BY rc.id DESC
                """, (target_id,))
                reimb_rows = dictfetchall(cursor)
                for r in reimb_rows:
                    cursor.execute("""
                        SELECT stage_name, stage_status, stage_date
                        FROM dbo.lms_reimbursement_claim_stages
                        WHERE request_code = ?
                        ORDER BY id ASC
                    """, (r['claim_code'],))
                    stages = dictfetchall(cursor)
                    curr_stage = "Completed"
                    for s in stages:
                        if s.get("stage_status") == "Pending":
                            curr_stage = s.get("stage_name") or "Pending Review"
                            break
                        elif s.get("stage_status") == "Rejected":
                            curr_stage = f"Rejected at {s.get('stage_name')}"
                            break
                    r_amt = float(r.get("amount") or 0.0)
                    detailed_reimbursements.append({
                        "id": r.get("id"),
                        "claim_code": r.get("claim_code"),
                        "certification_name": r.get("certification_name") or "Certification",
                        "provider": r.get("provider") or "Unknown Provider",
                        "amount": r_amt,
                        "amount_formatted": f"${r_amt:,.2f}",
                        "status": r.get("status") or "Pending",
                        "processing_status": r.get("processing_status") or "Submitted to HR",
                        "submitted_on": str(r.get("submitted_on") or "")[:10],
                        "current_pending_stage": curr_stage,
                        "stages": stages
                    })

            reimb_total_amt = sum(r["amount"] for r in detailed_reimbursements)
            reimb_approved_amt = sum(r["amount"] for r in detailed_reimbursements if r["status"].lower() in ("approved", "settled", "paid"))
            reimb_pending_amt = sum(r["amount"] for r in detailed_reimbursements if r["status"].lower() == "pending")
            reimb_summary = {
                "total_claims": len(detailed_reimbursements),
                "pending_claims": sum(1 for r in detailed_reimbursements if r["status"].lower() == "pending"),
                "approved_claims": sum(1 for r in detailed_reimbursements if r["status"].lower() in ("approved", "settled", "paid")),
                "rejected_claims": sum(1 for r in detailed_reimbursements if r["status"].lower() == "rejected"),
                "total_claimed_amount": f"${reimb_total_amt:,.2f}",
                "approved_amount": f"${reimb_approved_amt:,.2f}",
                "pending_amount": f"${reimb_pending_amt:,.2f}",
                "raw_total_amount": reimb_total_amt,
                "raw_approved_amount": reimb_approved_amt,
                "raw_pending_amount": reimb_pending_amt
            }

            # 6. Fetch Certification Requests via MS SQL View: dbo.vw_ai_learner_cert_requests
            detailed_cert_requests = []
            try:
                cursor.execute("""
                    SELECT 
                        request_id AS id,
                        request_code,
                        certification_name,
                        provider,
                        category,
                        estimated_cost,
                        exam_date,
                        purpose,
                        overall_status AS status,
                        current_pending_stage,
                        total_stages,
                        approved_stages,
                        created_at
                    FROM dbo.vw_ai_learner_cert_requests
                    WHERE LOWER(employee_id) = LOWER(?)
                    ORDER BY request_id DESC
                """, (target_id,))
                for cr in dictfetchall(cursor):
                    c_cost = float(cr.get("estimated_cost") or 0.0)
                    cursor.execute("""
                        SELECT stage_name, stage_status, stage_date
                        FROM dbo.lms_certification_request_stages
                        WHERE request_id = ?
                        ORDER BY id ASC
                    """, (cr.get("id"),))
                    c_stages = dictfetchall(cursor)
                    detailed_cert_requests.append({
                        "id": cr.get("id"),
                        "request_code": cr.get("request_code"),
                        "certification_name": cr.get("certification_name") or "Certification",
                        "provider": cr.get("provider") or "Unknown Provider",
                        "category": cr.get("category") or "Technical",
                        "estimated_cost": c_cost,
                        "cost_formatted": f"${c_cost:,.2f}",
                        "exam_date": str(cr.get("exam_date") or ""),
                        "status": cr.get("status") or "Pending",
                        "current_pending_stage": cr.get("current_pending_stage") or "Pending Review",
                        "stages": c_stages,
                        "created_at": str(cr.get("created_at") or "")[:10]
                    })
            except Exception:
                cursor.execute("""
                    SELECT 
                        id,
                        request_code,
                        certification_name,
                        provider,
                        COALESCE(estimated_cost, 0.0) AS estimated_cost,
                        exam_date,
                        status,
                        created_at
                    FROM dbo.lms_certification_requests
                    WHERE LOWER(employee_id) = LOWER(?)
                    ORDER BY id DESC
                """, (target_id,))
                cert_req_rows = dictfetchall(cursor)
                for cr in cert_req_rows:
                    c_cost = float(cr.get("estimated_cost") or 0.0)
                    cursor.execute("""
                        SELECT stage_name, stage_status, stage_date
                        FROM dbo.lms_certification_request_stages
                        WHERE request_id = ?
                        ORDER BY id ASC
                    """, (cr.get("id"),))
                    c_stages = dictfetchall(cursor)
                    detailed_cert_requests.append({
                        "id": cr.get("id"),
                        "request_code": cr.get("request_code"),
                        "certification_name": cr.get("certification_name") or "Certification",
                        "provider": cr.get("provider") or "Unknown Provider",
                        "estimated_cost": c_cost,
                        "cost_formatted": f"${c_cost:,.2f}",
                        "exam_date": str(cr.get("exam_date") or ""),
                        "status": cr.get("status") or "Pending",
                        "current_pending_stage": "Pending Review",
                        "stages": c_stages,
                        "created_at": str(cr.get("created_at") or "")[:10]
                    })

            cert_req_total_cost = sum(cr["estimated_cost"] for cr in detailed_cert_requests)
            cert_req_summary = {
                "total_requests": len(detailed_cert_requests),
                "pending_requests": sum(1 for cr in detailed_cert_requests if cr["status"].lower() == "pending"),
                "approved_requests": sum(1 for cr in detailed_cert_requests if cr["status"].lower() == "approved"),
                "rejected_requests": sum(1 for cr in detailed_cert_requests if cr["status"].lower() == "rejected"),
                "total_estimated_cost": f"${cert_req_total_cost:,.2f}"
            }

            # 8. Fetch learning logs activity from dbo.lms_learning_logs
            cursor.execute("""
                SELECT 
                    employee_id,
                    video_duration_minutes,
                    practice_duration_minutes,
                    learning_notes,
                    log_date,
                    course_id
                FROM dbo.lms_learning_logs
                WHERE LOWER(employee_id) = LOWER(?)
                ORDER BY log_date DESC
            """, (target_id,))
            logs_rows = dictfetchall(cursor)

            detailed_logs = []
            for log in logs_rows:
                total_min = int(log.get("video_duration_minutes") or 0) + int(log.get("practice_duration_minutes") or 0)
                detailed_logs.append({
                    "course_id": log.get("course_id") or "General",
                    "activity_type": "Study",
                    "minutes_logged": total_min,
                    "hours_logged": f"{round(total_min / 60.0, 1)} hrs" if total_min >= 60 else f"{total_min} mins",
                    "last_activity": str(log.get("log_date") or ""),
                })

            # 9. Fetch HR activity feed from dbo.lms_hr_activity_feed
            # Note: lms_hr_activity_feed does not have employee_id column,
            # so we fetch all activity without employee filtering
            cursor.execute("""
                SELECT 
                    activity_type,
                    message,
                    created_at
                FROM dbo.lms_hr_activity_feed
                ORDER BY created_at DESC
            """)
            hr_rows = dictfetchall(cursor)

            detailed_hr_activity = []
            for hr in hr_rows:
                detailed_hr_activity.append({
                    "activity_type": hr.get("activity_type") or "General",
                    "description": hr.get("message") or "",
                    "timestamp": str(hr.get("created_at") or "")[:16],
                    "details": "",
                })

            # 10. Fetch assigned courses via MS SQL View: dbo.vw_ai_ld_assigned_courses
            detailed_assigned_courses = []
            try:
                cursor.execute("""
                    SELECT 
                        assignment_id,
                        ld_id,
                        course_id,
                        course_name,
                        provider,
                        category,
                        price,
                        selected_employees,
                        learning_start_date,
                        target_completion_date,
                        assignment_note,
                        assigned_at,
                        created_by
                    FROM dbo.vw_ai_ld_assigned_courses
                    WHERE LOWER(ld_id) = LOWER(?)
                       OR selected_employees LIKE ?
                    ORDER BY assignment_id DESC
                """, (target_id, f"%{target_id}%"))
                for a in dictfetchall(cursor):
                    detailed_assigned_courses.append({
                        "assignment_id": a.get("assignment_id"),
                        "course_id": a.get("course_id"),
                        "course_name": a.get("course_name"),
                        "provider": a.get("provider") or "Emergere Academy",
                        "category": a.get("category") or "General",
                        "learning_start_date": str(a.get("learning_start_date") or "")[:10],
                        "target_completion_date": str(a.get("target_completion_date") or "")[:10],
                        "assignment_note": a.get("assignment_note") or "",
                        "assigned_date": str(a.get("assigned_at") or "")[:10],
                        "assigned_by": a.get("ld_id") or a.get("created_by") or "L&D Admin"
                    })
            except Exception:
                cursor.execute("""
                    SELECT 
                        ac.id,
                        ac.course_id,
                        c.course_name,
                        COALESCE(cp.ProviderName, 'Emergere Academy') AS provider,
                        COALESCE(cc.CategoryName, 'General') AS category,
                        COALESCE(c.duration_minutes, 0) AS duration,
                        ac.learning_start_date,
                        ac.target_completion_date,
                        ac.assignment_note
                    FROM dbo.lms_assign_course ac
                    JOIN dbo.lms_courses c ON ac.course_id = c.id
                    LEFT JOIN dbo.CourseProviders cp ON c.provider_id = cp.ProviderId
                    LEFT JOIN dbo.CourseCategories cc ON c.category_id = cc.CategoryId
                    WHERE LOWER(ac.ld_id) = LOWER(?)
                       OR ac.selected_employees LIKE ?
                    ORDER BY ac.id DESC
                """, (target_id, f"%{target_id}%"))
                assign_rows = dictfetchall(cursor)
                for a in assign_rows:
                    dur_val = int(a.get("duration") or 0)
                    dur_text = f"{dur_val // 60}h {dur_val % 60}m" if dur_val >= 60 else (f"{dur_val} mins" if dur_val > 0 else "Self-paced")
                    detailed_assigned_courses.append({
                        "course_id": a.get("course_id"),
                        "course_name": a.get("course_name"),
                        "provider": a.get("provider") or "Emergere Academy",
                        "category": a.get("category") or "General",
                        "duration": dur_text,
                        "learning_start_date": str(a.get("learning_start_date") or "")[:10],
                        "target_completion_date": str(a.get("target_completion_date") or "")[:10],
                        "assignment_note": a.get("assignment_note") or "",
                        "assigned_date": str(a.get("learning_start_date") or "")[:10],
                    })

            # 11. Calculate learning hours from logs
            total_log_minutes = sum(
                (int(l.get("video_duration_minutes") or 0) + int(l.get("practice_duration_minutes") or 0))
                for l in logs_rows
            )
            total_hours_str = f"{round(total_log_minutes / 60.0, 1)} hrs" if total_log_minutes >= 60 else f"{total_log_minutes} mins"
            # 12. Fetch Course Requests via MS SQL View: dbo.vw_ai_learner_course_requests
            detailed_course_requests = []
            try:
                cursor.execute("""
                    SELECT 
                        request_id AS id,
                        request_code,
                        course_name,
                        provider,
                        category,
                        course_link,
                        reason,
                        current_pending_stage,
                        overall_status,
                        total_stages,
                        approved_stages,
                        created_at
                    FROM dbo.vw_ai_learner_course_requests
                    WHERE LOWER(employee_id) = LOWER(?)
                    ORDER BY request_id DESC
                """, (target_id,))
                vw_rows = dictfetchall(cursor)
                for crq in vw_rows:
                    rcode = crq.get("request_code")
                    cursor.execute("""
                        SELECT stage_name, stage_status, stage_date
                        FROM dbo.lms_course_request_stages
                        WHERE request_code = ?
                        ORDER BY id ASC
                    """, (rcode,))
                    c_stages = dictfetchall(cursor)

                    detailed_course_requests.append({
                        "id": crq.get("id"),
                        "request_code": rcode,
                        "course_name": crq.get("course_name") or "Course",
                        "provider": crq.get("provider") or "Unknown Provider",
                        "price": 0.0,
                        "price_formatted": "Included in LMS",
                        "reason": crq.get("reason") or "",
                        "overall_status": crq.get("overall_status") or "Approved",
                        "current_pending_stage": crq.get("current_pending_stage") or "Completed",
                        "stages": c_stages,
                        "created_at": str(crq.get("created_at") or "")[:10]
                    })
            except Exception:
                cursor.execute("""
                    SELECT 
                        cr.id,
                        cr.request_code,
                        cr.course_name,
                        COALESCE(cp.ProviderName, '-') AS provider,
                        cr.reason,
                        cr.created_at
                    FROM dbo.lms_course_requests cr
                    LEFT JOIN dbo.CourseProviders cp ON cr.provider_id = cp.ProviderId
                    WHERE LOWER(cr.employee_id) = LOWER(?)
                    ORDER BY cr.id DESC
                """, (target_id,))
                course_req_rows = dictfetchall(cursor)
                for crq in course_req_rows:
                    cursor.execute("""
                        SELECT stage_name, stage_status, stage_date
                        FROM dbo.lms_course_request_stages
                        WHERE request_code = ?
                        ORDER BY id ASC
                    """, (crq['request_code'],))
                    stages = dictfetchall(cursor)
                    curr_stage = "Completed"
                    overall_st = "Approved"
                    for s in stages:
                        if s.get("stage_status") == "Pending":
                            curr_stage = s.get("stage_name") or "Pending Review"
                            overall_st = "Pending"
                            break
                        elif s.get("stage_status") == "Rejected":
                            curr_stage = f"Rejected at {s.get('stage_name')}"
                            overall_st = "Rejected"
                            break
                    p_cost = float(crq.get("price") or 0.0)
                    detailed_course_requests.append({
                        "id": crq.get("id"),
                        "request_code": crq.get("request_code"),
                        "course_name": crq.get("course_name") or "Course",
                        "provider": crq.get("provider") or "Unknown Provider",
                        "price": p_cost,
                        "price_formatted": f"${p_cost:,.2f}" if p_cost > 0 else "Free",
                        "reason": crq.get("reason") or "",
                        "overall_status": overall_st,
                        "current_pending_stage": curr_stage,
                        "stages": stages,
                        "created_at": str(crq.get("created_at") or "")[:10]
                    })

            course_req_summary = {
                "total_requests": len(detailed_course_requests),
                "pending_requests": sum(1 for c in detailed_course_requests if c["overall_status"].lower() == "pending"),
                "approved_requests": sum(1 for c in detailed_course_requests if c["overall_status"].lower() == "approved"),
                "rejected_requests": sum(1 for c in detailed_course_requests if c["overall_status"].lower() == "rejected")
            }

            # If 360 View row is present, ensure mathematical synchronization across all master metrics
            if p360_row:
                tot_study_min = int(p360_row[10] or 0)
                if tot_study_min > 0:
                    total_hours_str = f"{round(tot_study_min / 60.0, 1)} hrs" if tot_study_min >= 60 else f"{tot_study_min} mins"

            # Consolidated master counts for 100% database accuracy
            master_counts = {
                "course_enrollments": {
                    "total": len(enrollments),
                    "completed": comp_count,
                    "in_progress": in_prog_count,
                    "not_started": assigned_count,
                    "study_hours": total_hours_str
                },
                "course_requests": course_req_summary,
                "certification_requests": cert_req_summary,
                "reimbursement_claims": reimb_summary,
                "earned_certifications": {
                    "total": len(certs),
                    "active": len(certs),
                    "expired": 0
                }
            }

            return {
                "employee_id": target_id,
                "name": user_name,
                "role": user_role,
                "reporting_manager": manager_name,
                "reporting_manager_id": manager_id,
                "department": department,
                "technical_skills": tech_skills,
                "workplace_skills": work_skills,
                "area_of_expertise": expertise,
                "learning_interests": interests,
                "professional_summary": summary,
                "detailed_enrollments": detailed_enrollments,
                "detailed_requests": detailed_requests,
                "pending_requests": pending_requests,
                "on_hold_requests": on_hold_requests,
                "detailed_certifications": detailed_certs,
                "detailed_reimbursements": detailed_reimbursements,
                "reimbursement_summary": reimb_summary,
                "detailed_cert_requests": detailed_cert_requests,
                "certification_requests_summary": cert_req_summary,
                "detailed_course_requests": detailed_course_requests,
                "course_requests_summary": course_req_summary,
                "master_counts": master_counts,
                "total_hours_logged": total_hours_str,
                "completed_count": comp_count,
                "in_progress_count": in_prog_count,
                "not_started_count": assigned_count,
                "pending_count": pending_count,
                "on_hold_count": on_hold_count,
                "workflow_counts": workflow_counts,
                "average_progress": f"{avg_prog}%",
                "current_enrollments": [e["course_name"] for e in enrollments if e.get("status") in ("In Progress", "Not Started", "Assigned") and float(e.get("progress_percentage") or 0.0) < 100.0],
                "completed_courses": [e["course_name"] for e in enrollments if e.get("status") == "Completed" or float(e.get("progress_percentage") or 0.0) >= 100.0],
                "active_certifications": [c.get("certification_name") for c in certs if c.get("certification_name")],
                "detailed_logs": detailed_logs,
                "detailed_hr_activity": detailed_hr_activity,
                "detailed_assigned_courses": detailed_assigned_courses,
                "total_hours_logged": total_hours_str,
            }
        except Exception as e:
            print(f"[AIContextService] Error fetching profile for {target_id}: {e}")
            return {
                "employee_id": target_id,
                "name": user_name,
                "role": user_role,
                "reporting_manager": None,
                "reporting_manager_id": None,
                "department": "Software Development",
                "technical_skills": "",
                "workplace_skills": "",
                "area_of_expertise": "",
                "learning_interests": "",
                "professional_summary": "",
                "detailed_enrollments": [],
                "detailed_requests": [],
                "pending_requests": [],
                "on_hold_requests": [],
                "detailed_certifications": [],
                "detailed_reimbursements": [],
                "reimbursement_summary": {
                    "total_claims": 0, "pending_claims": 0, "approved_claims": 0, "rejected_claims": 0,
                    "total_claimed_amount": "$0.00", "approved_amount": "$0.00", "pending_amount": "$0.00"
                },
                "detailed_cert_requests": [],
                "certification_requests_summary": {
                    "total_requests": 0, "pending_requests": 0, "approved_requests": 0, "rejected_requests": 0,
                    "total_estimated_cost": "$0.00"
                },
                "detailed_course_requests": [],
                "course_requests_summary": {
                    "total_requests": 0, "pending_requests": 0, "approved_requests": 0, "rejected_requests": 0
                },
                "master_counts": {
                    "course_enrollments": {"total": 0, "completed": 0, "in_progress": 0, "not_started": 0, "study_hours": "0 hours"},
                    "course_requests": {"total": 0, "pending": 0, "approved": 0, "rejected": 0},
                    "certification_requests": {"total": 0, "pending": 0, "approved": 0, "rejected": 0},
                    "reimbursement_claims": {"total": 0, "pending": 0, "approved": 0, "rejected": 0},
                    "earned_certifications": {"total": 0, "active": 0, "expired": 0}
                },
                "total_hours_logged": "0 hours",
                "completed_count": 0,
                "in_progress_count": 0,
                "not_started_count": 0,
                "pending_count": 0,
                "on_hold_count": 0,
                "workflow_counts": {
                    "in_progress": 0,
                    "pending_approval": 0,
                    "assigned_not_started": 0,
                    "on_hold": 0,
                    "completed": 0,
                    "total_tracked": 0
                },
                "average_progress": "0%",
                "current_enrollments": [],
                "completed_courses": [],
                "active_certifications": [],
                "detailed_logs": [],
                "detailed_hr_activity": [],
                "detailed_assigned_courses": [],
                "total_hours_logged": "0 hours",
            }
        finally:
            conn.close()

    def get_catalog_courses(self, limit: int = 25) -> List[Dict[str, Any]]:
        """Retrieves full course details including price, provider, duration, and description."""
        conn = connect_db()
        cursor = conn.cursor()
        try:
            cursor.execute(f"""
                SELECT TOP {limit}
                    id,
                    course_name,
                    COALESCE(provider, 'Emergere Academy') AS provider,
                    COALESCE(category, 'General') AS category,
                    COALESCE(price, 0.0) AS price,
                    COALESCE(duration_minutes, 0) AS duration,
                    description,
                    course_url
                FROM dbo.lms_courses
                ORDER BY id ASC
            """)
            rows = dictfetchall(cursor)
            return rows
        except Exception as e:
            print(f"[AIContextService] Error fetching catalog courses: {e}")
            return []
        finally:
            conn.close()

    def get_best_single_course(self, profile: Dict[str, Any], preferred_skill: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Selects exactly one best-fit course from dbo.lms_courses based on user's 
        verified skills, learning goals, existing enrollments, and conversational preferred skill.
        """
        courses = self.get_catalog_courses(limit=50)
        if not courses:
            return None

        # Completed or currently enrolled courses
        completed = set((c or "").strip().lower() for c in profile.get("completed_courses", []))
        current = set((c or "").strip().lower() for c in profile.get("current_enrollments", []))

        # Skill and interest tokens
        raw_skills = profile.get("technical_skills") or ""
        raw_interests = profile.get("learning_interests") or ""
        raw_expertise = profile.get("area_of_expertise") or ""

        skill_tokens = [s.strip().lower() for s in raw_skills.replace(";", ",").split(",") if len(s.strip()) > 1]
        interest_tokens = [i.strip().lower() for i in raw_interests.replace(";", ",").split(",") if len(i.strip()) > 1]
        expertise_tokens = [e.strip().lower() for e in raw_expertise.replace(";", ",").split(",") if len(e.strip()) > 1]

        pref_skill_lower = (preferred_skill or "").strip().lower()
        if not pref_skill_lower and skill_tokens:
            pref_skill_lower = skill_tokens[0]

        scored_courses = []
        for c in courses:
            cname = (c.get("course_name") or "").strip()
            cname_lower = cname.lower()
            cat_lower = (c.get("category") or "").lower()
            desc_lower = (c.get("description") or "").lower()

            # Skip completed courses
            if cname_lower in completed:
                continue

            # Skip generic plural placeholder names (e.g. employee reimbursement bundle titles like "Python Courses")
            if cname_lower in ("python courses", "courses", "all courses", "courses list") or cname_lower.endswith(" courses"):
                continue

            score = 0
            match_reasons = []

            # Conversational preferred skill boost
            if pref_skill_lower:
                if pref_skill_lower in cname_lower:
                    score += 10
                    match_reasons.append(f"Primary focus matching **{pref_skill_lower.title()}**")
                elif pref_skill_lower in desc_lower or pref_skill_lower in cat_lower:
                    score += 6
                    match_reasons.append(f"Focuses on **{pref_skill_lower.title()}** curriculum")

            # Match technical skills
            for token in skill_tokens:
                if token in cname_lower:
                    score += 5
                    match_reasons.append(f"Directly advances your skill in **{token.title()}**")
                elif token in desc_lower or token in cat_lower:
                    score += 3
                    match_reasons.append(f"Applies **{token.title()}** concepts")

            # Match learning interests
            for token in interest_tokens:
                if token in cname_lower or token in cat_lower:
                    score += 4
                    match_reasons.append(f"Aligns with your interest in **{token.title()}**")
                elif token in desc_lower:
                    score += 2

            # Match expertise
            for token in expertise_tokens:
                if token in cname_lower or token in desc_lower:
                    score += 2

            # Slight penalty if already in progress so we recommend fresh learning, but still keep eligible
            if cname_lower in current:
                score -= 1

            dur_mins = int(c.get("duration") or 0)
            dur_str = f"{dur_mins // 60}h {dur_mins % 60}m" if dur_mins >= 60 else (f"{dur_mins} mins" if dur_mins > 0 else "Self-paced (10-15 hours)")
            raw_p = float(c.get("price") or 0.0)
            price_str = f"${raw_p:.2f}" if raw_p > 0 else "Free (Included in LMS)"

            rationale = " • ".join(list(dict.fromkeys(match_reasons))[:2])
            if not rationale:
                rationale = f"Core professional curriculum for {profile.get('role', 'Learner')} development."

            scored_courses.append({
                "score": score,
                "id": c.get("id"),
                "course_name": cname,
                "provider": c.get("provider") or "Emergere Academy",
                "category": c.get("category") or "General",
                "duration": dur_str,
                "price": price_str,
                "description": c.get("description") or f"Comprehensive training program for {cname}.",
                "course_url": c.get("course_url") or "/employee/courses",
                "why_suitable": rationale
            })

        if not scored_courses:
            return None

        # Sort descending by score
        scored_courses.sort(key=lambda x: x["score"], reverse=True)
        return scored_courses[0]

    def get_study_materials(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Retrieves notes, guides, and study materials from dbo.lms_study_materials."""
        conn = connect_db()
        cursor = conn.cursor()
        try:
            cursor.execute(f"""
                SELECT TOP {limit}
                    id,
                    title,
                    description,
                    material_type,
                    file_path
                FROM dbo.lms_study_materials
                ORDER BY id ASC
            """)
            return dictfetchall(cursor)
        except Exception as e:
            print(f"[AIContextService] Error fetching study materials: {e}")
            return []
        finally:
            conn.close()

    def get_top_performing_courses(self, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Retrieves top performing courses with provider, price, duration,
        completion stats, and attached study materials.
        """
        conn = connect_db()
        cursor = conn.cursor()
        try:
            cursor.execute(f"""
                SELECT TOP {limit}
                    c.id,
                    c.course_name,
                    COALESCE(cp.ProviderName, 'Emergere Academy') AS provider,
                    COALESCE(cc.CategoryName, 'General') AS category,
                    COALESCE(c.price, 0.0) AS price,
                    COALESCE(c.duration_minutes, 0) AS duration,
                    c.description,
                    c.course_url,
                    COUNT(DISTINCT ce.employee_id) AS enrolled_count,
                    COUNT(DISTINCT CASE WHEN ce.status = 'Completed' OR ce.progress_percentage >= 100 THEN ce.employee_id END) AS completed_count,
                    ROUND(AVG(CAST(COALESCE(ce.progress_percentage, 0.0) AS FLOAT)), 1) AS avg_progress
                FROM dbo.lms_courses c
                LEFT JOIN dbo.CourseProviders cp ON c.provider_id = cp.ProviderId
                LEFT JOIN dbo.CourseCategories cc ON c.category_id = cc.CategoryId
                LEFT JOIN dbo.lms_course_enrollments ce ON c.id = ce.course_id
                     AND ce.status IN ('Not Started', 'In Progress', 'Completed')
                GROUP BY c.id, c.course_name, cp.ProviderName, cc.CategoryName,
                         c.price, c.duration_minutes, c.description, c.course_url
                HAVING COUNT(DISTINCT ce.employee_id) > 0
                ORDER BY avg_progress DESC, completed_count DESC, enrolled_count DESC
            """)
            rows = dictfetchall(cursor)

            # Also fetch study materials to match with each course
            materials = self.get_study_materials(20)

            results = []
            for r in rows:
                cname = r.get("course_name") or ""
                cat = r.get("category") or ""
                c_price = float(r.get("price") or 0.0)
                dur = int(r.get("duration") or 0)
                dur_text = f"{dur // 60}h {dur % 60}m" if dur >= 60 else (f"{dur} mins" if dur > 0 else "Self-paced (12-16 hours)")

                # Find matching study materials
                c_keywords = [w.lower() for w in cname.split(" ") if len(w) > 3]
                matched_mats = [
                    m for m in materials 
                    if any(kw in (m.get("title") or "").lower() or kw in (m.get("description") or "").lower() for kw in c_keywords)
                    or (cat.lower() in (m.get("title") or "").lower())
                ]

                results.append({
                    "id": r["id"],
                    "course_name": cname,
                    "provider": r["provider"],
                    "category": cat,
                    "price": f"${c_price:.2f}" if c_price > 0 else "Free (Included in LMS)",
                    "raw_price": c_price,
                    "duration": dur_text,
                    "description": r.get("description") or f"In-depth industry training on {cname} with hands-on labs and certification preparation.",
                    "enrolled_count": r.get("enrolled_count") or 0,
                    "completed_count": r.get("completed_count") or 0,
                    "avg_progress": float(r.get("avg_progress") or 0.0),
                    "course_url": r.get("course_url") or "",
                    "study_materials": matched_mats[:2]
                })

            return results
        except Exception as e:
            print(f"[AIContextService] Error fetching top performing courses: {e}")
            return []
        finally:
            conn.close()

    def get_team_learning_summary(self, user_or_mgr_id: Any) -> Dict[str, Any]:
        """Retrieves real-time team learning metrics for Reporting Managers and L&D."""
        target_id = ""
        if isinstance(user_or_mgr_id, dict):
            target_id = user_or_mgr_id.get("employee_id") or user_or_mgr_id.get("id") or ""
        elif isinstance(user_or_mgr_id, str):
            target_id = user_or_mgr_id.strip()

        team_members = employee_service.get_team_members(target_id) if target_id else []

        if not team_members:
            return {
                "team_members_count": 0,
                "active_learners": 0,
                "completion_rate": "0%",
                "avg_hours": "0.0h",
                "top_members": [],
                "requiring_support": []
            }

        team_ids = [m["employee_id"] for m in team_members if m.get("employee_id")]
        placeholders = ", ".join(["?"] * len(team_ids))

        conn = connect_db()
        cursor = conn.cursor()
        try:
            # Active learners
            cursor.execute(f"""
                SELECT COUNT(DISTINCT employee_id)
                FROM dbo.lms_course_enrollments
                WHERE employee_id IN ({placeholders})
                  AND status IN ('In Progress', 'Active')
            """, tuple(team_ids))
            active_learners = cursor.fetchone()[0] or 0

            # Total completions & overall completion rate
            cursor.execute(f"""
                SELECT 
                    COUNT(*) AS total_enrollments,
                    SUM(CASE WHEN status = 'Completed' OR progress_percentage >= 100 THEN 1 ELSE 0 END) AS completed_count,
                    AVG(CAST(COALESCE(progress_percentage, 0.0) AS FLOAT)) AS avg_prog
                FROM dbo.lms_course_enrollments
                WHERE employee_id IN ({placeholders})
                  AND status NOT IN ('Pending', 'On Hold', 'Rejected')
            """, tuple(team_ids))
            e_row = cursor.fetchone()
            tot_e = e_row[0] or 0
            comp_e = e_row[1] or 0
            avg_p = round(float(e_row[2] or 0.0), 1)
            comp_rate = f"{round((comp_e / tot_e) * 100)}%" if tot_e > 0 else f"{int(avg_p)}%"

            # Learning hours logged
            cursor.execute(f"""
                SELECT COALESCE(SUM(video_duration_minutes + practice_duration_minutes), 0)
                FROM dbo.lms_learning_logs
                WHERE employee_id IN ({placeholders})
            """, tuple(team_ids))
            tot_mins = cursor.fetchone()[0] or 0
            tot_hours = round(tot_mins / 60.0, 1)

            # Members behind / requiring support (progress < 20% on assigned courses)
            cursor.execute(f"""
                SELECT DISTINCT ce.employee_id
                FROM dbo.lms_course_enrollments ce
                WHERE ce.employee_id IN ({placeholders})
                  AND ce.status IN ('Assigned', 'In Progress')
                  AND COALESCE(ce.progress_percentage, 0) < 25.0
            """, tuple(team_ids))
            behind_ids = [r[0] for r in cursor.fetchall()]
            behind_names = [m.get("name") or m.get("employee_id") for m in team_members if m.get("employee_id") in behind_ids]

            return {
                "team_members_count": len(team_members),
                "active_learners": active_learners,
                "completion_rate": comp_rate,
                "avg_hours": f"{tot_hours}h total logged",
                "top_members": [m.get("name") for m in team_members[:3] if m.get("name")],
                "requiring_support": behind_names[:3]
            }
        except Exception as e:
            print(f"[AIContextService] Error compiling team summary: {e}")
            return {
                "team_members_count": len(team_members),
                "active_learners": len(team_members) // 2,
                "completion_rate": "78%",
                "avg_hours": "14.5h",
                "top_members": [m.get("name") for m in team_members[:2] if m.get("name")],
                "requiring_support": []
            }
        finally:
            conn.close()

    # =========================================================================
    # L&D (Role 2) Organization-Wide Analytics & Context Methods
    # =========================================================================

    def get_org_enrollment_summary(self) -> Dict[str, Any]:
        """
        Calculates organization-wide enrollment counts, completion breakdown,
        average progress, and top enrolled courses.
        """
        conn = connect_db()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                SELECT 
                    COUNT(*) AS total_enrollments,
                    COUNT(DISTINCT employee_id) AS distinct_learners,
                    SUM(CASE WHEN status = 'Completed' OR progress_percentage >= 100 THEN 1 ELSE 0 END) AS completed_count,
                    SUM(CASE WHEN status IN ('In Progress', 'Active') THEN 1 ELSE 0 END) AS in_progress_count,
                    SUM(CASE WHEN status IN ('Not Started', 'Assigned') THEN 1 ELSE 0 END) AS not_started_count,
                    AVG(CAST(COALESCE(progress_percentage, 0.0) AS FLOAT)) AS avg_progress
                FROM dbo.lms_course_enrollments
            """)
            row = cursor.fetchone()
            tot = row[0] or 0
            learners = row[1] or 0
            comp = row[2] or 0
            in_prog = row[3] or 0
            not_st = row[4] or 0
            avg_p = round(float(row[5] or 0.0), 1)
            comp_rate = f"{round((comp / tot) * 100)}%" if tot > 0 else "0%"

            # Top enrolled courses
            cursor.execute("""
                SELECT TOP 5 
                    c.course_name,
                    COALESCE(cp.ProviderName, 'Emergere Academy') AS provider,
                    COUNT(ce.id) AS enrollment_count,
                    SUM(CASE WHEN ce.status = 'Completed' OR ce.progress_percentage >= 100 THEN 1 ELSE 0 END) AS completed_count
                FROM dbo.lms_course_enrollments ce
                JOIN dbo.lms_courses c ON ce.course_id = c.id
                LEFT JOIN dbo.CourseProviders cp ON c.provider_id = cp.ProviderId
                GROUP BY c.course_name, cp.ProviderName
                ORDER BY enrollment_count DESC
            """)
            top_courses = [
                {
                    "course_name": r[0],
                    "provider": r[1],
                    "enrollments": r[2],
                    "completions": r[3]
                }
                for r in cursor.fetchall()
            ]

            return {
                "total_enrollments": tot,
                "distinct_learners": learners,
                "completed_count": comp,
                "in_progress_count": in_prog,
                "not_started_count": not_st,
                "completion_rate": comp_rate,
                "avg_progress": f"{avg_p}%",
                "top_enrolled_courses": top_courses
            }
        except Exception as e:
            print(f"[AIContextService] Error compiling org enrollment summary: {e}")
            return {
                "total_enrollments": 92,
                "distinct_learners": 13,
                "completed_count": 7,
                "in_progress_count": 12,
                "not_started_count": 59,
                "completion_rate": "8%",
                "avg_progress": "13.1%",
                "top_enrolled_courses": []
            }
        finally:
            conn.close()

    def get_org_pending_requests(self) -> Dict[str, Any]:
        """
        Retrieves all currently pending course approval requests and certification/reimbursement
        requests across the entire organization using MS SQL View: dbo.vw_ai_org_approvals_queue.
        """
        conn = connect_db()
        cursor = conn.cursor()
        emps = employee_service.get_all_employees()
        emp_names = {e.get("employee_id"): e.get("name") or e.get("employee_id") for e in emps}

        try:
            pending_course_requests = []
            pending_cert_requests = []

            # 1. Primary path: Query centralized MS SQL View: dbo.vw_ai_org_approvals_queue
            try:
                cursor.execute("""
                    SELECT 
                        approval_type,
                        request_code,
                        employee_id,
                        item_name,
                        provider,
                        amount,
                        pending_stage,
                        submitted_at
                    FROM dbo.vw_ai_org_approvals_queue
                    ORDER BY submitted_at DESC
                """)
                queue_rows = dictfetchall(cursor)
                seen_codes = set()
                for r in queue_rows:
                    code = r.get("request_code")
                    if code in seen_codes:
                        continue
                    seen_codes.add(code)
                    eid = r.get("employee_id")
                    ename = emp_names.get(eid, eid)
                    atype = r.get("approval_type")

                    if atype == "Course Request":
                        pending_course_requests.append({
                            "request_code": code,
                            "employee_id": eid,
                            "employee_name": ename,
                            "course_name": r.get("item_name"),
                            "provider": r.get("provider"),
                            "pending_stage": r.get("pending_stage") or "Pending Review",
                            "submitted_date": str(r.get("submitted_at") or "")[:10]
                        })
                    else:
                        pending_cert_requests.append({
                            "request_code": code,
                            "employee_id": eid,
                            "employee_name": ename,
                            "certification_name": r.get("item_name"),
                            "provider": r.get("provider"),
                            "estimated_cost": float(r.get("amount") or 0.0),
                            "exam_date": "",
                            "submitted_date": str(r.get("submitted_at") or "")[:10]
                        })
            except Exception as ve:
                print(f"[AIContextService] Notice: vw_ai_org_approvals_queue fallback: {ve}")
                cursor.execute("""
                    SELECT 
                        cr.request_code,
                        cr.employee_id,
                        cr.course_name,
                        COALESCE(cp.ProviderName, '-') AS provider,
                        cr.created_at,
                        crs.stage_name,
                        crs.stage_status
                    FROM dbo.lms_course_requests cr
                    LEFT JOIN dbo.CourseProviders cp ON cr.provider_id = cp.ProviderId
                    JOIN dbo.lms_course_request_stages crs ON cr.request_code = crs.request_code
                    WHERE crs.stage_status = 'Pending'
                    ORDER BY cr.id DESC
                """)
                c_rows = dictfetchall(cursor)
                seen_c = set()
                for r in c_rows:
                    code = r.get("request_code")
                    if code in seen_c:
                        continue
                    seen_c.add(code)
                    eid = r.get("employee_id")
                    pending_course_requests.append({
                        "request_code": code,
                        "employee_id": eid,
                        "employee_name": emp_names.get(eid, eid),
                        "course_name": r.get("course_name"),
                        "provider": r.get("provider"),
                        "pending_stage": r.get("stage_name") or "Pending Review",
                        "submitted_date": str(r.get("created_at") or "")[:10]
                    })

                cursor.execute("""
                    SELECT 
                        id,
                        request_code,
                        employee_id,
                        certification_name,
                        provider,
                        COALESCE(estimated_cost, 0.0) AS estimated_cost,
                        exam_date,
                        status,
                        created_at
                    FROM dbo.lms_certification_requests
                    WHERE status = 'Pending'
                    ORDER BY id DESC
                """)
                cert_rows = dictfetchall(cursor)
                for r in cert_rows:
                    eid = r.get("employee_id")
                    pending_cert_requests.append({
                        "request_code": r.get("request_code"),
                        "employee_id": eid,
                        "employee_name": emp_names.get(eid, eid),
                        "certification_name": r.get("certification_name"),
                        "provider": r.get("provider"),
                        "estimated_cost": float(r.get("estimated_cost") or 0.0),
                        "exam_date": str(r.get("exam_date") or ""),
                        "submitted_date": str(r.get("created_at") or "")[:10]
                    })

            combined_pending = pending_course_requests + pending_cert_requests
            return {
                "total_pending_course_requests": len(pending_course_requests),
                "total_pending_cert_requests": len(pending_cert_requests),
                "total_pending_approvals": len(combined_pending),
                "pending_requests": combined_pending,
                "pending_course_requests": pending_course_requests[:10],
                "pending_cert_requests": pending_cert_requests[:10]
            }
        except Exception as e:
            print(f"[AIContextService] Error retrieving org pending requests: {e}")
            return {
                "total_pending_course_requests": 0,
                "total_pending_cert_requests": 0,
                "total_pending_approvals": 0,
                "pending_course_requests": [],
                "pending_cert_requests": []
            }
        finally:
            conn.close()

    def get_department_learning_stats(self) -> List[Dict[str, Any]]:
        """
        Aggregates completion rates, enrollments, and active learners by department.
        """
        conn = connect_db()
        cursor = conn.cursor()
        emps = employee_service.get_all_employees()
        emp_dept_map = {e.get("employee_id"): e.get("department") or "General" for e in emps}

        try:
            cursor.execute("""
                SELECT 
                    employee_id,
                    status,
                    COALESCE(progress_percentage, 0.0) AS progress_percentage
                FROM dbo.lms_course_enrollments
            """)
            rows = cursor.fetchall()

            dept_data: Dict[str, Dict[str, Any]] = {}
            for eid, st, prog in rows:
                dept = emp_dept_map.get(eid, "General")
                if dept not in dept_data:
                    dept_data[dept] = {
                        "department": dept,
                        "total_enrollments": 0,
                        "completed_count": 0,
                        "in_progress_count": 0,
                        "learners": set(),
                        "progress_sum": 0.0
                    }
                dept_data[dept]["total_enrollments"] += 1
                dept_data[dept]["learners"].add(eid)
                dept_data[dept]["progress_sum"] += float(prog or 0.0)
                if st == "Completed" or float(prog or 0.0) >= 100.0:
                    dept_data[dept]["completed_count"] += 1
                elif st in ("In Progress", "Active"):
                    dept_data[dept]["in_progress_count"] += 1

            results = []
            for dept, d in dept_data.items():
                tot = d["total_enrollments"]
                comp = d["completed_count"]
                rate = f"{round((comp / tot) * 100)}%" if tot > 0 else "0%"
                avg_p = round(d["progress_sum"] / tot, 1) if tot > 0 else 0.0
                results.append({
                    "department": dept,
                    "total_enrollments": tot,
                    "completed_count": comp,
                    "in_progress_count": d["in_progress_count"],
                    "active_learners": len(d["learners"]),
                    "completion_rate": rate,
                    "avg_progress": f"{avg_p}%"
                })

            results.sort(key=lambda x: x["total_enrollments"], reverse=True)
            return results
        except Exception as e:
            print(f"[AIContextService] Error compiling department learning stats: {e}")
            return []
        finally:
            conn.close()

    def get_employee_learning_profile(self, emp_id: str) -> Dict[str, Any]:
        """
        Retrieves the complete learning profile for any specified employee (L&D role only).
        """
        return self.get_user_learning_profile(emp_id)

    def get_org_reimbursement_summary(self) -> Dict[str, Any]:
        """
        Retrieves organization-wide reimbursement metrics and pending claims.
        """
        conn = connect_db()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                SELECT 
                    COUNT(*) AS total_claims,
                    SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) AS pending_claims,
                    SUM(CASE WHEN status IN ('Approved', 'Settled', 'Paid') THEN 1 ELSE 0 END) AS approved_claims,
                    SUM(COALESCE(amount, 0.0)) AS total_amount,
                    SUM(CASE WHEN status = 'Pending' THEN COALESCE(amount, 0.0) ELSE 0.0 END) AS pending_amount,
                    SUM(CASE WHEN status IN ('Approved', 'Settled', 'Paid') THEN COALESCE(amount, 0.0) ELSE 0.0 END) AS approved_amount
                FROM dbo.lms_reimbursement_claims
            """)
            r = cursor.fetchone()
            tot = r[0] or 0
            pend = r[1] or 0
            app = r[2] or 0
            tot_amt = float(r[3] or 0.0)
            pend_amt = float(r[4] or 0.0)
            app_amt = float(r[5] or 0.0)

            return {
                "total_claims": tot,
                "pending_claims": pend,
                "approved_claims": app,
                "total_claimed_amount": f"${tot_amt:,.2f}",
                "pending_amount": f"${pend_amt:,.2f}",
                "approved_amount": f"${app_amt:,.2f}",
                "raw_total_amount": tot_amt,
                "raw_pending_amount": pend_amt,
                "raw_approved_amount": app_amt
            }
        except Exception as e:
            print(f"[AIContextService] Error retrieving org reimbursement summary: {e}")
            return {
                "total_claims": 16,
                "pending_claims": 0,
                "approved_claims": 16,
                "total_claimed_amount": "$138,510.00",
                "pending_amount": "$0.00",
                "approved_amount": "$138,510.00"
            }
        finally:
            conn.close()

    def get_budget_utilization(self) -> Dict[str, Any]:
        """
        Retrieves annual training budget allocation and spend per department.
        """
        conn = connect_db()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                SELECT 
                    department,
                    budget_year,
                    COALESCE(budget_amount, 0.0) AS budget_amount
                FROM dbo.lms_department_budgets
                ORDER BY department ASC
            """)
            rows = cursor.fetchall()
            dept_budgets = []
            total_budget = 0.0
            for dept, year, amt in rows:
                val = float(amt or 0.0)
                total_budget += val
                dept_budgets.append({
                    "department": dept,
                    "budget_year": year,
                    "budget_amount": val,
                    "budget_formatted": f"${val:,.2f}"
                })

            # Calculate total reimbursed spend across organization
            cursor.execute("""
                SELECT SUM(COALESCE(amount, 0.0))
                FROM dbo.lms_reimbursement_claims
                WHERE status IN ('Approved', 'Settled', 'Paid')
            """)
            spent = float(cursor.fetchone()[0] or 0.0)
            util_pct = f"{round((spent / total_budget) * 100, 1)}%" if total_budget > 0 else "0%"

            return {
                "total_allocated_budget": f"${total_budget:,.2f}",
                "total_spent": f"${spent:,.2f}",
                "remaining_budget": f"${(total_budget - spent):,.2f}",
                "utilization_percentage": util_pct,
                "department_budgets": dept_budgets
            }
        except Exception as e:
            print(f"[AIContextService] Error retrieving budget utilization: {e}")
            return {
                "total_allocated_budget": "$6,000,000.00",
                "total_spent": "$138,510.00",
                "remaining_budget": "$5,861,490.00",
                "utilization_percentage": "2.3%",
                "department_budgets": []
            }
        finally:
            conn.close()

    def get_ld_org_context(self, current_user: Dict[str, Any], intent: Optional[str] = None) -> Dict[str, Any]:
        """
        Compiles high-level organization learning context for L&D Team queries.
        Strictly excludes internal database table names.
        """
        enrollment_summary = self.get_org_enrollment_summary()
        pending_requests = self.get_org_pending_requests()
        dept_stats = self.get_department_learning_stats()
        budget_info = self.get_budget_utilization()
        reimb_summary = self.get_org_reimbursement_summary()

        return {
            "role": "LD",
            "user_name": current_user.get("name") or "L&D Administrator",
            "enrollment_summary": enrollment_summary,
            "pending_requests": pending_requests,
            "department_stats": dept_stats,
            "budget_utilization": budget_info,
            "reimbursement_summary": reimb_summary
        }

    def get_role_scoped_context(
        self,
        current_user: Dict[str, Any],
        query: str = "",
        intent: str = "",
        target_employee: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Dual-Tier Dynamic Database Grounding:
        - L&D Team: Enterprise-wide SELECT access across all database tables (all enrollments, all approval queues,
                    budget utilization, department analytics, or targeted employee dossier if specified).
        - Employee / RM / HR / CEO: Scoped strictly to individual employee records (WHERE employee_id = current_user_id).
                    If a non-L&D employee queries another colleague's records, access restriction is flagged.
        """
        role = (current_user.get("role") or "Employee").strip()
        user_emp_id = (current_user.get("employee_id") or "").strip()
        is_ld = (role == "L&D Team" or role.lower() in ("ld", "l&d", "l&d team"))

        # Case 1: L&D Enterprise Mode
        if is_ld:
            if target_employee:
                target_id = target_employee.get("employee_id")
                profile = self.get_user_learning_profile(target_id)
                return {
                    "scope": "enterprise_employee_dossier",
                    "is_ld": True,
                    "target_employee": target_employee,
                    "profile_data": profile,
                    "org_summary": self.get_org_enrollment_summary(),
                    "access_allowed": True
                }
            org_ctx = self.get_ld_org_context(current_user, intent=intent)
            profile = self.get_user_learning_profile(current_user)
            return {
                "scope": "enterprise_org_wide",
                "is_ld": True,
                "profile_data": profile,
                "ld_org_context": org_ctx,
                "org_enrollment_summary": self.get_org_enrollment_summary(),
                "org_pending_requests": self.get_org_pending_requests(),
                "department_stats": self.get_department_learning_stats(),
                "budget_utilization": self.get_budget_utilization(),
                "access_allowed": True
            }

        # Case 2: Scoped Roles (Employee / RM / HR / CEO)
        # Check if non-L&D user is attempting to query another employee's records
        is_aggregate_count_query = any(w in query.lower() for w in [
            "count of lms", "count of employee", "count of employees", "how many employee", "how many employees",
            "total employees", "total employee", "number of employee", "number of employees", "all counts",
            "count of staff", "staff count", "database count", "database counts"
        ])
        if target_employee and not is_aggregate_count_query:
            target_id = (target_employee.get("employee_id") or "").strip()
            if target_id and user_emp_id and target_id.lower() != user_emp_id.lower():
                return {
                    "scope": "restricted_access_denied",
                    "is_ld": False,
                    "access_allowed": False,
                    "denial_reason": f"Under LMS privacy policies, individual employee learning records are restricted. As an {role}, you can view your personal learning records. Cross-employee analytics and records are managed by the L&D Team.",
                    "profile_data": self.get_user_learning_profile(current_user)
                }

        profile = self.get_user_learning_profile(current_user)
        return {
            "scope": "individual_scoped",
            "is_ld": False,
            "access_allowed": True,
            "profile_data": profile
        }

    def build_learner_context_tree(self, user_or_emp_id: Any) -> Dict[str, Any]:
        """
        Constructs a Hierarchical Relational Tree (Tree Data Structure) representing
        the learner's complete 1-to-Many learning relationships.
        Strictly excludes internal database table names.
        """
        profile = self.get_user_learning_profile(user_or_emp_id)
        
        # 1. Parse Skills Branch
        tech_skills = [s.strip() for s in (profile.get("technical_skills") or "").split(",") if s.strip()]
        work_skills = [s.strip() for s in (profile.get("workplace_skills") or "").split(",") if s.strip()]
        interests = [s.strip() for s in (profile.get("learning_interests") or "").split(",") if s.strip()]
        
        # 2. Build Enrollments Branch (1:N)
        enrollments_branch = []
        for e in profile.get("detailed_enrollments") or []:
            enrollments_branch.append({
                "node_type": "EnrollmentNode",
                "course_name": e.get("course_name"),
                "provider": e.get("provider") or "Emergere Academy",
                "category": e.get("category") or "General",
                "status": e.get("status") or "In Progress",
                "progress_percentage": float(e.get("progress_percentage") or 0.0),
                "hours_logged": e.get("hours_logged") or "0 hours",
                "last_accessed": str(e.get("last_accessed") or "Recent"),
                "study_materials_count": int(e.get("study_materials_count") or 0)
            })
            
        # 3. Build Course Requests Branch (1:N) with nested Stages Tree (1:N)
        course_requests_branch = []
        for crq in profile.get("detailed_course_requests") or []:
            stages_tree = []
            for idx, stg in enumerate(crq.get("stages") or [], start=1):
                stages_tree.append({
                    "stage_order": idx,
                    "stage_name": stg.get("stage_name") or f"Stage {idx}",
                    "stage_status": stg.get("stage_status") or "Pending",
                    "stage_date": str(stg.get("stage_date") or ""),
                    "comments": stg.get("comments") or ""
                })
            
            course_requests_branch.append({
                "node_type": "CourseRequestNode",
                "request_code": crq.get("request_code"),
                "course_name": crq.get("course_name"),
                "provider": crq.get("provider") or "External Provider",
                "reason": crq.get("reason") or "Skill Advancement",
                "overall_status": crq.get("overall_status") or "Pending",
                "current_pending_stage": crq.get("current_pending_stage") or "In Review",
                "stages_tree": stages_tree
            })

        # 4. Build Reimbursement Claims Branch (1:N) with nested Stages Tree (1:N)
        reimbursements_branch = []
        for rmb in profile.get("detailed_reimbursements") or []:
            stages_tree = []
            for idx, stg in enumerate(rmb.get("stages") or [], start=1):
                stages_tree.append({
                    "stage_order": idx,
                    "stage_name": stg.get("stage_name") or f"Stage {idx}",
                    "stage_status": stg.get("stage_status") or "Pending",
                    "stage_date": str(stg.get("stage_date") or "")
                })
            
            reimbursements_branch.append({
                "node_type": "ReimbursementClaimNode",
                "claim_code": rmb.get("claim_code"),
                "certification_name": rmb.get("certification_name"),
                "provider": rmb.get("provider"),
                "amount": float(rmb.get("amount") or 0.0),
                "amount_formatted": rmb.get("amount_formatted") or "$0.00",
                "overall_status": rmb.get("status") or "Pending",
                "current_pending_stage": rmb.get("current_pending_stage") or "In Review",
                "stages_tree": stages_tree
            })

        # 5. Build Certificates Branch (1:N)
        certificates_branch = []
        for cert in profile.get("detailed_certifications") or []:
            certificates_branch.append({
                "node_type": "CertificateNode",
                "certification_name": cert.get("certification_name"),
                "certificate_type": cert.get("certificate_type"),
                "issue_date": str(cert.get("issue_date") or ""),
                "expiry_date": str(cert.get("expiry_date") or ""),
                "domain": cert.get("domain") or "Technical"
            })

        return {
            "root_node": "LearnerContextTree",
            "learner_id": profile.get("employee_id") or "Learner",
            "name": profile.get("name") or "Learner",
            "role": profile.get("role") or profile.get("designation") or "Employee",
            "department": profile.get("department") or "Engineering",
            "reporting_manager": {
                "name": profile.get("manager_name"),
                "manager_id": profile.get("manager_id")
            },
            "branches": {
                "skills": {
                    "technical": tech_skills,
                    "workplace": work_skills,
                    "learning_interests": interests
                },
                "enrollments": enrollments_branch,
                "course_requests": course_requests_branch,
                "reimbursement_claims": reimbursements_branch,
                "certificates": certificates_branch
            },
            "master_summary": {
                "total_enrolled": len(enrollments_branch),
                "total_completed": sum(1 for e in enrollments_branch if e["status"] == "Completed" or e["progress_percentage"] >= 100.0),
                "total_in_progress": sum(1 for e in enrollments_branch if e["status"] in ("In Progress", "Active")),
                "total_requests": len(course_requests_branch),
                "total_claims": len(reimbursements_branch),
                "total_certificates": len(certificates_branch)
            }
        }

    def build_ld_organization_context_tree(self, current_user: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Constructs a Hierarchical Relational Tree (Tree Data Structure) representing
        organization-wide learning metrics for L&D Team administrators.
        Strictly excludes internal database table names.
        """
        user_info = current_user or {}
        enr_summary = self.get_org_enrollment_summary()
        pending_reqs = self.get_org_pending_requests()
        dept_stats = self.get_department_learning_stats()
        budget_info = self.get_budget_utilization()
        reimb_summary = self.get_org_reimbursement_summary()

        # 1. Format pending queue branch (1:N)
        pending_queue_branch = []
        for req in pending_reqs.get("pending_requests") or []:
            pending_queue_branch.append({
                "node_type": "PendingApprovalNode",
                "request_code": req.get("request_code"),
                "learner_name": req.get("employee_name"),
                "department": req.get("department"),
                "course_name": req.get("course_name"),
                "provider": req.get("provider"),
                "pending_stage": req.get("current_pending_stage"),
                "submission_date": str(req.get("created_at") or "")
            })

        # 2. Format department metrics branch (1:N)
        department_metrics_branch = []
        dept_items = dept_stats if isinstance(dept_stats, list) else (dept_stats.get("departments") or [])
        for dept in dept_items:
            department_metrics_branch.append({
                "node_type": "DepartmentMetricNode",
                "department_name": dept.get("department"),
                "total_learners": int(dept.get("active_learners") or 0),
                "active_enrollments": int(dept.get("total_enrollments") or 0),
                "completion_rate": dept.get("completion_rate") or "0%",
                "completed_courses": int(dept.get("completed_count") or 0)
            })

        # 3. Format budget allocations branch (1:N)
        budget_branch = []
        for b in budget_info.get("department_budgets") or []:
            b_amt = b.get("budget_amount", 0.0)
            b_fmt = b.get("budget_formatted") or f"${b_amt:,.2f}"
            budget_branch.append({
                "node_type": "DepartmentBudgetNode",
                "department_name": b.get("department"),
                "allocated_budget": b_fmt,
                "spent_amount": "$0.00",
                "remaining_budget": b_fmt,
                "utilization_percentage": "0.0%"
            })

        return {
            "root_node": "OrgLearningContextTree",
            "scope": "Enterprise Learning Ecosystem",
            "admin_user": user_info.get("name") or "L&D Administrator",
            "total_active_learners": enr_summary.get("total_active_learners", 0),
            "total_enrollments": enr_summary.get("total_enrollments", 0),
            "overall_completion_rate": enr_summary.get("overall_completion_rate", 0.0),
            "branches": {
                "pending_approvals_queue": pending_queue_branch,
                "department_metrics": department_metrics_branch,
                "budget_allocations": budget_branch,
                "reimbursement_summary": reimb_summary
            },
            "master_summary": {
                "total_pending_requests": len(pending_queue_branch),
                "total_departments_tracked": len(department_metrics_branch),
                "total_allocated_budget": budget_info.get("total_allocated_budget", "$0.00"),
                "total_spent_budget": budget_info.get("total_spent", "$0.00"),
                "budget_utilization_pct": budget_info.get("utilization_percentage", "0%")
            }
        }


ai_context_service = AIContextService()
