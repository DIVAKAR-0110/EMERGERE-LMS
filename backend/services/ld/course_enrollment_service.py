"""
Course Enrollment Service.
Handles business logic, validations, maximum 4-member license limits,
and transaction commitments for enrollment requests and notifications.
"""

import datetime
import re
from typing import List, Dict, Any, Optional
from fastapi import HTTPException, status
from database.connection import connect_db
from repositories.ld import course_enrollment_repository as repo
from repositories.ld import course_repository
from models.employee.course_enrollment import EnrollmentRequestCreate
from models.ld.approvals_workflow import EnrollmentHoldRequest
from services.common.auth_service import employee_service

class CourseEnrollmentService:
    def _resolve_manager_team(self, current_user: Any) -> tuple[str, List[Dict[str, Any]]]:
        """Resolves reporting manager employee_id and direct reports from live directory."""
        target_id = ""
        mgr_name = ""
        if isinstance(current_user, dict):
            target_id = str(
                current_user.get("employee_id")
                or current_user.get("id")
                or current_user.get("user_id")
                or ""
            ).strip()
            mgr_name = str(current_user.get("name") or current_user.get("full_name") or "").strip()
        elif isinstance(current_user, str):
            target_id = current_user.strip()

        team_members = employee_service.get_team_members(target_id) if target_id else []
        if not team_members and mgr_name:
            team_members = employee_service.get_team_members(mgr_name)
        return target_id, (team_members or [])

    def create_request(
        self,
        data: EnrollmentRequestCreate,
        current_user: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Creates a new course enrollment request with status 'Pending' and code ENR-YYYY-0001.
        """
        conn = connect_db()
        cursor = conn.cursor()
        try:
            # 1. Verify Course Exists
            course = course_repository.get_course_by_id(cursor, data.course_id)
            if not course:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Course with ID {data.course_id} not found."
                )

            # 2. Determine Employee Identity from authenticated user / payload (no hardcoded defaults)
            emp_id = data.employee_id
            emp_name = data.employee_name
            emp_email = data.employee_email
            emp_role = data.employee_role

            if current_user:
                emp_id = emp_id or current_user.get("employee_id") or current_user.get("Emp_Obj_Id")
                emp_name = emp_name or current_user.get("name") or current_user.get("full_name")
                emp_email = emp_email or current_user.get("email") or current_user.get("work_email")
                emp_role = emp_role or current_user.get("role") or current_user.get("job_title")

            if not emp_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authenticated user employee_id is required.",
                )

            emp_profile = employee_service.get_employee_by_id(emp_id) or {}
            emp_name = emp_name or emp_profile.get("name") or emp_id
            emp_email = emp_email or emp_profile.get("work_email") or emp_profile.get("email")
            emp_role = emp_role or emp_profile.get("department") or emp_profile.get("role") or "Employee"

            # 4. Check for Existing Active Request
            existing_map = repo.get_employee_enrollment_status_map(cursor, emp_id)
            if data.course_id in existing_map:
                prev_status = existing_map[data.course_id]
                if prev_status in ("Approved", "Not Started", "In Progress", "Completed"):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="You are already enrolled and assigned to this course."
                    )
                elif prev_status == "Pending":
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="You already have a pending enrollment request for this course."
                    )

            # 5. Generate Request ID: ENR-YYYY-0001
            request_id = repo.generate_request_id(cursor)

            # 6. Insert Request
            enrollment_id = repo.insert_enrollment(
                cursor=cursor,
                request_id=request_id,
                course_id=data.course_id,
                employee_id=emp_id,
                employee_name=emp_name,
                employee_email=emp_email,
                employee_role=emp_role,
                created_by=emp_id
            )

            # 7. Notify Reporting Manager of new enrollment request (only if resolved)
            try:
                rm_id = employee_service.get_reporting_manager_id(emp_id)
                if rm_id and rm_id != emp_id:
                    course_title = course.get("course_title") or "Course"
                    repo.send_notification(
                        cursor,
                        employee_id=rm_id,
                        title=f"Course Request from {emp_name}",
                        message=f"{emp_name} has requested enrollment in '{course_title}'.",
                        notif_type="COURSE_ENROLLMENT_REQUEST",
                        reference_id=enrollment_id
                    )
            except Exception as e:
                print(f"[CourseEnrollment] Warning: Could not send request notification to RM: {e}")

            conn.commit()

            # 8. Return created entity
            return repo.get_enrollment_by_request_id(cursor, request_id)
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def get_all(
        self,
        course_id: Optional[int] = None,
        status: Optional[str] = None,
        search: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Fetches all enrollment requests for L&D table."""
        conn = connect_db()
        cursor = conn.cursor()
        try:
            return repo.get_all_enrollments(cursor, course_id=course_id, status=status, search=search)
        finally:
            conn.close()

    def get_employee_status_map(self, employee_id: str) -> Dict[int, str]:
        """Returns map of { course_id: action_status } for employee."""
        conn = connect_db()
        cursor = conn.cursor()
        try:
            return repo.get_employee_enrollment_status_map(cursor, employee_id)
        finally:
            conn.close()

    def get_employee_status_and_progress_maps(self, employee_id: str):
        """Returns (status_map, progress_map) for employee."""
        conn = connect_db()
        cursor = conn.cursor()
        try:
            return repo.get_employee_enrollment_status_map(cursor, employee_id, with_progress=True)
        finally:
            conn.close()

    def approve_request(
        self,
        request_id: str,
        current_user: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Approves an enrollment request:
        1. Updates action_status to 'Approved'
        2. Assigns course in lms_employee_course table
        3. Sends in-app notification to employee
        """
        conn = connect_db()
        cursor = conn.cursor()
        try:
            existing = repo.get_enrollment_by_request_id(cursor, request_id)
            if not existing:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Enrollment request {request_id} not found."
                )

            # Enforce 4-member limit check
            cid = existing["course_id"]
            approved_count = len(repo.get_approved_employees_for_course(cursor, cid))
            if approved_count >= 4 and existing.get("action_status") != "Approved":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot approve: course license limit of 4 members has already been reached."
                )

            approver_emp_id = (
                (current_user.get("employee_id") or current_user.get("Emp_Obj_Id"))
                if current_user else None
            )
            if not approver_emp_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authenticated user employee_id is required.",
                )

            # Enforce Separation of Duties: L&D user cannot self-approve their own enrollment request
            req_emp_id = str(existing.get("employee_id") or "").strip().upper()
            if approver_emp_id and req_emp_id and str(approver_emp_id).strip().upper() == req_emp_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Self-approval is not permitted. Another L&D team member must review and approve this request."
                )

            # 1. Update status
            repo.update_status_to_approved(cursor, request_id, approved_by=approver_emp_id)

            # 2. Assign to employee course library
            repo.sync_assigned_course(
                cursor,
                employee_id=existing["employee_id"],
                course_id=cid,
                assigned_by=approver_emp_id
            )

            # 3. Create Notification for employee
            course_title = existing.get("course_title") or "Course"
            repo.send_notification(
                cursor,
                employee_id=existing["employee_id"],
                title="Course Enrollment Approved",
                message=f"Your enrollment request for '{course_title}' has been approved by L&D. The course is now assigned to your library.",
                notif_type="COURSE_APPROVED",
                reference_id=existing.get("enrollment_id")
            )

            # 4. Create Notification for Reporting Manager (Approved only, NOT for On Hold)
            try:
                rm_id = employee_service.get_reporting_manager_id(existing["employee_id"])
                if rm_id and rm_id != existing["employee_id"]:
                    emp_name = existing.get("employee_name") or "Employee"
                    repo.send_notification(
                        cursor,
                        employee_id=rm_id,
                        title=f"Course Approved: {emp_name}",
                        message=f"{emp_name}'s enrollment request for '{course_title}' has been approved by L&D and assigned.",
                        notif_type="COURSE_APPROVED",
                        reference_id=existing.get("enrollment_id")
                    )
            except Exception as e:
                print(f"[CourseEnrollment] Warning: Could not send approval notification to RM: {e}")

            conn.commit()
            return repo.get_enrollment_by_request_id(cursor, request_id)
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def hold_request(
        self,
        request_id: str,
        reason: str,
        current_user: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Puts an enrollment request On Hold:
        1. Updates action_status to 'On Hold' with reason
        2. Sends notification to employee with hold reason
        """
        conn = connect_db()
        cursor = conn.cursor()
        try:
            existing = repo.get_enrollment_by_request_id(cursor, request_id)
            if not existing:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Enrollment request {request_id} not found."
                )

            actor_emp_id = (
                (current_user.get("employee_id") or current_user.get("Emp_Obj_Id"))
                if current_user else None
            )
            if not actor_emp_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authenticated user employee_id is required.",
                )

            # Enforce Separation of Duties: L&D user cannot put their own enrollment request on hold
            req_emp_id = str(existing.get("employee_id") or "").strip().upper()
            if actor_emp_id and req_emp_id and str(actor_emp_id).strip().upper() == req_emp_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Self-action is not permitted. Another L&D team member must review this request."
                )

            normalized_reason = re.sub(
                r"\n{2,}",
                "\n",
                re.sub(
                    r" *\n *",
                    "\n",
                    re.sub(
                        r" {2,}",
                        " ",
                        str(reason or "").replace("\r\n", "\n").replace("\r", "\n").replace("\t", " "),
                    ),
                ),
            ).strip()[:250] or "Awaiting additional seat allocation."

            # 1. Update status to On Hold
            repo.update_status_to_on_hold(cursor, request_id, reason=normalized_reason, updated_by=actor_emp_id)

            # 2. Create Notification for employee ONLY (RM does NOT receive notification on hold)
            course_title = existing.get("course_title") or "Course"
            repo.send_notification(
                cursor,
                employee_id=existing["employee_id"],
                title="Course Request Placed On Hold",
                message=f"Your enrollment request for '{course_title}' has been put on hold by L&D. Reason: {normalized_reason}",
                notif_type="COURSE_ON_HOLD",
                reference_id=existing.get("enrollment_id"),
                created_by_profile_id=actor_emp_id
            )

            conn.commit()
            return repo.get_enrollment_by_request_id(cursor, request_id)
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def get_team_progress(self, current_user: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Retrieves live course learning progress for direct reports of the reporting manager.
        """
        from datetime import datetime
        target_id, team_members = self._resolve_manager_team(current_user)

        if not team_members:
            return []

        emp_id_list = [m["employee_id"] for m in team_members if m.get("employee_id")]
        if not emp_id_list:
            return []

        conn = connect_db()
        cursor = conn.cursor()
        try:
            raw_records = repo.get_team_course_progress(cursor, emp_id_list)

            AVATAR_PALETTE = ["#FF7FAE", "#5CDE8A", "#A87FFF", "#FFBC64", "#F97FFF"]
            result = []
            for idx, r in enumerate(raw_records):
                emp_id = r["employee_id"]
                emp_info = employee_service.get_employee_by_id(emp_id) or {}

                emp_name = emp_info.get("name") or emp_info.get("full_name") or emp_id
                department = emp_info.get("department") or emp_info.get("job_title") or emp_info.get("role") or "Engineering"
                designation = department

                initials = repo.get_initials_for_name(emp_name)
                avatar_bg = AVATAR_PALETTE[idx % len(AVATAR_PALETTE)]

                dt_str = r.get("created_at")
                if dt_str:
                    try:
                        dt = datetime.strptime(str(dt_str)[:10], "%Y-%m-%d")
                        formatted_date = dt.strftime("%d %b %Y")
                    except Exception:
                        formatted_date = str(dt_str)[:10]
                else:
                    formatted_date = "01 Jan 2026"

                mins = r.get("hours_log") or 0
                h = mins // 60
                m = mins % 60
                hours_str = f"{h} hrs" if h > 0 and m == 0 else (f"{h}h {m}m" if h > 0 else f"{m} mins")

                prog = round(float(r.get("progress_percentage") or 0.0), 1)
                days = int(r.get("active_days_week") or 0)
                v_min = int(r.get("weekly_video_min") or 0)
                p_min = int(r.get("weekly_practice_min") or 0)
                raw_status = (r.get("status") or "").upper()

                if prog >= 100.0 or raw_status == "COMPLETED":
                    status_clean = "Completed"
                elif prog == 0.0 and days == 0:
                    status_clean = "Not Started"
                elif days >= 5 and v_min >= 60 and p_min >= 60:
                    # Standout elite performance: 5-6+ days active with >1h learning AND >1h practice
                    status_clean = "Excellent"
                elif days in [3, 4] or days >= 5 or (days == 0 and prog >= 50.0):
                    # Usual solid performance: 3-4 days consistent study or steady progress
                    status_clean = "On track"
                else:
                    # 1 or 2 days active in the week, or low effort
                    status_clean = "Low Progress"

                summary_item = {
                    "id": f"prog-{r['id']}",
                    "enrollment_id": r["id"],
                    "employee_id": emp_id,
                    "employeeName": emp_name,
                    "initials": initials,
                    "avatarBg": avatar_bg,
                    "designation": department,
                    "department": department,
                    "course": r.get("course_name") or "Course",
                    "provider": r.get("provider") or "Udemy",
                    "enrollmentDate": formatted_date,
                    "submissionDate": r.get("created_at") or "2026-01-01",
                    "progress": prog,
                    "hoursLogged": hours_str,
                    "activeDaysWeek": days,
                    "weeklyVideoMin": v_min,
                    "weeklyPracticeMin": p_min,
                    "status": status_clean
                }
                result.append(summary_item)

            return result
        finally:
            conn.close()

    def get_all_employees_progress(self) -> List[Dict[str, Any]]:
        """
        Retrieves live course learning progress for all enterprise employees across the organization.
        Used by L&D Learning Records Courses table.
        """
        from datetime import datetime
        all_emps = employee_service.get_all_employees()
        emp_map = {e["employee_id"]: e for e in all_emps if e.get("employee_id")}

        conn = connect_db()
        cursor = conn.cursor()
        try:
            # Query all enrollments without filtering by employee_ids
            raw_records = repo.get_team_course_progress(cursor, employee_ids=None)

            AVATAR_PALETTE = ["#FF7FAE", "#5CDE8A", "#A87FFF", "#FFBC64", "#F97FFF"]
            result = []
            for idx, r in enumerate(raw_records):
                emp_id = r["employee_id"]
                emp_info = emp_map.get(emp_id) or employee_service.get_employee_by_id(emp_id) or {}

                emp_name = emp_info.get("name") or emp_info.get("full_name") or emp_id
                department = emp_info.get("department") or emp_info.get("job_title") or emp_info.get("role") or "Engineering"

                initials = repo.get_initials_for_name(emp_name)
                avatar_bg = AVATAR_PALETTE[idx % len(AVATAR_PALETTE)]

                dt_str = r.get("created_at")
                if dt_str:
                    try:
                        dt = datetime.strptime(str(dt_str)[:10], "%Y-%m-%d")
                        formatted_date = dt.strftime("%d %b %Y")
                    except Exception:
                        formatted_date = str(dt_str)[:10]
                else:
                    formatted_date = "01 Jan 2026"

                mins = r.get("hours_log") or 0
                h = mins // 60
                m = mins % 60
                hours_str = f"{h} hrs" if h > 0 and m == 0 else (f"{h}h {m}m" if h > 0 else f"{m} mins")

                prog = round(float(r.get("progress_percentage") or 0.0), 1)
                days = int(r.get("active_days_week") or 0)
                v_min = int(r.get("weekly_video_min") or 0)
                p_min = int(r.get("weekly_practice_min") or 0)
                raw_status = (r.get("status") or "").upper()

                if prog >= 100.0 or raw_status == "COMPLETED":
                    status_clean = "Completed"
                elif prog == 0.0 and days == 0:
                    status_clean = "Not Started"
                elif days >= 5 and v_min >= 60 and p_min >= 60:
                    status_clean = "Excellent"
                elif days in [3, 4] or days >= 5 or (days == 0 and prog >= 50.0):
                    status_clean = "On track"
                else:
                    status_clean = "Low Progress"

                summary_item = {
                    "id": f"prog-{r['id']}",
                    "enrollment_id": r["id"],
                    "employee_id": emp_id,
                    "employeeName": emp_name,
                    "initials": initials,
                    "avatarBg": avatar_bg,
                    "designation": department,
                    "department": department,
                    "course": r.get("course_name") or "Course",
                    "provider": r.get("provider") or "Udemy",
                    "enrollmentDate": formatted_date,
                    "submissionDate": r.get("created_at") or "2026-01-01",
                    "progress": prog,
                    "hoursLogged": hours_str,
                    "activeDaysWeek": days,
                    "weeklyVideoMin": v_min,
                    "weeklyPracticeMin": p_min,
                    "status": status_clean
                }
                result.append(summary_item)

            return result
        finally:
            conn.close()

    def get_team_dashboard_summary(self, current_user: Any) -> List[Dict[str, Any]]:
        """
        Retrieves aggregated learning metrics for direct reports of the reporting manager.
        Used by Reporting Manager Dashboard TeamMembersCard.jsx.
        """
        target_id, team_members = self._resolve_manager_team(current_user)

        if not team_members:
            return []

        emp_ids = [m["employee_id"].strip() for m in team_members if m.get("employee_id")]
        if not emp_ids:
            return []

        conn = connect_db()
        cursor = conn.cursor()
        try:
            placeholders = ",".join("?" for _ in emp_ids)
            lower_ids = [e.lower() for e in emp_ids]

            # 1. Course enrollments & progress (strictly approved courses)
            q_courses = f"""
                SELECT LOWER(ce.employee_id),
                       COUNT(DISTINCT ce.course_id) as total_courses_count,
                       AVG(CAST(COALESCE(ce.progress_percentage, 0.0) AS FLOAT)) as avg_progress,
                       COUNT(DISTINCT CASE 
                           WHEN ce.status = 'Completed' OR ce.progress_percentage >= 100.0 
                           THEN ce.course_id 
                       END) as completed_courses_count
                FROM dbo.lms_course_enrollments ce
                WHERE LOWER(ce.employee_id) IN ({placeholders})
                  AND ce.status IN ('Not Started', 'Assigned', 'In Progress', 'Completed')
                  AND NOT EXISTS (
                      SELECT 1 FROM dbo.lms_enrollment_requests er
                      WHERE er.employee_id = ce.employee_id
                        AND er.course_id = ce.course_id
                        AND er.status IN ('Pending', 'On Hold', 'Rejected')
                  )
                GROUP BY LOWER(ce.employee_id)
            """
            cursor.execute(q_courses, tuple(lower_ids))
            courses_map = {
                r[0]: {
                    "total_courses": r[1] or 0,
                    "avg_prog": round(float(r[2] or 0.0), 0),
                    "completed_courses": r[3] or 0,
                }
                for r in cursor.fetchall()
            }

            # 1b. Enrolled courses breakdown for Progress Overview Popover
            q_course_details = f"""
                SELECT LOWER(ce.employee_id),
                       ce.course_id,
                       COALESCE(c.course_name, 'Course') as course_name,
                       COALESCE(c.duration_minutes, 160) as duration_minutes,
                       COALESCE(ce.progress_percentage, 0.0) as progress_percentage,
                       ce.status
                FROM dbo.lms_course_enrollments ce
                LEFT JOIN dbo.lms_courses c ON ce.course_id = c.id
                WHERE LOWER(ce.employee_id) IN ({placeholders})
                  AND ce.status IN ('Not Started', 'Assigned', 'In Progress', 'Completed')
                  AND NOT EXISTS (
                      SELECT 1 FROM dbo.lms_enrollment_requests er
                      WHERE er.employee_id = ce.employee_id
                        AND er.course_id = ce.course_id
                        AND er.status IN ('Pending', 'On Hold', 'Rejected')
                  )
                ORDER BY 
                  CASE WHEN ce.status = 'In Progress' THEN 1 
                       WHEN ce.status IN ('Assigned', 'Not Started') THEN 2 
                       ELSE 3 END,
                  ce.progress_percentage DESC
            """
            cursor.execute(q_course_details, tuple(lower_ids))

            def format_dur(m):
                m = max(0, int(m or 0))
                h = m // 60
                mins = m % 60
                if h > 0 and mins > 0:
                    return f"{h}h {mins}m"
                elif h > 0:
                    return f"{h}h"
                else:
                    return f"{mins}m"

            courses_detail_map = {}
            for r in cursor.fetchall():
                eid = r[0]
                cid = r[1]
                cname = r[2]
                dur_m = int(r[3] or 160)
                prog_val = float(r[4] or 0.0)
                c_status = r[5] or "In Progress"

                if c_status == 'Completed' or prog_val >= 100.0:
                    comp_m = dur_m
                elif c_status == 'Not Started' or prog_val == 0.0:
                    comp_m = 0
                else:
                    comp_m = round((prog_val / 100.0) * dur_m)
                    comp_m = min(dur_m, max(0, comp_m))

                rem_m = max(0, dur_m - comp_m)

                c_item = {
                    "courseId": cid,
                    "courseName": cname,
                    "status": c_status,
                    "progress": round(prog_val, 1),
                    "totalDuration": format_dur(dur_m),
                    "completedDuration": format_dur(comp_m),
                    "remainingDuration": format_dur(rem_m),
                    "totalMin": dur_m,
                    "completedMin": comp_m,
                    "remainingMin": rem_m,
                }
                if eid not in courses_detail_map:
                    courses_detail_map[eid] = []
                courses_detail_map[eid].append(c_item)

            # 2. Hours logged for in-progress courses only (strictly exclude completed courses)
            q_hours = f"""
                SELECT LOWER(ll.employee_id),
                       SUM(COALESCE(ll.video_duration_minutes, 0) + COALESCE(ll.practice_duration_minutes, 0)) as total_mins
                FROM dbo.lms_learning_logs ll
                WHERE LOWER(ll.employee_id) IN ({placeholders})
                  AND EXISTS (
                      SELECT 1 FROM dbo.lms_course_enrollments ce
                      WHERE LOWER(ce.employee_id) = LOWER(ll.employee_id)
                        AND ce.course_id = ll.course_id
                        AND ce.status != 'Completed'
                        AND COALESCE(ce.progress_percentage, 0.0) < 100.0
                  )
                GROUP BY LOWER(ll.employee_id)
            """
            cursor.execute(q_hours, tuple(lower_ids))
            hours_map = {
                r[0]: int(r[1] or 0)
                for r in cursor.fetchall()
            }

            # 3. Trailing 7 days activity for Anti-scam status
            q_weekly = f"""
                SELECT LOWER(employee_id),
                       COUNT(DISTINCT CAST(created_at AS DATE)) as active_days_7d,
                       SUM(COALESCE(video_duration_minutes, 0)) as video_min_7d,
                       SUM(COALESCE(practice_duration_minutes, 0)) as practice_min_7d
                FROM dbo.lms_learning_logs
                WHERE LOWER(employee_id) IN ({placeholders})
                  AND created_at >= DATEADD(day, -7, GETDATE())
                GROUP BY LOWER(employee_id)
            """
            cursor.execute(q_weekly, tuple(lower_ids))
            weekly_map = {
                r[0]: {"days": r[1] or 0, "vid": r[2] or 0, "prac": r[3] or 0}
                for r in cursor.fetchall()
            }

            # 4. Certifications (genuine professional only, non-expired)
            q_certs = f"""
                SELECT LOWER(employee_id), COUNT(*) as cert_count
                FROM dbo.lms_employee_certificates
                WHERE LOWER(employee_id) IN ({placeholders})
                  AND LOWER(certificate_type) NOT LIKE '%course completion%'
                  AND (expiry_date IS NULL OR expiry_date >= CAST(GETDATE() AS DATE))
                GROUP BY LOWER(employee_id)
            """
            cursor.execute(q_certs, tuple(lower_ids))
            certs_map = {
                r[0]: r[1] or 0
                for r in cursor.fetchall()
            }

            AVATAR_PALETTE = ["#FF7FAE", "#5CDE8A", "#A87FFF", "#FFBC64", "#F97FFF"]
            summary_list = []

            for idx, m in enumerate(team_members):
                raw_eid = m.get("employee_id") or ""
                lower_eid = raw_eid.strip().lower()
                c_info = courses_map.get(lower_eid, {"total_courses": 0, "avg_prog": 0.0, "completed_courses": 0})
                hrs = hours_map.get(lower_eid, 0.0)
                w_info = weekly_map.get(lower_eid, {"days": 0, "vid": 0, "prac": 0})
                certs = certs_map.get(lower_eid, 0)

                raw_name = m.get("name") or m.get("full_name") or f"Employee {raw_eid}"
                clean_name = raw_name.split("(")[0].strip()
                initials = "".join([w[0] for w in clean_name.split() if w]).upper()[:2] or "EM"
                avatar_bg = AVATAR_PALETTE[idx % len(AVATAR_PALETTE)]
                dept = m.get("department") or "Engineering"

                avg_p = c_info["avg_prog"]
                days = w_info["days"]
                v_min = w_info["vid"]
                p_min = w_info["prac"]
                tot_courses = c_info["total_courses"]
                tot_mins = hours_map.get(lower_eid, 0)
                tot_h = tot_mins // 60
                tot_m = tot_mins % 60
                hrs_str = f"{tot_h}h {tot_m}m" if tot_m > 0 else f"{tot_h}h"

                # Status calculation (differentiating non-learners as InActive)
                if tot_courses == 0:
                    status_text = "InActive"
                    status_type = "inactive"
                    is_inactive = True
                    hours_display = "—"
                    progress_val = None
                    courses_display = "—"
                    certs_display = "—" if certs == 0 else certs
                else:
                    is_inactive = False
                    hours_display = hrs_str
                    progress_val = int(avg_p)
                    courses_display = c_info["completed_courses"]
                    certs_display = certs
                    if avg_p >= 100.0:
                        status_text = "Completed"
                        status_type = "completed"
                    elif days >= 5 and v_min >= 60 and p_min >= 60:
                        status_text = "Excellent"
                        status_type = "excellent"
                    elif days in [3, 4] or (days >= 5 and (v_min < 60 or p_min < 60)) or (days == 0 and avg_p >= 50.0):
                        status_text = "On track"
                        status_type = "on_track"
                    elif days in [1, 2]:
                        status_text = "Low Progress"
                        status_type = "needs_attention"
                    else:
                        status_text = "Not Started" if avg_p == 0 else "Needs attention"
                        status_type = "needs_attention"

                summary_list.append({
                    "id": idx + 1,
                    "employeeId": raw_eid,
                    "employee_id": raw_eid,
                    "name": clean_name,
                    "initials": initials,
                    "avatarBg": avatar_bg,
                    "role": dept,
                    "department": dept,
                    "courses": courses_display,
                    "completedCourses": c_info["completed_courses"],
                    "totalCourses": tot_courses,
                    "coursesList": courses_detail_map.get(lower_eid, []),
                    "progressPct": progress_val,
                    "hours": hours_display,
                    "certifications": certs_display,
                    "status": status_text,
                    "statusType": status_type,
                    "isInactive": is_inactive
                })

            # Display all direct reports (including InActive non-learning members)
            for i, m in enumerate(summary_list):
                m["id"] = i + 1

            return summary_list
        finally:
            conn.close()

    def get_overall_progress(
        self,
        current_user: Any,
        employee_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Calculates employee's overall progress and retrieves 1-3 most recently learned courses."""
        conn = connect_db()
        cursor = conn.cursor()
        try:
            target_emp = employee_id
            if not target_emp:
                if isinstance(current_user, dict):
                    target_emp = current_user.get("employee_id") or current_user.get("Emp_Obj_Id") or current_user.get("id")
                elif isinstance(current_user, str):
                    target_emp = current_user
            if not target_emp:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authenticated user employee_id is required.",
                )

            return repo.get_employee_overall_progress_data(cursor, str(target_emp).strip())
        finally:
            conn.close()

    def get_company_learning_completion_stats(self) -> Dict[str, Any]:
        """Calculates company-wide learning completion stats and distribution across all employees."""
        conn = connect_db()
        cursor = conn.cursor()
        try:
            raw = repo.get_company_learning_completion_metrics(cursor)
            total = raw.get("total_enrollments", 0)

            if total > 0:
                completed_pct = int(round((raw.get("completed_count", 0) / total) * 100))
                in_progress_pct = int(round((raw.get("in_progress_count", 0) / total) * 100))
                not_started_pct = max(0, 100 - (completed_pct + in_progress_pct))
                overall_progress = int(round(raw.get("avg_progress", 0.0)))
            else:
                completed_pct = 0
                in_progress_pct = 0
                not_started_pct = 0
                overall_progress = 0

            return {
                "overall": overall_progress,
                "completed": completed_pct,
                "inProgress": in_progress_pct,
                "notStarted": not_started_pct,
                "trendVsLastMonth": raw.get("trend_pct", 0),
                "trendDirection": raw.get("trend_direction", "up"),
                "totalEnrollments": total,
                "activeLearners": raw.get("active_learners", 0),
                "activeInProgressLearners": raw.get("active_learners", 0),
                "totalEnrolledEmployees": raw.get("total_enrolled_employees", 0)
            }
        finally:
            conn.close()

    def get_all_raw_enrollments(self) -> List[Dict[str, Any]]:
        """Returns all enrollments from dbo.lms_course_enrollments for KPI and mapping."""
        conn = connect_db()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                SELECT 
                    ce.id,
                    ce.enrollment_code,
                    ce.employee_id,
                    ce.course_id,
                    ce.status,
                    CAST(COALESCE(ce.progress_percentage, 0.0) AS FLOAT) AS progress_percentage,
                    ce.created_at
                FROM dbo.lms_course_enrollments ce
            """)
            from database.connection import dictfetchall
            return dictfetchall(cursor)
        finally:
            conn.close()

    def get_team_top_performing_courses(self, current_user: Any, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Retrieves top performing courses exclusively for direct reports of the reporting manager.
        Sorted by highest number of enrolled team members, with progress calculated as the ratio
        of total employees enrolled for each course relative to the maximum employees enrolled for a single course.
        """
        target_id, team_members = self._resolve_manager_team(current_user)

        if not team_members:
            return []

        # Strictly include only direct team members (exclude manager themselves)
        mgr_id_clean = (target_id or "").strip().lower()
        emp_ids = [
            m["employee_id"].strip()
            for m in team_members
            if m.get("employee_id") and m["employee_id"].strip().lower() != mgr_id_clean
        ]
        if emp_ids:
            placeholders = ",".join("?" for _ in emp_ids)
            lower_ids = [e.lower() for e in emp_ids]
            emp_filter = f"LOWER(ce.employee_id) IN ({placeholders}) AND "
            params = tuple(lower_ids)
        else:
            emp_filter = ""
            params = ()

        conn = connect_db()
        cursor = conn.cursor()
        try:
            q = f"""
                SELECT TOP {limit}
                    c.id,
                    c.course_name,
                    COALESCE(cc.CategoryName, 'General') AS category,
                    COUNT(DISTINCT ce.employee_id) AS enrolled_count,
                    COUNT(DISTINCT CASE WHEN ce.status = 'Completed' OR ce.progress_percentage >= 100 THEN ce.employee_id END) AS completed_count,
                    ROUND((CAST(COUNT(DISTINCT CASE WHEN ce.status = 'Completed' OR ce.progress_percentage >= 100 THEN ce.employee_id END) AS FLOAT) * 100.0) / NULLIF(COUNT(DISTINCT ce.employee_id), 0), 2) AS completion_rate,
                    ROUND(AVG(CAST(COALESCE(ce.progress_percentage, 0.0) AS FLOAT)), 1) AS avg_progress
                FROM dbo.lms_course_enrollments ce
                JOIN dbo.lms_courses c ON ce.course_id = c.id
                LEFT JOIN dbo.CourseCategories cc ON c.category_id = cc.CategoryId
                WHERE {emp_filter}ce.status IN ('Not Started', 'In Progress', 'Completed')
                  AND NOT EXISTS (
                      SELECT 1 FROM dbo.lms_enrollment_requests er
                      WHERE er.employee_id = ce.employee_id
                        AND er.course_id = ce.course_id
                        AND er.status IN ('Pending', 'On Hold', 'Rejected')
                  )
                GROUP BY c.id, c.course_name, cc.CategoryName
                HAVING COUNT(DISTINCT ce.employee_id) > 0
                ORDER BY enrolled_count DESC, avg_progress DESC, completed_count DESC, c.course_name ASC
            """
            cursor.execute(q, params)
            rows = cursor.fetchall()

            COURSE_PALETTE = ["#2667F9", "#31C27E", "#9E5DF9", "#FDAD33", "#2BC3F3"]
            max_enrolled = max([int(r[3] or 0) for r in rows], default=1)
            if max_enrolled <= 0:
                max_enrolled = 1

            result = []
            for idx, r in enumerate(rows):
                cid, cname, category, enrolled, completed, comp_rate, avg_prog = r
                comp_rate_float = round(float(comp_rate or 0.0), 2)
                comp_rate_int = int(round(comp_rate_float))
                avg_prog_float = round(float(avg_prog or 0.0), 1)
                avg_prog_int = int(round(avg_prog_float))
                enrolled_int = int(enrolled or 0)
                completed_int = int(completed or 0)
                enrollment_progress = int(round((enrolled_int / max_enrolled) * 100)) if max_enrolled > 0 else 0
                count_str = f"{enrolled_int:02d}"
                color = COURSE_PALETTE[idx % len(COURSE_PALETTE)]

                result.append({
                    "id": cid,
                    "course_id": cid,
                    "courseId": cid,
                    "rank": idx + 1,
                    "course_name": cname,
                    "title": cname,
                    "courseTitle": cname,
                    "category": category,
                    "enrolled_count": enrolled_int,
                    "enrolledCount": enrolled_int,
                    "max_enrolled_count": max_enrolled,
                    "maxEnrolledCount": max_enrolled,
                    "completed_count": completed_int,
                    "completedCount": completed_int,
                    "completion_rate": comp_rate_float,
                    "completionRate": comp_rate_int,
                    "progress": avg_prog_int,
                    "learning_progress": avg_prog_int,
                    "learningProgress": avg_prog_int,
                    "enrollment_progress": enrollment_progress,
                    "enrollmentProgress": enrollment_progress,
                    "avg_progress": avg_prog_float,
                    "avgProgress": avg_prog_int,
                    "count": count_str,
                    "color": color
                })

            return result
        finally:
            conn.close()

    def get_team_learning_progress_stats(self, current_user: Any) -> Dict[str, Any]:
        """
        Retrieves learning progress statistics (Completed %, In Progress %, Not Started %, Overall %)
        exclusively for direct reports of the reporting manager.
        Used by Reports & Analytics TeamLearningProgressCard.jsx.
        """
        target_id, team_members = self._resolve_manager_team(current_user)

        if not team_members:
            return {
                "overall_progress": 0,
                "completed_pct": 0,
                "in_progress_pct": 0,
                "not_started_pct": 0,
                "completed_count": 0,
                "in_progress_count": 0,
                "not_started_count": 0,
                "total_enrollments": 0,
                "trend_pct": 0,
                "trend_direction": "neutral"
            }

        emp_ids = [m["employee_id"].strip() for m in team_members if m.get("employee_id")]
        if not emp_ids:
            return {
                "overall_progress": 0,
                "completed_pct": 0,
                "in_progress_pct": 0,
                "not_started_pct": 0,
                "completed_count": 0,
                "in_progress_count": 0,
                "not_started_count": 0,
                "total_enrollments": 0,
                "trend_pct": 0,
                "trend_direction": "neutral"
            }

        conn = connect_db()
        cursor = conn.cursor()
        try:
            placeholders = ",".join("?" for _ in emp_ids)
            lower_ids = [e.lower() for e in emp_ids]

            # 1. Team enrollments breakdown with Overdue isolation (Unified Learning Progress)
            q = f"""
                WITH EvaluatedCourses AS (
                    SELECT 
                        ce.employee_id,
                        ce.course_id,
                        ce.status,
                        COALESCE(ce.progress_percentage, 0.0) AS progress,
                        ac.target_completion_date,
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
                    WHERE LOWER(ce.employee_id) IN ({placeholders})
                      AND ce.status NOT IN ('Pending', 'On Hold', 'Rejected')
                      AND NOT EXISTS (
                          SELECT 1 FROM dbo.lms_enrollment_requests er
                          WHERE er.employee_id = ce.employee_id
                            AND er.course_id = ce.course_id
                            AND er.status IN ('Pending', 'On Hold', 'Rejected')
                      )
                )
                SELECT 
                    COUNT(*) AS total_tracked,
                    SUM(CASE WHEN status = 'Completed' OR progress >= 100.0 THEN 1 ELSE 0 END) AS completed_count,
                    SUM(CASE WHEN is_overdue = 1 THEN 1 ELSE 0 END) AS overdue_count,
                    SUM(CASE WHEN ((status = 'In Progress' OR progress > 0.0) OR is_overdue = 1) AND status != 'Completed' AND progress < 100.0 THEN 1 ELSE 0 END) AS in_progress_with_overdue_count,
                    SUM(CASE WHEN is_overdue = 0 AND (status = 'In Progress' OR progress > 0.0) AND progress < 100.0 AND status != 'Completed' THEN 1 ELSE 0 END) AS in_progress_ontrack_count,
                    SUM(CASE WHEN is_overdue = 0 AND (status IN ('Not Started', 'Assigned') OR progress = 0.0) AND status != 'Completed' AND progress = 0.0 AND status != 'In Progress' THEN 1 ELSE 0 END) AS not_started_count,
                    AVG(CAST(progress AS FLOAT)) AS avg_progress,
                    AVG(CASE WHEN is_overdue = 1 THEN CAST(progress AS FLOAT) ELSE NULL END) AS overdue_avg_progress
                FROM EvaluatedCourses;
            """
            cursor.execute(q, tuple(lower_ids))
            row = cursor.fetchone()

            total = row[0] or 0
            completed = row[1] or 0
            overdue = row[2] or 0
            in_prog_total = row[3] or 0
            in_prog_ontrack = row[4] or 0
            not_started = row[5] or 0
            avg_p = int(round(float(row[6] or 0.0)))
            overdue_avg_p = round(float(row[7] or 0.0), 1)

            if total > 0:
                c_pct = int(round((completed / total) * 100))
                ns_pct = int(round((not_started / total) * 100))
                ip_pct = max(0, 100 - (c_pct + ns_pct))
                od_pct = int(round((overdue / total) * 100))
            else:
                c_pct, ip_pct, od_pct, ns_pct = 0, 0, 0, 0

            # 2. Team Learning Progress trend vs prior calendar month (Option A: Progress Gain)
            trend_val = 0
            trend_dir = "neutral"
            try:
                # Query current calendar month learning logs and prior calendar month study minutes
                cursor.execute(f"""
                    SELECT 
                        -- Current calendar month study minutes
                        SUM(CASE 
                            WHEN YEAR(created_at) = YEAR(GETDATE()) AND MONTH(created_at) = MONTH(GETDATE()) 
                            THEN (COALESCE(video_duration_minutes, 0) + COALESCE(practice_duration_minutes, 0)) 
                            ELSE 0 
                        END) AS cur_month_mins,
                        -- Prior calendar month study minutes
                        SUM(CASE 
                            WHEN (MONTH(GETDATE()) = 1 AND YEAR(created_at) = YEAR(GETDATE()) - 1 AND MONTH(created_at) = 12)
                              OR (MONTH(GETDATE()) > 1 AND YEAR(created_at) = YEAR(GETDATE()) AND MONTH(created_at) = MONTH(GETDATE()) - 1)
                            THEN (COALESCE(video_duration_minutes, 0) + COALESCE(practice_duration_minutes, 0)) 
                            ELSE 0 
                        END) AS prior_month_mins
                    FROM dbo.lms_learning_logs
                    WHERE LOWER(employee_id) IN ({placeholders})
                """, tuple(lower_ids))
                t_row = cursor.fetchone()
                cur_m = t_row[0] or 0 if t_row else 0
                pri_m = t_row[1] or 0 if t_row else 0

                # Compute overall progress gained across all tracked courses in current month
                # Standard average course duration in LMS is ~300 mins (5 hours).
                # Progress gain = (cur_month_mins / avg_duration_mins * 100) / total_tracked_courses
                if cur_m > 0 and total > 0:
                    prog_gain = (float(cur_m) / (300.0 * float(total))) * 100.0
                    trend_val = max(1, int(round(prog_gain)))
                    trend_dir = "up"
                elif cur_m == 0 and pri_m > 0:
                    trend_val = 0
                    trend_dir = "neutral"
                else:
                    trend_val = 0
                    trend_dir = "neutral"
            except Exception:
                trend_val = 0
                trend_dir = "neutral"

            return {
                "overall_progress": avg_p,
                "completed_pct": c_pct,
                "in_progress_pct": ip_pct,
                "not_started_pct": ns_pct,
                "overdue_pct": od_pct,
                "completed_count": completed,
                "in_progress_count": in_prog_total,
                "in_progress_ontrack_count": in_prog_ontrack,
                "not_started_count": not_started,
                "overdue_count": overdue,
                "overdue_avg_progress": overdue_avg_p,
                "total_enrollments": total,
                "trend_pct": trend_val,
                "trend_direction": trend_dir
            }
        finally:
            conn.close()

    def get_team_kpi_stats(self, current_user: Any) -> Dict[str, Any]:
        """Calculates dynamic KPI stats for reporting manager team (direct reports only)."""
        target_id, team_members = self._resolve_manager_team(current_user)

        if not team_members:
            return {
                "team_members": 0,
                "active_learners": 0,
                "avg_hours_week": "0.0h",
                "certificates_earned": 0,
            }

        team_ids = [m["employee_id"] for m in team_members if m.get("employee_id")]
        placeholders = ", ".join(["?"] * len(team_ids))

        conn = connect_db()
        cursor = conn.cursor()
        try:
            # 1. Active Learners (courses approved by L&D and in progress)
            cursor.execute(f"""
                SELECT COUNT(DISTINCT ce.employee_id)
                FROM dbo.lms_course_enrollments ce
                WHERE ce.employee_id IN ({placeholders})
                  AND LOWER(ce.status) IN ('in progress', 'active')
                  AND NOT EXISTS (
                      SELECT 1 FROM dbo.lms_enrollment_requests er
                      WHERE er.employee_id = ce.employee_id
                        AND er.course_id = ce.course_id
                        AND er.status IN ('Pending', 'On Hold', 'Rejected')
                  )
            """, tuple(team_ids))
            active_learners = cursor.fetchone()[0] or 0

            # 2. Avg. Hours / Week: Monday to Sunday of the current calendar week,
            # calculated as Average Hours per Active Learner who logged learning this week
            now = datetime.datetime.now()
            monday_start = (now - datetime.timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
            monday_str = monday_start.strftime("%Y-%m-%d %H:%M:%S")

            cursor.execute(f"""
                SELECT 
                    COUNT(DISTINCT employee_id) AS active_this_week,
                    COALESCE(SUM(video_duration_minutes + practice_duration_minutes), 0) AS total_min
                FROM dbo.lms_learning_logs
                WHERE employee_id IN ({placeholders})
                  AND created_at >= ?
            """, (*team_ids, monday_str))
            wk_row = cursor.fetchone()
            active_this_week = wk_row[0] or 0
            total_week_min = wk_row[1] or 0
            tot_week_hours = total_week_min / 60.0

            if active_this_week > 0:
                avg_hours_week = round(tot_week_hours / float(active_this_week), 1)
            else:
                avg_hours_week = 0.0

            # 3. Certificates Earned (professional certification only, excluding expired)
            cursor.execute(f"""
                SELECT COUNT(*)
                FROM dbo.lms_employee_certificates
                WHERE employee_id IN ({placeholders})
                  AND LOWER(certificate_type) NOT LIKE '%course completion%'
                  AND (expiry_date IS NULL OR expiry_date >= CAST(GETDATE() AS DATE))
            """, tuple(team_ids))
            certs_count = cursor.fetchone()[0] or 0

            sunday_end = monday_start + datetime.timedelta(days=6)
            week_period_str = f"{monday_start.strftime('%d %b')} - {sunday_end.strftime('%d %b')}"

            return {
                "team_members": len(team_members),
                "active_learners": active_learners,
                "avg_hours_week": f"{avg_hours_week}h",
                "weekly_hours_total": f"{round(tot_week_hours, 1)}h",
                "active_learners_this_week": active_this_week,
                "week_period": week_period_str,
                "certificates_earned": certs_count,
            }
        finally:
            conn.close()

    def get_team_monthly_learning_trends(self, current_user: Any) -> Dict[str, Any]:
        """Calculates rolling 6 months learning trends (video vs practice hours) for reporting manager team."""
        target_id, team_members = self._resolve_manager_team(current_user)

        from datetime import datetime
        from dateutil.relativedelta import relativedelta

        now = datetime.now()
        months_meta = []
        for i in range(5, -1, -1):
            m_date = now - relativedelta(months=i)
            months_meta.append({
                "year": m_date.year,
                "month": m_date.month,
                "short_name": m_date.strftime("%b"),
                "full_name": m_date.strftime("%B %Y"),
                "is_current": (i == 0)
            })

        if not team_members:
            default_months = []
            for m in months_meta:
                default_months.append({
                    "month": m["short_name"],
                    "fullName": m["full_name"],
                    "hours": 0,
                    "videoHours": 0,
                    "practiceHours": 0,
                    "activeLearners": 0,
                    "isCurrent": m["is_current"],
                })
            return {
                "months": default_months,
                "max_scale": 30,
                "mom_growth_pct": 0,
                "mom_direction": "neutral",
                "current_month_hours": 0
            }

        team_ids = [m["employee_id"] for m in team_members if m.get("employee_id")]
        placeholders = ", ".join(["?"] * len(team_ids))

        conn = connect_db()
        cursor = conn.cursor()
        try:
            cursor.execute(f"""
                SELECT 
                    YEAR(created_at) as yr,
                    MONTH(created_at) as mo,
                    SUM(video_duration_minutes) as vid_mins,
                    SUM(practice_duration_minutes) as prac_mins,
                    COUNT(DISTINCT employee_id) as active_learners
                FROM dbo.lms_learning_logs
                WHERE employee_id IN ({placeholders})
                  AND created_at >= DATEADD(month, -6, GETDATE())
                GROUP BY YEAR(created_at), MONTH(created_at)
            """, tuple(team_ids))

            db_map = {
                (r[0], r[1]): {
                    "vid": r[2] or 0,
                    "prac": r[3] or 0,
                    "learners": r[4] or 0
                }
                for r in cursor.fetchall()
            }

            month_results = []
            for m in months_meta:
                key = (m["year"], m["month"])
                if key in db_map and (db_map[key]["vid"] > 0 or db_map[key]["prac"] > 0):
                    vid_h = int(round(db_map[key]["vid"] / 60.0))
                    prac_h = int(round(db_map[key]["prac"] / 60.0))
                    tot_h = int(round((db_map[key]["vid"] + db_map[key]["prac"]) / 60.0))
                    learners = db_map[key]["learners"]
                else:
                    vid_h = 0
                    prac_h = 0
                    tot_h = 0
                    learners = 0

                month_results.append({
                    "month": m["short_name"],
                    "fullName": m["full_name"],
                    "hours": int(tot_h),
                    "videoHours": int(vid_h),
                    "practiceHours": int(prac_h),
                    "activeLearners": learners,
                    "isCurrent": m["is_current"],
                })

            curr_h = month_results[-1]["hours"]
            prior_h = month_results[-2]["hours"] if len(month_results) >= 2 else curr_h
            if prior_h > 0:
                diff_pct = round(((curr_h - prior_h) / prior_h) * 100)
                mom_dir = "up" if diff_pct >= 0 else "down"
                mom_pct = abs(diff_pct)
            elif curr_h > 0:
                mom_dir = "up"
                mom_pct = 100
            else:
                mom_dir = "neutral"
                mom_pct = 0

            max_val = max([item["hours"] for item in month_results] + [0])
            scale = 30 if max_val <= 28 else int((max_val // 10 + 1) * 10)

            return {
                "months": month_results,
                "max_scale": scale,
                "mom_growth_pct": mom_pct,
                "mom_direction": mom_dir,
                "current_month_hours": curr_h,
            }
        finally:
            conn.close()

    def get_team_certifications_status(self, current_user: Any) -> Dict[str, Any]:
        """
        Calculates certification statistics (Earned, Expiring Soon, Requested, Claimed)
        exclusively for direct reports of the reporting manager.
        Used by Reports & Analytics CertificationsStatusCard.jsx.
        """
        target_id, team_members = self._resolve_manager_team(current_user)

        if not team_members:
            return {
                "earned": 0,
                "expiring_soon": 0,
                "requested": 0,
                "claimed": 0,
                "earned_breakdown": [],
                "requested_breakdown": [],
                "claimed_breakdown": [],
            }

        team_ids = [m["employee_id"] for m in team_members if m.get("employee_id")]
        name_map = {m["employee_id"]: m.get("name") or m.get("employee_name") or m["employee_id"] for m in team_members if m.get("employee_id")}
        placeholders = ", ".join(["?"] * len(team_ids))

        conn = connect_db()
        cursor = conn.cursor()
        try:
            # 1. Earned: Active professional certification (strictly excluding expired)
            cursor.execute(f"""
                SELECT employee_id, COUNT(*)
                FROM dbo.lms_employee_certificates
                WHERE employee_id IN ({placeholders})
                  AND LOWER(certificate_type) NOT LIKE '%course completion%'
                  AND (expiry_date IS NULL OR expiry_date >= CAST(GETDATE() AS DATE))
                GROUP BY employee_id
            """, tuple(team_ids))
            earned_rows = cursor.fetchall()
            earned_breakdown = [{"employee_id": r[0], "name": name_map.get(r[0], r[0]), "count": int(r[1])} for r in earned_rows]
            earned_total = sum(item["count"] for item in earned_breakdown)

            # 2. Expiring Soon: Expiring within 60 days
            cursor.execute(f"""
                SELECT COUNT(*)
                FROM dbo.lms_employee_certificates
                WHERE employee_id IN ({placeholders})
                  AND LOWER(certificate_type) NOT LIKE '%course completion%'
                  AND expiry_date IS NOT NULL
                  AND expiry_date >= CAST(GETDATE() AS DATE)
                  AND expiry_date <= DATEADD(day, 60, CAST(GETDATE() AS DATE))
            """, tuple(team_ids))
            exp_row = cursor.fetchone()
            expiring_soon = int(exp_row[0]) if exp_row and exp_row[0] else 0

            # 3. Requested: Pending certification requests
            cursor.execute(f"""
                SELECT employee_id, COUNT(*)
                FROM dbo.lms_certification_requests
                WHERE employee_id IN ({placeholders})
                  AND LOWER(status) IN ('pending', 'requested', 'submitted')
                GROUP BY employee_id
            """, tuple(team_ids))
            req_rows = cursor.fetchall()
            requested_breakdown = [{"employee_id": r[0], "name": name_map.get(r[0], r[0]), "count": int(r[1])} for r in req_rows]
            requested_total = sum(item["count"] for item in requested_breakdown)

            # 4. Claimed: Approved/settled reimbursement claims only
            cursor.execute(f"""
                SELECT employee_id, COUNT(*)
                FROM dbo.lms_reimbursement_claims
                WHERE employee_id IN ({placeholders})
                  AND LOWER(status) IN ('approved', 'settled', 'reimbursed')
                GROUP BY employee_id
            """, tuple(team_ids))
            claim_rows = cursor.fetchall()
            claimed_breakdown = [{"employee_id": r[0], "name": name_map.get(r[0], r[0]), "count": int(r[1])} for r in claim_rows]
            claimed_total = sum(item["count"] for item in claimed_breakdown)

            return {
                "earned": earned_total,
                "expiring_soon": expiring_soon,
                "requested": requested_total,
                "claimed": claimed_total,
                "earned_breakdown": earned_breakdown,
                "requested_breakdown": requested_breakdown,
                "claimed_breakdown": claimed_breakdown,
            }
        finally:
            conn.close()

    def get_team_overview_stats(self, current_user: Any) -> Dict[str, Any]:
        """
        Calculates all 6 metrics for Team Overview card in Reports & Analytics
        strictly and exclusively for direct reports of the reporting manager.
        """
        target_id, team_members = self._resolve_manager_team(current_user)

        if not team_members:
            return {
                "team_members": 0,
                "active_learners": 0,
                "learning_hours": "0h",
                "avg_learning_hours": "0h",
                "total_learning_hours": "0h",
                "learning_months_count": 0,
                "courses_completion_certificate": 0,
                "course_requests": 0,
                "course_approved": 0,
                "certificates_earned": 0,
                "pending_claims": 0,
                "approved_claims": 0,
                "details": {
                    "members_list": [],
                    "active_learners_list": [],
                    "hours_breakdown": {
                        "video_hours": 0,
                        "practice_hours": 0,
                        "total_hours": 0,
                        "avg_monthly_hours": 0.0,
                        "months_calculated": 0,
                    },
                    "claims_pending_amount": 0,
                    "course_completion_list": [],
                    "pending_requests_list": [],
                    "approved_requests_list": [],
                }
            }

        team_ids = [m["employee_id"] for m in team_members if m.get("employee_id")]
        name_map = {m["employee_id"]: m.get("name") or m.get("employee_name") or m["employee_id"] for m in team_members if m.get("employee_id")}
        desig_map = {m["employee_id"]: m.get("designation") or m.get("role") or "" for m in team_members if m.get("employee_id")}
        placeholders = ", ".join(["?"] * len(team_ids))

        conn = connect_db()
        cursor = conn.cursor()
        try:
            # 1. Total Team Members list
            members_list = [
                {
                    "employee_id": m["employee_id"],
                    "name": name_map.get(m["employee_id"], m["employee_id"]),
                    "designation": desig_map.get(m["employee_id"], "")
                }
                for m in team_members if m.get("employee_id")
            ]

            # 2. Active Learners (courses approved by L&D and in progress)
            cursor.execute(f"""
                SELECT ce.employee_id, COUNT(*) AS active_courses
                FROM dbo.lms_course_enrollments ce
                WHERE ce.employee_id IN ({placeholders})
                  AND LOWER(ce.status) IN ('in progress', 'active')
                  AND NOT EXISTS (
                      SELECT 1 FROM dbo.lms_enrollment_requests er
                      WHERE er.employee_id = ce.employee_id
                        AND er.course_id = ce.course_id
                        AND er.status IN ('Pending', 'On Hold', 'Rejected')
                  )
                GROUP BY ce.employee_id
            """, tuple(team_ids))
            active_rows = cursor.fetchall()
            active_learners_list = [
                {
                    "employee_id": r[0],
                    "name": name_map.get(r[0], r[0]),
                    "active_courses": int(r[1])
                }
                for r in active_rows
            ]
            active_learners_count = len(active_learners_list)

            # 3. Learning Hours (video + practice minutes from dbo.lms_learning_logs for team)
            # Calculated as: Learning Average Hours / Number of Months of Learning Logs
            cursor.execute(f"""
                SELECT 
                    COALESCE(SUM(video_duration_minutes), 0) AS vid_mins,
                    COALESCE(SUM(practice_duration_minutes), 0) AS prac_mins,
                    COUNT(DISTINCT (YEAR(created_at) * 100 + MONTH(created_at))) AS active_months_count
                FROM dbo.lms_learning_logs
                WHERE employee_id IN ({placeholders})
            """, tuple(team_ids))
            h_row = cursor.fetchone()
            vid_m = h_row[0] or 0
            prac_m = h_row[1] or 0
            active_months_count = h_row[2] or 0

            tot_hours_float = (vid_m + prac_m) / 60.0
            tot_h = int(round(tot_hours_float))
            vid_h = int(round(vid_m / 60.0))
            prac_h = int(round(prac_m / 60.0))

            months_divisor = max(1, active_months_count)
            avg_monthly_hours_float = round(tot_hours_float / float(months_divisor), 1) if active_months_count > 0 else 0.0
            avg_monthly_hours_str = f"{int(avg_monthly_hours_float) if avg_monthly_hours_float.is_integer() else avg_monthly_hours_float}h"

            # 4. Courses completion certificate (completed courses from enrollments/certificates)
            cursor.execute(f"""
                SELECT 
                    ce.employee_id,
                    c.course_name,
                    COALESCE(ce.progress_percentage, 100) AS progress
                FROM dbo.lms_course_enrollments ce
                LEFT JOIN dbo.lms_courses c ON ce.course_id = c.id
                WHERE ce.employee_id IN ({placeholders})
                  AND (LOWER(ce.status) = 'completed' OR ce.progress_percentage >= 100.0)
            """, tuple(team_ids))
            comp_rows = cursor.fetchall()
            courses_completion_count = len(comp_rows)
            course_completion_list = [
                {
                    "employee_id": r[0],
                    "name": name_map.get(r[0], r[0]),
                    "course_name": r[1] or "Course"
                }
                for r in comp_rows
            ]

            # 5. Course Request (Pending) & 6. Course Approve (Approved) from dbo.lms_course_requests (Request a Course workflow)
            cursor.execute(f"""
                SELECT 
                    cr.id,
                    cr.request_code,
                    cr.employee_id,
                    cr.course_name,
                    COALESCE(cp.ProviderName, '-') AS provider,
                    CONVERT(VARCHAR(10), cr.created_at, 120) AS request_date,
                    COALESCE(s3.stage_status, 'Pending') AS ld_stage_status,
                    COALESCE(s4.stage_status, 'Upcoming') AS ceo_stage_status,
                    COALESCE(s5.stage_status, 'Upcoming') AS purchase_stage_status
                FROM dbo.lms_course_requests cr
                LEFT JOIN dbo.CourseProviders cp ON cr.provider_id = cp.ProviderId
                LEFT JOIN dbo.lms_course_request_stages s3 ON cr.request_code = s3.request_code AND s3.stage_name = 'L&D'
                LEFT JOIN dbo.lms_course_request_stages s4 ON cr.request_code = s4.request_code AND s4.stage_name = 'CEO Approval'
                LEFT JOIN dbo.lms_course_request_stages s5 ON cr.request_code = s5.request_code AND s5.stage_name = 'Course Purchase'
                WHERE cr.employee_id IN ({placeholders})
                ORDER BY cr.created_at DESC, cr.id DESC
            """, tuple(team_ids))
            cr_rows = cursor.fetchall()

            pending_requests_list = []
            approved_requests_list = []

            for r in cr_rows:
                req_id = r[0]
                req_code = r[1]
                emp_id = r[2]
                course_title = r[3] or "Course"
                provider = r[4] or ""
                req_date = r[5] or ""
                ld_stat = str(r[6] or "").strip().lower()
                ceo_stat = str(r[7] or "").strip().lower()
                purch_stat = str(r[8] or "").strip().lower()

                # If rejected at any stage, do not count in either Pending or Approved
                if ld_stat == "rejected" or ceo_stat == "rejected":
                    continue

                full_course_label = f"{course_title} ({provider})" if provider else course_title
                item_data = {
                    "id": req_id,
                    "request_code": req_code,
                    "employee_id": emp_id,
                    "name": name_map.get(emp_id, emp_id),
                    "course_name": full_course_label,
                    "date": req_date
                }

                # Approved: if L&D or CEO or Purchase is completed
                if ld_stat == "completed" or ceo_stat == "completed" or purch_stat == "completed":
                    approved_requests_list.append(item_data)
                else:
                    # Pending review
                    pending_requests_list.append(item_data)

            course_requests_count = len(pending_requests_list)
            course_approved_count = len(approved_requests_list)

            return {
                "team_members": len(team_ids),
                "active_learners": active_learners_count,
                "learning_hours": avg_monthly_hours_str,
                "avg_learning_hours": avg_monthly_hours_str,
                "total_learning_hours": f"{tot_h}h",
                "learning_months_count": active_months_count,
                "courses_completion_certificate": courses_completion_count,
                "course_requests": course_requests_count,
                "course_approved": course_approved_count,
                # Backward-compatibility:
                "certificates_earned": courses_completion_count,
                "pending_claims": course_requests_count,
                "approved_claims": course_approved_count,
                "details": {
                    "members_list": members_list,
                    "active_learners_list": active_learners_list,
                    "hours_breakdown": {
                        "video_hours": vid_h,
                        "practice_hours": prac_h,
                        "total_hours": tot_h,
                        "avg_monthly_hours": avg_monthly_hours_float,
                        "months_calculated": active_months_count,
                    },
                    "claims_pending_amount": 0,
                    "course_completion_list": course_completion_list,
                    "pending_requests_list": pending_requests_list,
                    "approved_requests_list": approved_requests_list,
                }
            }
        finally:
            conn.close()

    def get_team_courses_data(self, current_user: Any) -> Dict[str, Any]:
        """
        Calculates Courses Data (Assigned, Completed, Active, Overdue)
        strictly and exclusively for direct reports of the reporting manager.
        Used by Reports & Analytics CoursesDataCard.jsx.
        """
        target_id, team_members = self._resolve_manager_team(current_user)

        if not team_members:
            return {
                "assigned": 0,
                "completed": 0,
                "active": 0,
                "overdue": 0,
                "assigned_breakdown": [],
                "completed_breakdown": [],
                "active_breakdown": [],
                "overdue_breakdown": [],
            }

        mgr_id_clean = (target_id or "").strip().lower()
        team_ids = [m["employee_id"] for m in team_members if m.get("employee_id") and m["employee_id"].strip().lower() != mgr_id_clean]
        name_map = {m["employee_id"]: m.get("name") or m.get("employee_name") or m["employee_id"] for m in team_members if m.get("employee_id") and m["employee_id"].strip().lower() != mgr_id_clean}
        placeholders = ", ".join(["?"] * len(team_ids))

        conn = connect_db()
        cursor = conn.cursor()
        try:
            # Unified Learning Progress across Team:
            # - Total: All active/approved course enrollments (both L&D Assigned & Self-Enrolled)
            # - Assigned: L&D assigned courses pending completion
            # - Completed: Completed courses from all sources (Includes completed self-enrolled like Imran Khan's 3 courses)
            # - Active: In-progress courses from all sources
            # - Overdue: Courses that missed target completion date
            cursor.execute(f"""
                WITH TeamEnrollments AS (
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
                    WHERE ce.employee_id IN ({placeholders})
                      AND ce.status NOT IN ('Pending', 'On Hold', 'Rejected')
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
                FROM TeamEnrollments;
            """, tuple(team_ids))
            row = cursor.fetchone()
            total_team = int(row[0] or 0)
            assigned_count = int(row[1] or 0)
            comp = int(row[2] or 0)
            act = int(row[3] or 0)
            over = int(row[4] or 0)

            # Member breakdowns for team
            cursor.execute(f"""
                WITH TeamEnrollments AS (
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
                    WHERE ce.employee_id IN ({placeholders})
                      AND ce.status NOT IN ('Pending', 'On Hold', 'Rejected')
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
                FROM TeamEnrollments
                GROUP BY employee_id;
            """, tuple(team_ids))
            m_rows = cursor.fetchall()
            assigned_bd = [{"employee_id": r[0], "name": name_map.get(r[0], r[0]), "count": int(r[1])} for r in m_rows if r[1] > 0]
            completed_bd = [{"employee_id": r[0], "name": name_map.get(r[0], r[0]), "count": int(r[2])} for r in m_rows if r[2] > 0]
            active_bd = [{"employee_id": r[0], "name": name_map.get(r[0], r[0]), "count": int(r[3])} for r in m_rows if r[3] > 0]
            overdue_bd = [{"employee_id": r[0], "name": name_map.get(r[0], r[0]), "count": int(r[4])} for r in m_rows if r[4] > 0]

            # Detailed list of overdue courses
            cursor.execute(f"""
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
                WHERE ce.employee_id IN ({placeholders})
                  AND ce.status NOT IN ('Pending', 'On Hold', 'Rejected')
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
            """, tuple(team_ids))
            od_rows = cursor.fetchall()
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

            return {
                "total_team_courses": total_team,
                "assigned": assigned_count,
                "completed": comp,
                "active": act,
                "overdue": over,
                "assigned_breakdown": assigned_bd,
                "completed_breakdown": completed_bd,
                "active_breakdown": active_bd,
                "overdue_breakdown": overdue_bd,
                "overdue_details": overdue_details,
            }
        finally:
            conn.close()

    def unenroll_course(
        self,
        employee_id: str,
        course_id: int,
        current_user: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        ENR-YYYY-021: Validates that course progress is <= 50% before dropping.
        If progress > 50%, unenrollment is blocked to preserve training audit records.
        """
        target_emp = employee_id
        if not target_emp and isinstance(current_user, dict):
            target_emp = current_user.get("employee_id") or current_user.get("id")
        if not target_emp:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authenticated user employee_id is required.",
            )

        conn = connect_db()
        cursor = conn.cursor()
        try:
            res = repo.unenroll_course(cursor, employee_id=target_emp, course_id=course_id)
            if not res.get("allowed"):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=res.get("error", "Unenrollment not allowed.")
                )

            # Model B: Release concurrency slot upon unenrollment
            try:
                from services.common.slot_service import slot_service
                slot_service.release_slot(course_id=course_id, employee_id=target_emp, cursor=cursor, conn=conn)
            except Exception as se:
                print(f"[CourseEnrollmentService] Notice releasing slot on unenroll: {se}")

            conn.commit()
            return res
        except HTTPException:
            conn.rollback()
            raise
        except Exception as e:
            conn.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to unenroll from course: {str(e)}"
            )
        finally:
            conn.close()

course_enrollment_service = CourseEnrollmentService()


