"""
Course Service.
Business logic, validation, code generation, and transaction management for Video Courses.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
from fastapi import HTTPException, status
from database.connection import connect_db, dictfetchall, is_sql_server
from repositories.ld import course_repository
from models.ld.course import CourseCreate, CourseUpdate, CourseHRReview
from constants.course_metadata import resolve_provider_name, resolve_category_name
from repositories.common.course_metadata_repository import course_metadata_repository
from services.common.auth_service import employee_service
from utils.idempotency import is_unique_violation

def _normalize_course_description(desc: Optional[str]) -> Optional[str]:
    if not desc:
        return None
    import re
    text = str(desc).replace("\r\n", "\n").replace("\r", "\n").replace("\t", " ")
    text = re.sub(r" {2,}", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\n{2,}", "\n", text).strip()[:500]
    return text or None


class CourseService:
    def get_all(
        self,
        is_active: Optional[bool] = None,
        hr_status: Optional[str] = None,
        search: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        conn = connect_db()
        cursor = conn.cursor()
        try:
            return course_repository.get_all_courses(cursor, is_active=is_active, hr_status=hr_status, search=search)
        finally:
            conn.close()

    def get_by_id(self, course_id: int) -> Dict[str, Any]:
        conn = connect_db()
        cursor = conn.cursor()
        try:
            course = course_repository.get_course_by_id(cursor, course_id)
            if not course:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Course with ID {course_id} not found"
                )
            return course
        finally:
            conn.close()

    def create(self, data: CourseCreate) -> Dict[str, Any]:
        conn = connect_db()
        cursor = conn.cursor()
        try:
            prov_id = data.provider_id or course_metadata_repository.resolve_provider_id(data.provider_name, cursor=cursor)
            cat_id = data.category_id or course_metadata_repository.resolve_category_id(data.category_name, cursor=cursor)
            email_id = data.course_email_id or course_metadata_repository.resolve_course_email_id(data.course_account_email, cursor=cursor)

            p_name = course_metadata_repository.ensure_provider_exists(data.provider_name, cursor=cursor) if data.provider_name else None
            c_name = course_metadata_repository.ensure_category_exists(data.category_name, cursor=cursor) if data.category_name else None
            clean_title = (data.course_title or "").strip()[:100]
            clean_prov = (p_name or "Udemy").strip()[:30]

            lock_hint = " WITH (UPDLOCK, HOLDLOCK)" if is_sql_server() else ""
            cursor.execute(
                f"""
                SELECT TOP 1 c.id FROM dbo.lms_courses c{lock_hint}
                LEFT JOIN dbo.CourseProviders cp ON c.provider_id = cp.ProviderId
                WHERE LOWER(LTRIM(RTRIM(c.course_name))) = LOWER(?)
                  AND (c.provider_id = ? OR LOWER(LTRIM(RTRIM(COALESCE(cp.ProviderName, '')))) = LOWER(?))
                  AND COALESCE(c.hr_status, 'Pending') <> 'Rejected'
                """,
                (clean_title, prov_id, clean_prov),
            )
            if cursor.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Course '{clean_title}' from '{clean_prov}' already exists in the catalogue.",
                )

            cost = data.price if data.price is not None else 0
            doc = data.supported_document or data.course_thumbnail_name
            course_req_id = data.request_id
            claim_id = data.claim_id
            if not claim_id:
                if not course_req_id:
                    claim_id = course_repository.generate_next_purchase_code(cursor)
                else:
                    claim_id = course_repository.generate_next_claim_id(cursor)

            course_id = course_repository.insert_course(
                cursor,
                ld_id=data.ld_id,
                course_url=data.course_url,
                course_title=data.course_title,
                provider_id=prov_id,
                category_id=cat_id,
                course_email_id=email_id,
                provider_name=p_name,
                category_name=c_name,
                duration=data.duration,
                duration_minutes=data.duration_minutes,
                price=cost,
                course_account_email=data.course_account_email,
                description=_normalize_course_description(data.description),
                supported_document=doc,
                is_active=data.is_active,
                hr_status=data.hr_status or "Pending",
                request_id=course_req_id,
                claim_id=claim_id,
                created_by=data.created_by
            )

            # Dispatch notification to HR specialists awaiting reimbursement review
            from repositories.common import notification_repository
            from repositories.ld import reimbursement_claim_repository
            hr_employees = employee_service.get_employee_ids_by_role("HR", "HR Team")
            cost_fmt = f" (₹{int(cost):,})" if cost else ""
            ld_creator = str(data.created_by).strip()[:7] if data.created_by else None

            for hr_emp in hr_employees:
                try:
                    notification_repository.insert_notification(
                        cursor,
                        employee_id=hr_emp,
                        message=f"New Course Reimbursement Claim: L&D purchased '{data.course_title}'{cost_fmt} awaiting HR reimbursement approval.",
                        is_read=False,
                        created_by=ld_creator
                    )
                except Exception as n_err:
                    print(f"[CourseService] HR notice error: {n_err}")

            # Log to lms_hr_activity_feed
            try:
                reimbursement_claim_repository.insert_hr_activity(
                    cursor=cursor,
                    activity_type="COURSE_PURCHASED",
                    message=f"Course '{data.course_title}'{cost_fmt} purchased by L&D and submitted for reimbursement ({claim_id}).",
                    created_by=ld_creator
                )
            except Exception as f_err:
                print(f"[CourseService] Activity feed error: {f_err}")

            conn.commit()
            return course_repository.get_course_by_id(cursor, course_id)
        except Exception as e:
            conn.rollback()
            if isinstance(e, HTTPException):
                raise e
            if is_unique_violation(e):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Course '{(data.course_title or '').strip()}' already exists in the catalogue."
                )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create course: {str(e)}"
            )
        finally:
            conn.close()

    def update(self, course_id: int, data: CourseUpdate) -> Dict[str, Any]:
        conn = connect_db()
        cursor = conn.cursor()
        try:
            existing = course_repository.get_course_by_id(cursor, course_id)
            if not existing:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Course with ID {course_id} not found"
                )

            cost = data.price
            doc = data.supported_document or data.course_thumbnail_name

            p_name = course_metadata_repository.ensure_provider_exists(data.provider_name, cursor=cursor) if data.provider_name else None
            c_name = course_metadata_repository.ensure_category_exists(data.category_name, cursor=cursor) if data.category_name else None

            course_repository.update_course(
                cursor,
                course_id=course_id,
                course_title=data.course_title,
                course_url=data.course_url,
                provider_id=data.provider_id,
                category_id=data.category_id,
                course_email_id=data.course_email_id,
                provider_name=p_name,
                category_name=c_name,
                duration=data.duration,
                duration_minutes=data.duration_minutes,
                course_account_email=data.course_account_email,
                price=cost,
                description=_normalize_course_description(data.description),
                supported_document=doc,
                claim_id=data.claim_id,
                is_active=data.is_active,
                updated_by=data.updated_by,
            )
            conn.commit()
            return course_repository.get_course_by_id(cursor, course_id)
        except Exception as e:
            conn.rollback()
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update course: {str(e)}"
            )
        finally:
            conn.close()

    def delete(self, course_id: int) -> Dict[str, str]:
        conn = connect_db()
        cursor = conn.cursor()
        try:
            existing = course_repository.get_course_by_id(cursor, course_id)
            if not existing:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Course with ID {course_id} not found"
                )
            course_repository.delete_course(cursor, course_id)
            conn.commit()
            return {"message": f"Course {course_id} deleted successfully"}
        except Exception as e:
            conn.rollback()
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete course: {str(e)}"
            )
        finally:
            conn.close()

    def review_course_hr(self, course_id: int, review_data: CourseHRReview) -> Dict[str, Any]:
        """HR Accept/Reject of newly purchased course reimbursement claim."""
        from datetime import datetime
        raw_status = (review_data.hr_status or "").strip().lower()
        if raw_status in ("approved", "accept", "accepted"):
            normalized_status = "Approved"
        elif raw_status in ("rejected", "reject"):
            normalized_status = "Rejected"
        else:
            normalized_status = "Pending"

        conn = connect_db()
        cursor = conn.cursor()
        try:
            existing = course_repository.get_course_by_id(cursor, course_id)
            if not existing:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Course with ID {course_id} not found"
                )

            current_hr_status = (existing.get("hr_status") or "Pending").strip()
            if current_hr_status == normalized_status and normalized_status in ("Approved", "Rejected"):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Course reimbursement '{existing.get('course_title') or course_id}' has already been {current_hr_status.lower()}."
                )

            # Resolve HR numeric id cleanly from employee_id (lms_employee_profiles PK is employee_id)
            effective_hr_id = review_data.hr_id
            emp_ident = (review_data.hr_employee_id or review_data.hr_email or "").strip()
            emp_id_to_check = emp_ident
            if emp_ident and "@" in emp_ident:
                emp_match = employee_service.get_employee_by_email(emp_ident)
                if emp_match and emp_match.get("employee_id"):
                    emp_id_to_check = emp_match["employee_id"]

            if not effective_hr_id or effective_hr_id == 1:
                digits = "".join(ch for ch in (emp_id_to_check or "") if ch.isdigit())
                effective_hr_id = int(digits) if digits else None

            reviewed_at = datetime.utcnow()
            course_repository.update_course_hr_status(
                cursor,
                course_id=course_id,
                hr_status=normalized_status,
                hr_id=effective_hr_id,
                hr_reviewed_at=reviewed_at
            )

            # If this course is linked to lms_request_new_course / lms_course_requests, also update request hr_status
            if existing.get("request_id"):
                try:
                    cursor.execute("""
                        IF OBJECT_ID('dbo.lms_course_requests', 'U') IS NOT NULL
                        BEGIN
                            UPDATE dbo.lms_course_requests
                            SET updated_at = SYSDATETIME()
                            WHERE id = ?;
                        END
                    """, (existing["request_id"],))
                    cursor.execute("""
                        IF OBJECT_ID('dbo.lms_request_new_course', 'U') IS NOT NULL
                        BEGIN
                            UPDATE lms_request_new_course
                            SET hr_status = ?,
                                hr_reviewed_at = ?,
                                hr_id = COALESCE(?, hr_id),
                                hr_comment = COALESCE(?, hr_comment),
                                updated_at = CURRENT_TIMESTAMP
                            WHERE new_course_id = ?;
                        END
                    """, (normalized_status, reviewed_at, effective_hr_id, review_data.hr_comment, existing["request_id"]))
                except Exception as req_err:
                    print(f"[CourseService] Linked request update notice: {req_err}")

            # 1. Financial Spend & Budget Tracking upon Approval
            from repositories.common import notification_repository
            from repositories.ld import reimbursement_claim_repository
            admin_actor = str(review_data.hr_employee_id).strip()[:7] if review_data.hr_employee_id else None
            course_title = existing.get("course_title", "Course")
            cost_val = float(existing.get("price") or 0.0)
            claim_code = existing.get("claim_id") or f"CLM-2026-{course_id:04d}"

            # Determine department
            dept = existing.get("employee_department") or "L&D Team"
            if (not dept or dept == "L&D Team") and existing.get("request_id"):
                try:
                    cursor.execute("""
                        SELECT ep.[Department] FROM dbo.lms_course_requests cr
                        JOIN dbo.lms_employee_profiles ep ON cr.employee_id = ep.[Employee ID]
                        WHERE cr.id = ?
                    """, (existing["request_id"],))
                    d_row = cursor.fetchone()
                    if d_row and d_row[0]:
                        dept = d_row[0]
                except Exception:
                    dept = "L&D Team"

            if normalized_status == "Approved":
                # Log financial spend in dbo.lms_spend_category
                try:
                    reimbursement_claim_repository.insert_spend_category(
                        cursor=cursor,
                        spend_category="Courses",
                        department=dept,
                        amount=cost_val,
                        created_by=admin_actor
                    )
                except Exception as spend_err:
                    print(f"[CourseService] Notice logging spend: {spend_err}")

                # Ensure / track budget in dbo.lms_department_budgets
                try:
                    cursor.execute("""
                        SELECT budget_amount FROM dbo.lms_department_budgets
                        WHERE department = ? AND budget_year = YEAR(GETDATE())
                    """, (dept,))
                    b_row = cursor.fetchone()
                    if not b_row:
                        cursor.execute("""
                            INSERT INTO dbo.lms_department_budgets (
                                department, budget_year, budget_amount, created_at, created_by
                            )
                            VALUES (?, YEAR(GETDATE()), 500000.00, GETDATE(), ?)
                        """, (dept[:100], admin_actor))
                except Exception as b_err:
                    print(f"[CourseService] Department budget tracking notice: {b_err}")

                # Audit in dbo.lms_hr_activity_feed
                try:
                    feed_msg = f"Course reimbursement claim {claim_code} for '{course_title}' (₹{int(cost_val):,}) approved for {dept}."
                    reimbursement_claim_repository.insert_hr_activity(
                        cursor=cursor,
                        activity_type="COURSE_REIMBURSEMENT_APPROVED",
                        message=feed_msg,
                        created_by=admin_actor
                    )
                except Exception as feed_err:
                    print(f"[CourseService] Activity feed notice: {feed_err}")
            else:
                # Audit rejection in dbo.lms_hr_activity_feed
                try:
                    reason_str = f" Reason: {review_data.hr_comment}" if review_data.hr_comment else ""
                    feed_msg = f"Course reimbursement claim {claim_code} for '{course_title}' rejected by HR.{reason_str}"
                    reimbursement_claim_repository.insert_hr_activity(
                        cursor=cursor,
                        activity_type="COURSE_REIMBURSEMENT_REJECTED",
                        message=feed_msg,
                        created_by=admin_actor
                    )
                except Exception as feed_err:
                    print(f"[CourseService] Activity feed notice: {feed_err}")

            # 2. Dispatch Notifications ONLY to the respective L&D member who added the course to catalog
            formatted_cost = f" (₹{int(cost_val):,})" if cost_val else ""
            if normalized_status == "Approved":
                notif_msg = f"Course Reimbursement Approved: HR has approved the reimbursement claim for '{course_title}'{formatted_cost}."
            else:
                reason_part = f" Reason: {review_data.hr_comment}" if review_data.hr_comment else ""
                notif_msg = f"Course Reimbursement Rejected: HR has rejected the reimbursement claim for '{course_title}'.{reason_part}"

            ld_adder = existing.get("created_by") or existing.get("ld_id")
            ld_targets = set()
            if ld_adder:
                ld_targets.add(str(ld_adder).strip().upper()[:7])
            # Fallback to L&D team if adder employee_id is unrecorded
            if not ld_targets:
                for ld_emp in employee_service.get_employee_ids_by_role("L&D", "L&D Team"):
                    ld_targets.add(str(ld_emp).strip().upper()[:7])

            for ld_emp in ld_targets:
                try:
                    notification_repository.insert_notification(
                        cursor,
                        employee_id=ld_emp,
                        message=notif_msg,
                        is_read=False,
                        created_by=admin_actor
                    )
                except Exception as notif_err:
                    print(f"[CourseService] Notification dispatch notice for {ld_emp}: {notif_err}")

            conn.commit()
            return course_repository.get_course_by_id(cursor, course_id)
        except Exception as e:
            conn.rollback()
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to review course claim: {str(e)}"
            )
        finally:
            conn.close()

    def get_hr_employee_records_analytics(self) -> Dict[str, Any]:
        """
        Calculates live metrics for HR Employee Records:
        1. Courses Data:
           - Assigned Courses: Only L&D assigned courses to employees (from dbo.lms_assign_course).
           - Completed Courses: Enrollments with status Completed or progress_percentage >= 100.
           - Active Courses: Current enrolled in-progress courses (status in ('in progress', 'active') or 0 < progress < 100).
           - Overdue Courses: L&D assignments where target completion date < today and not completed.
        2. Monthly Learning Hours Trends:
           - Trailing 6 months aggregated learning hours from dbo.lms_learning_logs.
        """
        conn = connect_db()
        cursor = conn.cursor()
        try:
            tbl = "dbo." if is_sql_server() else ""

            # Resolve all employees for names and breakdowns
            all_emps = employee_service.get_all_employees()
            name_map = {e.get("employee_id"): e.get("name") or e.get("full_name") or e.get("employee_id") for e in all_emps if e.get("employee_id")}

            if is_sql_server():
                cursor.execute("""
                    WITH AllEnrollments AS (
                        SELECT 
                            ce.employee_id,
                            ce.course_id,
                            ce.status,
                            COALESCE(ce.progress_percentage, 0.0) AS progress,
                            ac.target_completion_date,
                            CASE 
                                WHEN ce.status = 'Assigned' 
                                  OR EXISTS (
                                      SELECT 1 FROM dbo.lms_assign_course ac2 
                                      WHERE ac2.course_id = ce.course_id 
                                        AND (CHARINDEX(ce.employee_id, ac2.selected_employees) > 0 OR ac2.selected_employees IS NULL)
                                  ) THEN 1 
                                ELSE 0 
                            END AS is_ld_assigned,
                            CASE 
                                WHEN ce.status != 'Completed' 
                                 AND COALESCE(ce.progress_percentage, 0.0) < 100.0 
                                 AND ac.target_completion_date IS NOT NULL 
                                 AND ac.target_completion_date < CAST(GETDATE() AS DATE) 
                                THEN 1 ELSE 0 
                            END AS is_overdue
                        FROM dbo.lms_course_enrollments ce
                        OUTER APPLY (
                            SELECT TOP 1 ac.target_completion_date
                            FROM dbo.lms_assign_course ac
                            WHERE ac.course_id = ce.course_id
                              AND (CHARINDEX(ce.employee_id, ac.selected_employees) > 0 OR ac.selected_employees IS NULL)
                            ORDER BY ac.id DESC
                        ) ac
                        WHERE ce.status NOT IN ('Pending', 'On Hold', 'Rejected')
                          AND NOT EXISTS (
                              SELECT 1 FROM dbo.lms_enrollment_requests er
                              WHERE er.employee_id = ce.employee_id
                                AND er.course_id = ce.course_id
                                AND er.status IN ('Pending', 'On Hold', 'Rejected')
                          )
                    )
                    SELECT 
                        COUNT(*) AS total_tracked,
                        SUM(CASE WHEN is_ld_assigned = 1 AND status != 'Completed' AND progress < 100.0 THEN 1 ELSE 0 END) AS assigned,
                        SUM(CASE WHEN status = 'Completed' OR progress >= 100.0 THEN 1 ELSE 0 END) AS completed,
                        SUM(CASE WHEN ((status = 'In Progress' OR progress > 0.0) OR is_overdue = 1) AND status != 'Completed' AND progress < 100.0 THEN 1 ELSE 0 END) AS active,
                        SUM(CASE WHEN is_overdue = 1 THEN 1 ELSE 0 END) AS overdue
                    FROM AllEnrollments;
                """)
                agg_row = cursor.fetchone()
                total_tracked = int(agg_row[0] or 0)
                assigned_count = int(agg_row[1] or 0)
                completed_count = int(agg_row[2] or 0)
                active_count = int(agg_row[3] or 0)
                overdue_count = int(agg_row[4] or 0)

                # Member breakdowns
                cursor.execute("""
                    WITH AllEnrollments AS (
                        SELECT 
                            ce.employee_id,
                            ce.course_id,
                            ce.status,
                            COALESCE(ce.progress_percentage, 0.0) AS progress,
                            ac.target_completion_date,
                            CASE 
                                WHEN ce.status = 'Assigned' 
                                  OR EXISTS (
                                      SELECT 1 FROM dbo.lms_assign_course ac2 
                                      WHERE ac2.course_id = ce.course_id 
                                        AND (CHARINDEX(ce.employee_id, ac2.selected_employees) > 0 OR ac2.selected_employees IS NULL)
                                  ) THEN 1 
                                ELSE 0 
                            END AS is_ld_assigned,
                            CASE 
                                WHEN ce.status != 'Completed' 
                                 AND COALESCE(ce.progress_percentage, 0.0) < 100.0 
                                 AND ac.target_completion_date IS NOT NULL 
                                 AND ac.target_completion_date < CAST(GETDATE() AS DATE) 
                                THEN 1 ELSE 0 
                            END AS is_overdue
                        FROM dbo.lms_course_enrollments ce
                        OUTER APPLY (
                            SELECT TOP 1 ac.target_completion_date
                            FROM dbo.lms_assign_course ac
                            WHERE ac.course_id = ce.course_id
                              AND (CHARINDEX(ce.employee_id, ac.selected_employees) > 0 OR ac.selected_employees IS NULL)
                            ORDER BY ac.id DESC
                        ) ac
                        WHERE ce.status NOT IN ('Pending', 'On Hold', 'Rejected')
                          AND NOT EXISTS (
                              SELECT 1 FROM dbo.lms_enrollment_requests er
                              WHERE er.employee_id = ce.employee_id
                                AND er.course_id = ce.course_id
                                AND er.status IN ('Pending', 'On Hold', 'Rejected')
                          )
                    )
                    SELECT 
                        employee_id,
                        SUM(CASE WHEN is_ld_assigned = 1 AND status != 'Completed' AND progress < 100.0 THEN 1 ELSE 0 END) AS assigned,
                        SUM(CASE WHEN status = 'Completed' OR progress >= 100.0 THEN 1 ELSE 0 END) AS completed,
                        SUM(CASE WHEN ((status = 'In Progress' OR progress > 0.0) OR is_overdue = 1) AND status != 'Completed' AND progress < 100.0 THEN 1 ELSE 0 END) AS active,
                        SUM(CASE WHEN is_overdue = 1 THEN 1 ELSE 0 END) AS overdue
                    FROM AllEnrollments
                    GROUP BY employee_id;
                """)
                m_rows = cursor.fetchall()

                # Overdue details
                cursor.execute("""
                    SELECT 
                        ce.employee_id,
                        c.course_name,
                        COALESCE(ce.progress_percentage, 0.0) AS progress,
                        ac.target_completion_date,
                        DATEDIFF(day, ac.target_completion_date, GETDATE()) AS days_overdue
                    FROM dbo.lms_course_enrollments ce
                    LEFT JOIN dbo.lms_courses c ON c.id = ce.course_id
                    OUTER APPLY (
                        SELECT TOP 1 ac.target_completion_date
                        FROM dbo.lms_assign_course ac
                        WHERE ac.course_id = ce.course_id
                          AND (CHARINDEX(ce.employee_id, ac.selected_employees) > 0 OR ac.selected_employees IS NULL)
                        ORDER BY ac.id DESC
                    ) ac
                    WHERE ce.status NOT IN ('Pending', 'On Hold', 'Rejected')
                      AND ce.status != 'Completed'
                      AND COALESCE(ce.progress_percentage, 0.0) < 100.0
                      AND ac.target_completion_date IS NOT NULL
                      AND ac.target_completion_date < CAST(GETDATE() AS DATE)
                      AND NOT EXISTS (
                          SELECT 1 FROM dbo.lms_enrollment_requests er
                          WHERE er.employee_id = ce.employee_id
                            AND er.course_id = ce.course_id
                            AND er.status IN ('Pending', 'On Hold', 'Rejected')
                      )
                      AND (
                          ce.status = 'Assigned'
                          OR EXISTS (
                              SELECT 1 FROM dbo.lms_assign_course ac2
                              WHERE ac2.course_id = ce.course_id
                                AND (CHARINDEX(ce.employee_id, ac2.selected_employees) > 0 OR ac2.selected_employees IS NULL)
                          )
                      )
                """)
                od_rows = cursor.fetchall()
            else:
                cursor.execute("""
                    WITH AllEnrollments AS (
                        SELECT 
                            ce.employee_id,
                            ce.course_id,
                            ce.status,
                            COALESCE(ce.progress_percentage, 0.0) AS progress,
                            ac.target_completion_date,
                            CASE 
                                WHEN ce.status = 'Assigned' 
                                  OR EXISTS (
                                      SELECT 1 FROM lms_assign_course ac2 
                                      WHERE ac2.course_id = ce.course_id 
                                        AND (instr(ac2.selected_employees, ce.employee_id) > 0 OR ac2.selected_employees IS NULL)
                                  ) THEN 1 
                                ELSE 0 
                            END AS is_ld_assigned,
                            CASE 
                                WHEN ce.status != 'Completed' 
                                 AND COALESCE(ce.progress_percentage, 0.0) < 100.0 
                                 AND ac.target_completion_date IS NOT NULL 
                                 AND ac.target_completion_date < date('now') 
                                THEN 1 ELSE 0 
                            END AS is_overdue
                        FROM lms_course_enrollments ce
                        LEFT JOIN (
                            SELECT course_id, selected_employees, target_completion_date
                            FROM lms_assign_course
                            GROUP BY course_id
                        ) ac ON ac.course_id = ce.course_id
                          AND (instr(ac.selected_employees, ce.employee_id) > 0 OR ac.selected_employees IS NULL)
                        WHERE ce.status NOT IN ('Pending', 'On Hold', 'Rejected')
                          AND NOT EXISTS (
                              SELECT 1 FROM lms_enrollment_requests er
                              WHERE er.employee_id = ce.employee_id
                                AND er.course_id = ce.course_id
                                AND er.status IN ('Pending', 'On Hold', 'Rejected')
                          )
                    )
                    SELECT 
                        COUNT(*) AS total_tracked,
                        SUM(CASE WHEN is_ld_assigned = 1 AND status != 'Completed' AND progress < 100.0 THEN 1 ELSE 0 END) AS assigned,
                        SUM(CASE WHEN status = 'Completed' OR progress >= 100.0 THEN 1 ELSE 0 END) AS completed,
                        SUM(CASE WHEN ((status = 'In Progress' OR progress > 0.0) OR is_overdue = 1) AND status != 'Completed' AND progress < 100.0 THEN 1 ELSE 0 END) AS active,
                        SUM(CASE WHEN is_overdue = 1 THEN 1 ELSE 0 END) AS overdue
                    FROM AllEnrollments;
                """)
                agg_row = cursor.fetchone()
                total_tracked = int(agg_row[0] or 0)
                assigned_count = int(agg_row[1] or 0)
                completed_count = int(agg_row[2] or 0)
                active_count = int(agg_row[3] or 0)
                overdue_count = int(agg_row[4] or 0)

                cursor.execute("""
                    WITH AllEnrollments AS (
                        SELECT 
                            ce.employee_id,
                            ce.course_id,
                            ce.status,
                            COALESCE(ce.progress_percentage, 0.0) AS progress,
                            ac.target_completion_date,
                            CASE 
                                WHEN ce.status = 'Assigned' 
                                  OR EXISTS (
                                      SELECT 1 FROM lms_assign_course ac2 
                                      WHERE ac2.course_id = ce.course_id 
                                        AND (instr(ac2.selected_employees, ce.employee_id) > 0 OR ac2.selected_employees IS NULL)
                                  ) THEN 1 
                                ELSE 0 
                            END AS is_ld_assigned,
                            CASE 
                                WHEN ce.status != 'Completed' 
                                 AND COALESCE(ce.progress_percentage, 0.0) < 100.0 
                                 AND ac.target_completion_date IS NOT NULL 
                                 AND ac.target_completion_date < date('now') 
                                THEN 1 ELSE 0 
                            END AS is_overdue
                        FROM lms_course_enrollments ce
                        LEFT JOIN (
                            SELECT course_id, selected_employees, target_completion_date
                            FROM lms_assign_course
                            GROUP BY course_id
                        ) ac ON ac.course_id = ce.course_id
                          AND (instr(ac.selected_employees, ce.employee_id) > 0 OR ac.selected_employees IS NULL)
                        WHERE ce.status NOT IN ('Pending', 'On Hold', 'Rejected')
                          AND NOT EXISTS (
                              SELECT 1 FROM lms_enrollment_requests er
                              WHERE er.employee_id = ce.employee_id
                                AND er.course_id = ce.course_id
                                AND er.status IN ('Pending', 'On Hold', 'Rejected')
                          )
                    )
                    SELECT 
                        employee_id,
                        SUM(CASE WHEN is_ld_assigned = 1 AND status != 'Completed' AND progress < 100.0 THEN 1 ELSE 0 END) AS assigned,
                        SUM(CASE WHEN status = 'Completed' OR progress >= 100.0 THEN 1 ELSE 0 END) AS completed,
                        SUM(CASE WHEN ((status = 'In Progress' OR progress > 0.0) OR is_overdue = 1) AND status != 'Completed' AND progress < 100.0 THEN 1 ELSE 0 END) AS active,
                        SUM(CASE WHEN is_overdue = 1 THEN 1 ELSE 0 END) AS overdue
                    FROM AllEnrollments
                    GROUP BY employee_id;
                """)
                m_rows = cursor.fetchall()

                cursor.execute("""
                    SELECT 
                        ce.employee_id,
                        c.course_name,
                        COALESCE(ce.progress_percentage, 0.0) AS progress,
                        ac.target_completion_date,
                        CAST(julianday('now') - julianday(ac.target_completion_date) AS INTEGER) AS days_overdue
                    FROM lms_course_enrollments ce
                    LEFT JOIN lms_courses c ON c.id = ce.course_id
                    LEFT JOIN (
                        SELECT course_id, selected_employees, target_completion_date
                        FROM lms_assign_course
                        GROUP BY course_id
                    ) ac ON ac.course_id = ce.course_id
                      AND (instr(ac.selected_employees, ce.employee_id) > 0 OR ac.selected_employees IS NULL)
                    WHERE ce.status NOT IN ('Pending', 'On Hold', 'Rejected')
                      AND ce.status != 'Completed'
                      AND COALESCE(ce.progress_percentage, 0.0) < 100.0
                      AND ac.target_completion_date IS NOT NULL
                      AND ac.target_completion_date < date('now')
                      AND NOT EXISTS (
                          SELECT 1 FROM lms_enrollment_requests er
                          WHERE er.employee_id = ce.employee_id
                            AND er.course_id = ce.course_id
                            AND er.status IN ('Pending', 'On Hold', 'Rejected')
                      )
                      AND (
                          ce.status = 'Assigned'
                          OR EXISTS (
                              SELECT 1 FROM lms_assign_course ac2
                              WHERE ac2.course_id = ce.course_id
                                AND (instr(ac2.selected_employees, ce.employee_id) > 0 OR ac2.selected_employees IS NULL)
                          )
                      )
                """)
                od_rows = cursor.fetchall()

            assigned_bd = [{"employee_id": r[0], "name": name_map.get(r[0], r[0]), "count": int(r[1])} for r in m_rows if r[1] > 0]
            completed_bd = [{"employee_id": r[0], "name": name_map.get(r[0], r[0]), "count": int(r[2])} for r in m_rows if r[2] > 0]
            active_bd = [{"employee_id": r[0], "name": name_map.get(r[0], r[0]), "count": int(r[3])} for r in m_rows if r[3] > 0]
            overdue_bd = [{"employee_id": r[0], "name": name_map.get(r[0], r[0]), "count": int(r[4])} for r in m_rows if r[4] > 0]

            overdue_details = [
                {
                    "employee_id": r[0],
                    "name": name_map.get(r[0], r[0]),
                    "course_name": r[1] or "Course",
                    "progress_percentage": round(float(r[2] or 0), 1),
                    "target_completion_date": str(r[3]) if r[3] else None,
                    "days_overdue": max(1, int(r[4] or 0))
                }
                for r in od_rows
            ]

            if total_tracked > 0:
                assigned_pct = min(100, round((assigned_count / total_tracked) * 100))
                completed_pct = min(100, round((completed_count / total_tracked) * 100))
                active_pct = min(100, round((active_count / total_tracked) * 100))
                overdue_pct = min(100, round((overdue_count / total_tracked) * 100))
            else:
                assigned_pct = completed_pct = active_pct = overdue_pct = 0

            courses_data = [
                {"id": 1, "label": "Assigned Courses", "value": assigned_count, "color": "#2667F9", "pct": assigned_pct},
                {"id": 2, "label": "Completed Courses", "value": completed_count, "color": "#31C27E", "pct": completed_pct},
                {"id": 3, "label": "Active Courses", "value": active_count, "color": "#9E5DF9", "pct": active_pct},
                {"id": 4, "label": "Overdue Courses", "value": overdue_count, "color": "#FE7356", "pct": overdue_pct},
            ]

            # 5. Monthly learning hours trends for rolling 6 months
            if is_sql_server():
                cursor.execute("""
                    SELECT 
                        YEAR(created_at) AS yr,
                        MONTH(created_at) AS mo,
                        ROUND(SUM(CAST(video_duration_minutes + practice_duration_minutes AS FLOAT)) / 60.0, 0) AS total_hours
                    FROM dbo.lms_learning_logs
                    GROUP BY YEAR(created_at), MONTH(created_at)
                """)
            else:
                cursor.execute("""
                    SELECT 
                        CAST(strftime('%Y', created_at) AS INTEGER) AS yr,
                        CAST(strftime('%m', created_at) AS INTEGER) AS mo,
                        ROUND(SUM(CAST(COALESCE(video_duration_minutes, 0) + COALESCE(practice_duration_minutes, 0) AS FLOAT)) / 60.0, 0) AS total_hours
                    FROM lms_learning_logs
                    GROUP BY strftime('%Y', created_at), strftime('%m', created_at)
                """)
            logs = dictfetchall(cursor)

            month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
            now = datetime.now()
            monthly_trends = []
            for i in range(5, -1, -1):
                target_month = now.month - i
                target_year = now.year
                while target_month <= 0:
                    target_month += 12
                    target_year -= 1

                m_name = month_names[target_month - 1]
                match = next((r for r in logs if int(r.get("yr", 0)) == target_year and int(r.get("mo", 0)) == target_month), None)
                hours_val = int(match.get("total_hours") or 0) if match else 0
                monthly_trends.append({"month": m_name, "hours": hours_val, "isCurrent": (i == 0)})

            # 6. Overview Metrics for Employee Records Overview Card
            # - Total Employees
            cursor.execute(f"SELECT COUNT(*) FROM {tbl}lms_employee_profiles")
            row = cursor.fetchone()
            total_employees = int(row[0]) if row and row[0] is not None else 0

            # - Active Learners (distinct employees with active / in progress course)
            cursor.execute(f"""
                SELECT COUNT(DISTINCT employee_id) 
                FROM {tbl}lms_course_enrollments 
                WHERE (LOWER(status) IN ('in progress', 'active') OR (progress_percentage > 0 AND progress_percentage < 100))
                  AND LOWER(status) != 'completed'
            """)
            row = cursor.fetchone()
            active_learners_count = int(row[0]) if row and row[0] is not None else 0

            # - Learning Average Hours (calculated as: Total Learning Hours / Number of Months of Learning Logs)
            if is_sql_server():
                cursor.execute(f"""
                    SELECT 
                        COALESCE(SUM(video_duration_minutes), 0) AS vid_mins,
                        COALESCE(SUM(practice_duration_minutes), 0) AS prac_mins,
                        COUNT(DISTINCT (YEAR(created_at) * 100 + MONTH(created_at))) AS active_months_count
                    FROM {tbl}lms_learning_logs
                """)
            else:
                cursor.execute(f"""
                    SELECT 
                        COALESCE(SUM(video_duration_minutes), 0) AS vid_mins,
                        COALESCE(SUM(practice_duration_minutes), 0) AS prac_mins,
                        COUNT(DISTINCT (strftime('%Y', created_at) || strftime('%m', created_at))) AS active_months_count
                    FROM {tbl}lms_learning_logs
                """)
            h_row = cursor.fetchone()
            video_mins = int(h_row[0]) if h_row and h_row[0] is not None else 0
            practice_mins = int(h_row[1]) if h_row and h_row[1] is not None else 0
            active_months_count = int(h_row[2]) if h_row and h_row[2] is not None else 0
            total_mins = video_mins + practice_mins

            tot_hours_float = total_mins / 60.0
            tot_h = int(round(tot_hours_float))
            vid_h = int(round(video_mins / 60.0))
            prac_h = int(round(practice_mins / 60.0))

            months_divisor = max(1, active_months_count)
            avg_monthly_hours_float = round(tot_hours_float / float(months_divisor), 1) if active_months_count > 0 else 0.0
            avg_monthly_hours_str = f"{int(avg_monthly_hours_float) if avg_monthly_hours_float.is_integer() else avg_monthly_hours_float}h"

            total_learning_hours = f"{tot_h}h"
            video_learning_hours = f"{vid_h}h"
            practice_learning_hours = f"{prac_h}h"

            # - Certifications Earned (only certifications, excluding course completion certificates)
            cursor.execute(f"""
                SELECT COUNT(*) 
                FROM {tbl}lms_employee_certificates
                WHERE LOWER(COALESCE(certificate_type, '')) NOT LIKE '%course completion%'
                  AND LOWER(COALESCE(certificate_type, '')) NOT LIKE '%course certificate%'
            """)
            row = cursor.fetchone()
            course_certs_count = int(row[0]) if row and row[0] is not None else 0

            # - Pending Claims (from dbo.lms_reimbursement_claims)
            cursor.execute(f"SELECT COUNT(*) FROM {tbl}lms_reimbursement_claims WHERE LOWER(status) = 'pending'")
            row = cursor.fetchone()
            pending_claims_count = int(row[0]) if row and row[0] is not None else 0

            # - Approved Claims (from dbo.lms_reimbursement_claims)
            cursor.execute(f"SELECT COUNT(*) FROM {tbl}lms_reimbursement_claims WHERE LOWER(status) = 'approved'")
            row = cursor.fetchone()
            approved_claims_count = int(row[0]) if row and row[0] is not None else 0

            overview_data = {
                "total_employees": total_employees,
                "active_learners": active_learners_count,
                "learning_hours": avg_monthly_hours_str,
                "avg_learning_hours": avg_monthly_hours_str,
                "total_learning_hours": total_learning_hours,
                "learning_months_count": active_months_count,
                "video_learning_hours": video_learning_hours,
                "practice_learning_hours": practice_learning_hours,
                "video_learning_mins": video_mins,
                "practice_learning_mins": practice_mins,
                "total_learning_mins": total_mins,
                "certificates_earned": course_certs_count,
                "pending_claims": pending_claims_count,
                "approved_claims": approved_claims_count,
                "details": {
                    "hours_breakdown": {
                        "video_hours": vid_h,
                        "practice_hours": prac_h,
                        "total_hours": tot_h,
                        "avg_monthly_hours": avg_monthly_hours_float,
                        "months_calculated": active_months_count,
                    }
                }
            }

            return {
                "overview": overview_data,
                "courses_data": courses_data,
                "total_courses": total_tracked,
                "assigned_breakdown": assigned_bd,
                "completed_breakdown": completed_bd,
                "active_breakdown": active_bd,
                "overdue_breakdown": overdue_bd,
                "overdue_details": overdue_details,
                "monthly_trends": monthly_trends,
                "summary": {
                    "assigned_courses": assigned_count,
                    "completed_courses": completed_count,
                    "active_courses": active_count,
                    "overdue_courses": overdue_count
                }
            }
        finally:
            conn.close()

course_service = CourseService()

