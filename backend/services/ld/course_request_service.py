"""
Course Request Service.
Business logic orchestrating course requests, notifications, and approval life-cycle.
Master-Detail model:
- dbo.lms_course_requests (Master)
- dbo.lms_course_request_stages (Detail: 5 Milestone Stages)
- dbo.lms_courses (Course Catalog)
- dbo.lms_notifications (User Notifications)
"""

import html
import re
from typing import List, Dict, Any, Optional
from datetime import datetime
from fastapi import HTTPException, status

from database.connection import connect_db, is_sql_server
from utils.idempotency import is_unique_violation
from repositories.ld import course_request_repository
from repositories.common import notification_repository
from repositories.common.course_metadata_repository import course_metadata_repository
from services.common.auth_service import employee_service
from models.ld.course_request import CourseRequestCreate, CourseRequestDecision

def normalize_admin_code(raw_admin: Any, default_emp_id: Optional[str] = None) -> str:
    """Sanitizes admin ID, preventing numeric '1' or invalid strings from polluting audit fields."""
    if raw_admin is None:
        if default_emp_id:
            return default_emp_id
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authenticated actor employee_id is required.",
        )
    val = str(raw_admin).strip()
    if not val or val.lower() in ["1", "0", "admin", "null", "none", "undefined"]:
        if default_emp_id:
            return default_emp_id
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authenticated actor employee_id is required.",
        )
    if val.isdigit():
        return f"EMP{int(val):03d}"
    return val[:7].upper()

class CourseRequestService:
    def _resolve_employee_and_manager(self, cursor, employee_id_val: Any, employee_name_val: Optional[str]):
        """Resolves employee_id (VARCHAR 7) and reporting manager employee_id."""
        emps = employee_service.get_all_employees()
        emp = None
        formatted_id = None

        # 1. Match by ID: "EMP011" or 11 -> "EMP011"
        if employee_id_val is not None and str(employee_id_val).strip():
            clean_str = str(employee_id_val).strip().upper()
            if clean_str.isdigit():
                formatted_id = f"EMP{int(clean_str):03d}"
            elif clean_str.startswith("EMP"):
                formatted_id = clean_str[:7]
            else:
                formatted_id = clean_str[:7]

            for e in emps:
                if e.get("employee_id", "").upper() == formatted_id:
                    emp = e
                    break

        # 2. Match by Name if not found
        if not emp and employee_name_val:
            clean_name = employee_name_val.strip().lower()
            for e in emps:
                e_name = (e.get("name") or "").strip().lower()
                if clean_name == e_name or clean_name in e_name or e_name in clean_name:
                    emp = e
                    formatted_id = e.get("employee_id") or formatted_id
                    break

        if not formatted_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="employee_id is required to submit a course request.",
            )

        # Ensure employee profile exists in DB
        course_request_repository.ensure_employee_profile(
            cursor,
            formatted_id,
            azure_user_id=emp.get("microsoft_object_id") if emp else None
        )

        # 3. Resolve Reporting Manager dynamically (no hardcoded fallback)
        manager_emp = None
        if emp and emp.get("reporting_manager_id"):
            manager_emp = employee_service.get_employee_by_id(emp["reporting_manager_id"])

        if not manager_emp and emp and emp.get("reporting_manager"):
            rm_text = emp["reporting_manager"].strip().lower()
            for e in emps:
                e_name = (e.get("name") or "").strip().lower()
                if e_name and (e_name in rm_text or rm_text in e_name):
                    manager_emp = e
                    break

        manager_emp_id = manager_emp.get("employee_id") if manager_emp else None
        if manager_emp_id:
            course_request_repository.ensure_employee_profile(
                cursor,
                manager_emp_id,
                azure_user_id=manager_emp.get("microsoft_object_id") if manager_emp else None
            )

        return emp, formatted_id, manager_emp, manager_emp_id

    def create_request(self, data: CourseRequestCreate) -> Dict[str, Any]:
        """
        Employee submits a new course request:
        1. Inserts into dbo.lms_course_requests (Master: REQ-2026-XXXX)
        2. Inserts 5 stages into dbo.lms_course_request_stages
        3. Inserts notification to Reporting Manager in dbo.lms_notifications
        """
        conn = connect_db()
        cursor = conn.cursor()
        try:
            emp_info, clean_emp_id, manager_emp, manager_emp_id = self._resolve_employee_and_manager(
                cursor, data.employee_id, data.employee_name
            )

            display_name = data.employee_name or (emp_info.get("name") if emp_info else "Employee")
            dept_val = emp_info.get("department") if emp_info else None
            if data.employee_role and data.employee_role.strip().lower() != "employee":
                display_role = data.employee_role.strip()
            elif dept_val:
                display_role = dept_val
            elif emp_info and emp_info.get("job_title") and emp_info.get("job_title").strip().lower() != "employee":
                display_role = emp_info.get("job_title").strip()
            else:
                display_role = "-"

            # Determine cost / price, provider_id, and category_id
            cost_val = float(data.price or 0.0)
            provider_val = course_metadata_repository.normalize_metadata_name(data.provider, "-")
            category_val = course_metadata_repository.normalize_metadata_name(data.category, "-")
            provider_id = data.provider_id or course_metadata_repository.resolve_provider_id(data.provider, cursor=cursor)
            category_id = data.category_id or course_metadata_repository.resolve_category_id(data.category, cursor=cursor)
            reason_val = re.sub(r'\s+', ' ', data.reason.strip()) if data.reason else None

            clean_course_title = html.unescape(data.course_name.strip())[:100]
            lock_hint = " WITH (UPDLOCK, HOLDLOCK)" if is_sql_server() else ""
            cursor.execute(
                f"""
                SELECT TOP 1 cr.id, cr.request_code
                FROM dbo.lms_course_requests cr{lock_hint}
                WHERE LOWER(cr.employee_id) = LOWER(?)
                  AND LOWER(LTRIM(RTRIM(cr.course_name))) = LOWER(?)
                  AND ((? IS NOT NULL AND cr.provider_id = ?) OR (? IS NULL AND cr.provider_id IS NULL))
                  AND NOT EXISTS (
                      SELECT 1 FROM dbo.lms_course_request_stages s
                      WHERE s.request_code = cr.request_code
                        AND s.stage_status = 'Rejected'
                  )
                """,
                (clean_emp_id, clean_course_title, provider_id, provider_id, provider_id),
            )
            dup_req = cursor.fetchone()
            if dup_req:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"You already have an active course request ({dup_req[1]}) for '{clean_course_title}'."
                )

            # 1 & 2. Insert master request and 5 stages
            req_id = course_request_repository.insert_course_request(
                cursor,
                employee_id=clean_emp_id,
                course_name=clean_course_title,
                provider=provider_val,
                category=category_val,
                course_link=data.course_link.strip() if data.course_link else None,
                reason=reason_val if reason_val else None,
                duration_minutes=data.duration_minutes,
                price=cost_val,
                created_by=clean_emp_id,
                provider_id=provider_id,
                category_id=category_id,
            )

            # Retrieve created master to get the generated request_code
            created_req = course_request_repository.get_request_by_id(cursor, req_id)
            req_code = created_req.get("request_code") if created_req else f"REQ-{req_id}"

            # 3. Insert notification to Reporting Manager (REQ-CRS-024: preserve unescaped ampersand)
            if manager_emp_id:
                try:
                    notif_msg = f"{display_name} submitted a new course request for '{clean_course_title}' ({provider_val}). Request Code: {req_code}"
                    notification_repository.insert_notification(
                        cursor,
                        employee_id=manager_emp_id,
                        message=notif_msg,
                        is_read=False,
                        created_by=clean_emp_id
                    )
                except Exception as notify_err:
                    print(f"[Warning] Failed to insert RM notification: {notify_err}")

            conn.commit()
            return self.get_request_by_id(req_id)
        except HTTPException:
            conn.rollback()
            raise
        except Exception as e:
            conn.rollback()
            if is_unique_violation(e):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Duplicate course request detected. Please refresh and check your existing requests."
                )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create course request: {str(e)}"
            )
        finally:
            conn.close()

    def get_requests(
        self,
        stage: Optional[str] = None,
        employee_id: Optional[str] = None,
        employee_name: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Retrieves course requests filtered by stage or employee."""
        conn = connect_db()
        cursor = conn.cursor()
        try:
            reqs = course_request_repository.get_all_requests(
                cursor,
                stage=stage,
                employee_id=employee_id,
                employee_name=employee_name
            )

            # Enrich with Azure AD Employee details
            emps = employee_service.get_all_employees()
            emp_by_id = {e.get("employee_id", "").strip().upper(): e for e in emps}

            for r in reqs:
                emp = emp_by_id.get(str(r.get("employee_id") or "").strip().upper())
                dept = (emp.get("department") if emp else None) or "Product Operations"
                r["department"] = dept
                r["employee_name"] = emp.get("name") if emp else f"Employee {r.get('employee_id')}"
                r["employee_role"] = dept

            return reqs
        finally:
            conn.close()

    def get_request_by_id(self, request_id: int) -> Dict[str, Any]:
        """Get single course request details with 5 stages."""
        conn = connect_db()
        cursor = conn.cursor()
        try:
            item = course_request_repository.get_request_by_id(cursor, request_id)
            if not item:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Course request with ID {request_id} not found"
                )

            emps = employee_service.get_all_employees()
            emp = next((e for e in emps if e.get("employee_id", "").upper() == str(item.get("employee_id", "")).upper()), None)
            item["department"] = (emp.get("department") if emp else None) or "Product Operations"
            item["employee_name"] = emp.get("name") if emp else f"Employee {item.get('employee_id')}"
            item["employee_role"] = item["department"]
            return item
        finally:
            conn.close()

    def ld_decision(self, request_id: int, decision: CourseRequestDecision) -> Dict[str, Any]:
        """
        Stage 3: L&D Review
        - If Approved: Stage 3 -> Completed | Stage 4 (CEO) -> Pending | Notifies CEO & Employee
        - If Rejected: Stage 3 -> Rejected | Subsequent -> Rejected | Notifies Employee
        """
        conn = connect_db()
        cursor = conn.cursor()
        try:
            existing = course_request_repository.get_request_by_id(cursor, request_id)
            if not existing:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Course request {request_id} not found"
                )

            norm_status = decision.status.strip().capitalize()
            if norm_status not in ["Approved", "Rejected", "Pending"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Status must be 'Approved', 'Rejected', or 'Pending'"
                )

            admin_code = normalize_admin_code(decision.admin_id)

            # Enforce Separation of Duties: L&D user cannot approve or reject their own request
            req_emp_id = str(existing.get("employee_id") or "").strip().upper()
            if admin_code and req_emp_id and admin_code.strip().upper() == req_emp_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Self-approval is not permitted. Another L&D team member must review and approve this request."
                )
            clean_comment = (
                re.sub(
                    r"\n{2,}",
                    "\n",
                    re.sub(
                        r" *\n *",
                        "\n",
                        re.sub(
                            r" {2,}",
                            " ",
                            str(decision.comment or "").replace("\r\n", "\n").replace("\r", "\n").replace("\t", " "),
                        ),
                    ),
                ).strip()
                if decision.comment is not None
                else None
            )
            bypass_ceo = bool(getattr(decision, "bypass_ceo", False)) and norm_status == "Approved"
            if norm_status == "Approved":
                course_metadata_repository.ensure_provider_exists(existing.get("provider"), cursor=cursor)
                course_metadata_repository.ensure_category_exists(existing.get("category"), cursor=cursor)
            course_request_repository.update_ld_decision(
                cursor,
                request_id=request_id,
                status=norm_status,
                comment=clean_comment,
                admin_id=admin_code,
                bypass_ceo=bypass_ceo
            )

            # Insert notifications
            req_code = existing.get("request_code", f"REQ-{request_id}")
            course_name = existing.get("course_name", "Course")
            requester_id = existing.get("employee_id")

            if norm_status == "Approved":
                if not bypass_ceo:
                    # Notify CEO recipients dynamically only when NOT bypassed by L&D
                    try:
                        for ceo_id in employee_service.get_employee_ids_by_role("CEO"):
                            notification_repository.insert_notification(
                                cursor,
                                employee_id=ceo_id,
                                message=f"Course request {req_code} for '{course_name}' was approved by L&D and is awaiting your review.",
                                is_read=False,
                                created_by=admin_code
                            )
                    except Exception as e:
                        print(f"[Warning] Failed to notify CEO: {e}")

                # Notify Employee
                if requester_id:
                    try:
                        emp_msg = (
                            f"Your course request {req_code} for '{course_name}' was approved by L&D (CEO approval bypassed) and is queued for purchase."
                            if bypass_ceo
                            else f"Your course request {req_code} for '{course_name}' was approved by L&D and forwarded to the CEO."
                        )
                        notification_repository.insert_notification(
                            cursor,
                            employee_id=requester_id,
                            message=emp_msg,
                            is_read=False,
                            created_by=admin_code
                        )
                    except Exception as e:
                        print(f"[Warning] Failed to notify Employee: {e}")
            elif norm_status == "Pending" and requester_id:
                # Notify Employee of reopened request
                try:
                    notification_repository.insert_notification(
                        cursor,
                        employee_id=requester_id,
                        message=f"Your course request {req_code} for '{course_name}' has been reopened by L&D and returned to Pending for review.",
                        is_read=False,
                        created_by=admin_code
                    )
                except Exception as e:
                    print(f"[Warning] Failed to notify Employee of reopened request: {e}")
            elif requester_id:
                # Notify Employee of rejection
                try:
                    notification_repository.insert_notification(
                        cursor,
                        employee_id=requester_id,
                        message=f"Your course request {req_code} for '{course_name}' was not approved by L&D.",
                        is_read=False,
                        created_by=admin_code
                    )
                except Exception as e:
                    print(f"[Warning] Failed to notify Employee of rejection: {e}")

            conn.commit()
            return self.get_request_by_id(request_id)
        except Exception as e:
            conn.rollback()
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to record L&D decision: {str(e)}"
            )
        finally:
            conn.close()

    def ceo_decision(self, request_id: int, decision: CourseRequestDecision) -> Dict[str, Any]:
        """
        Stage 4: CEO Review
        - If Approved: Stage 4 -> Completed | Stage 5 (Purchase) -> Pending | Notifies L&D & Employee
        - If Rejected: Stage 4 -> Rejected | Stage 5 -> Rejected | Notifies Employee
        """
        conn = connect_db()
        cursor = conn.cursor()
        try:
            existing = course_request_repository.get_request_by_id(cursor, request_id)
            if not existing:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Course request {request_id} not found"
                )

            if existing.get("ld_status") != "Approved":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="CEO can only review course requests that have been approved by L&D"
                )

            norm_status = decision.status.strip().capitalize()
            if norm_status not in ["Approved", "Rejected"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Status must be 'Approved' or 'Rejected'"
                )

            admin_code = normalize_admin_code(decision.admin_id)

            # Enforce Separation of Duties: CEO cannot self-approve
            req_emp_id = str(existing.get("employee_id") or "").strip().upper()
            if admin_code and req_emp_id and admin_code.strip().upper() == req_emp_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Self-approval is not permitted."
                )
            course_request_repository.update_ceo_decision(
                cursor,
                request_id=request_id,
                status=norm_status,
                comment=decision.comment,
                admin_id=admin_code
            )

            req_code = existing.get("request_code", f"REQ-{request_id}")
            course_name = existing.get("course_name", "Course")
            requester_id = existing.get("employee_id")

            if norm_status == "Approved":
                # Notify L&D recipients dynamically
                try:
                    for ld_id in employee_service.get_employee_ids_by_role("L&D", "L&D Team"):
                        notification_repository.insert_notification(
                            cursor,
                            employee_id=ld_id,
                            message=f"Course request {req_code} for '{course_name}' was approved by CEO and is ready for purchase.",
                            is_read=False,
                            created_by=admin_code
                        )
                except Exception as e:
                    print(f"[Warning] Failed to notify L&D: {e}")

                # Notify Employee
                if requester_id:
                    try:
                        notification_repository.insert_notification(
                            cursor,
                            employee_id=requester_id,
                            message=f"Your course request {req_code} for '{course_name}' was approved by CEO and is queued for purchase.",
                            is_read=False,
                            created_by=admin_code
                        )
                    except Exception as e:
                        print(f"[Warning] Failed to notify Employee: {e}")
            elif requester_id:
                # Notify Employee
                try:
                    notification_repository.insert_notification(
                        cursor,
                        employee_id=requester_id,
                        message=f"Your course request {req_code} for '{course_name}' was not approved by CEO.",
                        is_read=False,
                        created_by=admin_code
                    )
                except Exception as e:
                    print(f"[Warning] Failed to notify Employee: {e}")

            conn.commit()
            return self.get_request_by_id(request_id)
        except Exception as e:
            conn.rollback()
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to record CEO decision: {str(e)}"
            )
        finally:
            conn.close()

    def mark_purchased(self, request_id: int, admin_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Stage 5: Purchase & Course Creation
        - Stage 5 -> Completed
        - Course created in dbo.lms_courses
        - Added to dbo.lms_hr_activity_feed
        - Notifies Employee
        """
        conn = connect_db()
        cursor = conn.cursor()
        try:
            existing = course_request_repository.get_request_by_id(cursor, request_id)
            if not existing:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Course request {request_id} not found"
                )

            admin_code = normalize_admin_code(admin_id)
            course_request_repository.mark_as_purchased(
                cursor,
                request_id=request_id,
                admin_id=admin_code
            )

            req_code = existing.get("request_code", f"REQ-{request_id}")
            course_name = existing.get("course_name", "Course")
            requester_id = existing.get("employee_id")

            # Notify requesting employee
            if requester_id:
                try:
                    notification_repository.insert_notification(
                        cursor,
                        employee_id=requester_id,
                        message=f"Your requested course '{course_name}' ({req_code}) was purchased and is now available in the Course Library!",
                        is_read=False,
                        created_by=admin_code
                    )
                except Exception as e:
                    print(f"[Warning] Failed to notify Employee of purchase: {e}")

            conn.commit()
            return self.get_request_by_id(request_id)
        except Exception as e:
            conn.rollback()
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to mark as purchased: {str(e)}"
            )
        finally:
            conn.close()

    def get_tracker_items(
        self,
        employee_id: Optional[str] = None,
        employee_name: Optional[str] = None,
        manager_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Calculates the 5-step milestone timeline for CourseRequestTracker.jsx:
        1. Employee (Completed)
        2. Notified to RM (Completed)
        3. L&D (Pending / Completed / Rejected)
        4. CEO Approval (Upcoming / Pending / Completed / Rejected)
        5. Course Purchase (Upcoming / Pending / Completed / Rejected)
        """
        conn = connect_db()
        cursor = conn.cursor()
        try:
            clean_emp_id = None
            if employee_id:
                raw = str(employee_id).strip().upper()
                clean_emp_id = f"EMP{int(raw):03d}" if raw.isdigit() else raw[:7]

            records = course_request_repository.get_all_requests(
                cursor,
                employee_id=clean_emp_id,
                employee_name=employee_name
            )

            # If manager_id is specified (and not querying manager's own single employee_id),
            # strictly filter requests to ONLY include direct reports (team members) of this Reporting Manager.
            if manager_id:
                clean_mgr_id = str(manager_id).strip()
                if clean_mgr_id.lower().startswith("dev-token-"):
                    clean_mgr_id = clean_mgr_id[10:]

                # Only scope to team if employee_id is not explicitly the manager themselves
                if not clean_emp_id or (clean_emp_id and clean_emp_id.upper() != clean_mgr_id.upper()):
                    team_members = employee_service.get_team_members(clean_mgr_id)

                    # If this manager has no team members, return empty list
                    if not team_members:
                        return []

                    team_emp_ids = {
                        str(m.get("employee_id") or "").strip().upper()
                        for m in team_members
                        if m.get("employee_id")
                    }
                    records = [
                        r for r in records
                        if str(r.get("employee_id") or "").strip().upper() in team_emp_ids
                    ]

            emps = employee_service.get_all_employees()
            emp_by_id = {e.get("employee_id", "").strip().upper(): e for e in emps}

            def _format_tracker_date(val: Any) -> str:
                if not val:
                    return ""
                if hasattr(val, "strftime"):
                    return val.strftime("%d %b %Y")
                val_str = str(val).strip()
                if not val_str or val_str in ("Recent", "Approved", "Purchased", "Pending"):
                    return val_str
                for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%dT%H:%M:%S"):
                    try:
                        return datetime.strptime(val_str.split(".")[0].replace("Z", ""), fmt).strftime("%d %b %Y")
                    except ValueError:
                        continue
                return val_str

            tracker_items = []
            for r in records:
                emp = emp_by_id.get(str(r.get("employee_id") or "").strip().upper())
                dept = (emp.get("department") if emp else None) or "Product Operations"
                emp_name = emp.get("name") if emp else f"Employee {r.get('employee_id')}"

                # Date formatting (Standardized to DD Mon YYYY e.g. 13 Nov 2026)
                req_date_str = _format_tracker_date(r.get("created_at")) or "Recent"
                rm_date_str = _format_tracker_date(r.get("notified_reporting_manager")) or req_date_str
                ld_date_str = _format_tracker_date(r.get("ld_status_date"))
                ceo_date_str = _format_tracker_date(r.get("ceo_status_date"))
                purch_date_str = _format_tracker_date(r.get("purchase_date"))

                s3_stat = r.get("ld_stage_status") or "Pending"
                s4_stat = r.get("ceo_stage_status") or "Upcoming"
                s5_stat = r.get("purchase_stage_status") or "Upcoming"

                # Step 1: Employee
                step1 = {
                    "id": 1,
                    "label": "Employee",
                    "subText": req_date_str,
                    "date": req_date_str,
                    "status": "completed"
                }

                # Step 2: Notified to RM
                step2 = {
                    "id": 2,
                    "label": "Notified to RM",
                    "subText": rm_date_str,
                    "date": rm_date_str,
                    "status": "completed"
                }

                # Step 3: L&D
                if s3_stat == "Completed":
                    step3 = {"id": 3, "label": "L&D", "subText": ld_date_str or "Approved", "date": ld_date_str or "Approved", "status": "completed"}
                elif s3_stat == "Rejected":
                    step3 = {"id": 3, "label": "L&D", "subText": "Rejected", "date": "Rejected", "status": "rejected"}
                else:
                    step3 = {"id": 3, "label": "L&D", "subText": "Pending", "date": "Pending", "status": "pending"}

                # Step 4: CEO Approval
                if s3_stat != "Completed":
                    if s3_stat == "Rejected":
                        step4 = {"id": 4, "label": "CEO Approval", "subText": "-", "date": "-", "status": "rejected"}
                    else:
                        step4 = {"id": 4, "label": "CEO Approval", "subText": "", "date": "", "status": "upcoming"}
                elif s4_stat == "Completed":
                    step4_label = "Bypassed by L&D" if r.get("is_ceo_bypassed") else "CEO Approval"
                    step4 = {"id": 4, "label": step4_label, "subText": ceo_date_str or "Approved", "date": ceo_date_str or "Approved", "status": "completed"}
                elif s4_stat == "Rejected":
                    step4 = {"id": 4, "label": "CEO Approval", "subText": "Rejected", "date": "Rejected", "status": "rejected"}
                else:
                    step4 = {"id": 4, "label": "CEO Approval", "subText": "Pending", "date": "Pending", "status": "pending"}

                # Step 5: Course Purchase
                if s4_stat != "Completed":
                    if s4_stat == "Rejected" or s3_stat == "Rejected":
                        step5 = {"id": 5, "label": "Course Purchase", "subText": "-", "date": "-", "status": "rejected"}
                    else:
                        step5 = {"id": 5, "label": "Course Purchase", "subText": "", "date": "", "status": "upcoming"}
                elif s5_stat == "Completed":
                    step5 = {"id": 5, "label": "Course Purchase", "subText": purch_date_str or "Purchased", "date": purch_date_str or "Purchased", "status": "completed_final"}
                else:
                    step5 = {"id": 5, "label": "Course Purchase", "subText": "Ready for Purchase...", "date": "Ready for Purchase...", "status": "pending"}

                tracker_items.append({
                    "id": r["id"],
                    "courseRequestId": r["request_code"],
                    "employeeId": r["employee_id"],
                    "employeeName": emp_name,
                    "employeeRole": dept,
                    "courseTitle": r["course_name"],
                    "provider": r["provider"],
                    "category": r["category"],
                    "requestDate": req_date_str,
                    "estimatedCost": r.get("price", 0.0),
                    "steps": [step1, step2, step3, step4, step5]
                })

            return tracker_items
        finally:
            conn.close()

    def auto_escalate_pending_requests(self, days_threshold: int = 7) -> Dict[str, Any]:
        """
        REQ-CRS-025: Checks for course requests pending approval for >= days_threshold business days.
        Automatically dispatches urgent escalation notifications to Secondary Manager / L&D Admin.
        """
        conn = connect_db()
        cursor = conn.cursor()
        escalated_count = 0
        escalated_requests = []
        try:
            ld_recipients = employee_service.get_employee_ids_by_role("L&D", "L&D Team")
            pending_items = course_request_repository.get_pending_escalation_requests(cursor, days_threshold)
            for item in pending_items:
                req_code = item["request_code"]
                course_name = html.unescape(item.get("course_name") or "Course")
                emp_id = item.get("employee_id")
                stage_name = item.get("stage_name") or "Manager Review"
                rm_id = employee_service.get_reporting_manager_id(emp_id) if emp_id else None
                target_admins = list(dict.fromkeys(([rm_id] if rm_id else []) + ld_recipients))
                if not target_admins:
                    continue

                # Check if escalation notification already sent to avoid duplicate spam
                placeholders = ", ".join(["?"] * len(target_admins))
                cursor.execute(f"""
                    SELECT COUNT(*) FROM dbo.lms_notifications 
                    WHERE message LIKE ? AND employee_id IN ({placeholders})
                """, (f"%URGENT ESCALATION%Course request {req_code}%", *target_admins))
                existing_count = cursor.fetchone()[0]

                if existing_count == 0:
                    urgent_msg = f"URGENT ESCALATION: Course request {req_code} ('{course_name}') from {emp_id} has been pending in stage '{stage_name}' for over {days_threshold} days. Auto-escalated to Secondary Manager / L&D."
                    for target_admin in target_admins:
                        course_request_repository.ensure_employee_profile(cursor, target_admin)
                        notification_repository.insert_notification(
                            cursor,
                            employee_id=target_admin,
                            message=urgent_msg,
                            is_read=False,
                            created_by="SYSTEM"
                        )
                    escalated_count += 1
                    escalated_requests.append(req_code)

            conn.commit()
            return {
                "success": True,
                "threshold_days": days_threshold,
                "escalated_count": escalated_count,
                "escalated_requests": escalated_requests,
                "message": f"Processed auto-escalation. Escalated {escalated_count} pending requests."
            }
        except Exception as e:
            conn.rollback()
            raise HTTPException(status_code=500, detail=f"Auto-escalation failed: {str(e)}")
        finally:
            conn.close()

course_request_service = CourseRequestService()
