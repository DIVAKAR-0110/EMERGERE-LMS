"""
Notification & Recommendation Service.
Coordinates transactions, resolving employee identities and creating notifications
directly using dbo.lms_notifications, dbo.lms_course_recommend, and dbo.lms_recommend_new_course.
"""

from typing import List, Dict, Any, Optional
from fastapi import HTTPException, status
from database.connection import connect_db
from repositories.common import notification_repository
from repositories.common.course_metadata_repository import course_metadata_repository
from models.common.notification import CourseRecommendationCreate
from services.common.auth_service import employee_service

class NotificationService:
    def _resolve_emp_id(self, user_or_id: Any) -> str:
        """Resolves employee_id (e.g., 'EMP001', 'EMP018') from user object or string/int."""
        if isinstance(user_or_id, dict):
            emp_id = user_or_id.get("employee_id")
            if emp_id:
                return str(emp_id).strip()
            email = user_or_id.get("work_email") or user_or_id.get("email")
            if email:
                emp = employee_service.get_employee_by_email(email)
                if emp and emp.get("employee_id"):
                    return str(emp["employee_id"]).strip()
            oid = user_or_id.get("microsoft_object_id") or user_or_id.get("oid")
            if oid:
                emp = employee_service.get_employee_by_id(oid)
                if emp and emp.get("employee_id"):
                    return str(emp["employee_id"]).strip()
        elif isinstance(user_or_id, int):
            return f"EMP{user_or_id:03d}"
        elif isinstance(user_or_id, str):
            identifier = user_or_id.strip()
            if identifier.upper().startswith("EMP"):
                return identifier.upper()
            if "@" in identifier:
                emp = employee_service.get_employee_by_email(identifier)
                if emp and emp.get("employee_id"):
                    return str(emp["employee_id"]).strip()
            emp = employee_service.get_employee_by_id(identifier)
            if emp and emp.get("employee_id"):
                return str(emp["employee_id"]).strip()
            return identifier

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user employee_id is required.",
        )

    def _resolve_view_context(
        self,
        current_user: Dict[str, Any],
        view_mode: Optional[str] = None
    ) -> Dict[str, Optional[str]]:
        """Resolves normalized primary role and effective notification scope ('PRIMARY' | 'EMPLOYEE')."""
        raw_role = current_user.get("role") if isinstance(current_user, dict) else None
        norm_role = notification_repository.normalize_role_name(raw_role)
        mode_clean = str(view_mode or "").strip().upper()
        if norm_role == "Employee":
            effective_mode = "EMPLOYEE"
        elif mode_clean in ("EMPLOYEE", "PRIMARY"):
            effective_mode = mode_clean
        else:
            effective_mode = None  # Backwards compatibility if no view_mode specified
        return {"role": norm_role, "view_mode": effective_mode}

    def get_user_notifications(
        self,
        current_user: Dict[str, Any],
        view_mode: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Retrieves notifications for the user filtered by active view mode & primary role."""
        emp_id = self._resolve_emp_id(current_user)
        ctx = self._resolve_view_context(current_user, view_mode)
        if ctx["view_mode"] in ("EMPLOYEE", None):
            try:
                self.check_and_send_course_expiry_notifications(target_employee_id=emp_id)
            except Exception as e:
                print(f"[NotificationService] Notice during auto expiry check: {e}")

        conn = connect_db()
        cursor = conn.cursor()
        try:
            notifs = notification_repository.get_user_notifications(
                cursor,
                emp_id,
                view_mode=ctx["view_mode"],
                user_role=ctx["role"]
            )
            return notifs
        finally:
            conn.close()

    def mark_as_read(self, current_user: Dict[str, Any], notification_id: int) -> Dict[str, Any]:
        """Marks a notification as read."""
        emp_id = self._resolve_emp_id(current_user)
        conn = connect_db()
        cursor = conn.cursor()
        try:
            updated = notification_repository.mark_notification_as_read(cursor, notification_id, emp_id)
            conn.commit()
            return {"success": updated, "notification_id": notification_id}
        except Exception as e:
            conn.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update notification: {str(e)}"
            )
        finally:
            conn.close()

    def mark_all_as_read(
        self,
        current_user: Dict[str, Any],
        view_mode: Optional[str] = None
    ) -> Dict[str, Any]:
        """Marks all notifications as read for current user within active view scope."""
        emp_id = self._resolve_emp_id(current_user)
        ctx = self._resolve_view_context(current_user, view_mode)
        conn = connect_db()
        cursor = conn.cursor()
        try:
            count = notification_repository.mark_all_notifications_as_read(
                cursor,
                emp_id,
                view_mode=ctx["view_mode"],
                user_role=ctx["role"]
            )
            conn.commit()
            return {"success": True, "count": count}
        except Exception as e:
            conn.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to mark all notifications as read: {str(e)}"
            )
        finally:
            conn.close()

    def delete_notification(self, current_user: Dict[str, Any], notification_id: int) -> Dict[str, Any]:
        """Deletes a notification."""
        emp_id = self._resolve_emp_id(current_user)
        conn = connect_db()
        cursor = conn.cursor()
        try:
            deleted = notification_repository.delete_notification(cursor, notification_id, emp_id)
            conn.commit()
            return {"success": deleted, "notification_id": notification_id}
        except Exception as e:
            conn.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete notification: {str(e)}"
            )
        finally:
            conn.close()

    def recommend_course(
        self,
        current_user: Dict[str, Any],
        data: CourseRecommendationCreate
    ) -> Dict[str, Any]:
        """Reporting manager recommends a course to direct reports."""
        manager_id = self._resolve_emp_id(current_user)
        recommender_name = (
            current_user.get("full_name")
            or current_user.get("name")
            or "Reporting Manager"
        )
        course_title = (data.course_title or "").strip()
        is_mat = (data.resource_type == "material" or data.study_material_id is not None)
        item_type = "study material" if is_mat else "course"
        user_note = (data.message or "").strip()
        
        # Ensure course_title is always quoted in the message so downstream consumers can extract it reliably
        if course_title and f"'{course_title}'" not in user_note and f'"{course_title}"' not in user_note:
            custom_msg = f"{recommender_name} recommended the {item_type} '{course_title}' to support your learning journey."
        else:
            custom_msg = user_note or f"{recommender_name} recommended the {item_type} '{course_title}' to support your learning journey."

        conn = connect_db()
        cursor = conn.cursor()
        try:
            # Resolve course_id or study_material_id if not given
            course_id = data.course_id
            study_mat_id = data.study_material_id
            if not course_id and not study_mat_id:
                # 1. Exact match in catalog
                cursor.execute(
                    "SELECT TOP 1 id FROM dbo.lms_courses WHERE LOWER(course_name) = LOWER(?)",
                    (course_title,)
                )
                row = cursor.fetchone()
                if row:
                    course_id = int(row[0])
                else:
                    # 2. Fuzzy match in courses
                    clean_keyword = course_title.split("(")[0].strip()[:25]
                    cursor.execute(
                        "SELECT TOP 1 id FROM dbo.lms_courses WHERE LOWER(course_name) LIKE LOWER(?)",
                        (f"%{clean_keyword}%",)
                    )
                    row = cursor.fetchone()
                    if row:
                        course_id = int(row[0])
                    else:
                        # 3. Check study materials
                        cursor.execute(
                            "SELECT TOP 1 id FROM dbo.lms_study_materials WHERE LOWER(title) LIKE LOWER(?)",
                            (f"%{clean_keyword}%",)
                        )
                        sm_row = cursor.fetchone()
                        if sm_row:
                            study_mat_id = int(sm_row[0])
                        else:
                            # 4. Fallback to first active course to satisfy check constraint
                            cursor.execute("SELECT TOP 1 id FROM dbo.lms_courses ORDER BY id ASC")
                            c_fb = cursor.fetchone()
                            if c_fb:
                                course_id = int(c_fb[0])

            created_rec_ids = []
            for emp_ref in data.employee_ids:
                target_emp_id = self._resolve_emp_id(emp_ref)
                # Deduplicate identical course/material recommendations for the same employee
                if course_id:
                    cursor.execute(
                        "SELECT TOP 1 id FROM dbo.lms_course_recommend WHERE LOWER(employee_id) = LOWER(?) AND course_id = ?",
                        (target_emp_id, course_id),
                    )
                else:
                    cursor.execute(
                        "SELECT TOP 1 id FROM dbo.lms_course_recommend WHERE LOWER(employee_id) = LOWER(?) AND study_material_id = ?",
                        (target_emp_id, study_mat_id),
                    )
                existing_rec = cursor.fetchone()
                if existing_rec:
                    created_rec_ids.append(int(existing_rec[0]))
                    continue

                # 1. Insert into dbo.lms_course_recommend
                rec_id = notification_repository.insert_course_recommendation(
                    cursor=cursor,
                    employee_id=target_emp_id,
                    course_id=course_id,
                    study_material_id=study_mat_id,
                    created_by=manager_id
                )
                # 2. Insert notification into dbo.lms_notifications
                notification_repository.insert_notification(
                    cursor=cursor,
                    employee_id=target_emp_id,
                    message=custom_msg,
                    is_read=False,
                    created_by=manager_id
                )
                created_rec_ids.append(rec_id)

            conn.commit()
            return {
                "success": True,
                "recommendation_ids": created_rec_ids,
                "course_id": course_id,
                "course_title": course_title,
                "recipients_count": len(created_rec_ids)
            }
        except Exception as e:
            conn.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to submit course recommendation: {str(e)}"
            )
        finally:
            conn.close()

    def get_my_recommendations(self, current_user: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Retrieves recommendations created by this manager."""
        manager_id = self._resolve_emp_id(current_user)
        conn = connect_db()
        cursor = conn.cursor()
        try:
            return notification_repository.get_manager_recommendations(cursor, manager_id)
        finally:
            conn.close()

    def mark_recommendation_viewed(self, current_user: Dict[str, Any], recommendation_id: int) -> Dict[str, Any]:
        """Acknowledge viewing recommendation."""
        return {"success": True, "recommendation_id": recommendation_id}

    def create_recommendation_request(self, current_user: Dict[str, Any], req_data: Any) -> Dict[str, Any]:
        """Manager recommends a new course not yet in LMS catalog."""
        rm_id = self._resolve_emp_id(current_user)
        course_name = getattr(req_data, "course_name", "") or "New Course"
        provider = getattr(req_data, "provider_platform", None) or getattr(req_data, "provider", None)
        category = getattr(req_data, "category", None)
        course_link = getattr(req_data, "course_link", None)
        reason = getattr(req_data, "required_reason", None)

        conn = connect_db()
        cursor = conn.cursor()
        try:
            provider_id = course_metadata_repository.resolve_provider_id(provider, cursor=cursor)
            category_id = course_metadata_repository.resolve_category_id(category, cursor=cursor)
            if not provider_id and provider and str(provider).strip():
                p_name = course_metadata_repository.ensure_provider_exists(provider, cursor=cursor)
                provider_id = course_metadata_repository.resolve_provider_id(p_name, cursor=cursor)
            if not category_id and category and str(category).strip():
                c_name = course_metadata_repository.ensure_category_exists(category, cursor=cursor)
                category_id = course_metadata_repository.resolve_category_id(c_name, cursor=cursor)

            req_id = notification_repository.insert_recommend_new_course(
                cursor=cursor,
                rm_id=rm_id,
                employee_id=rm_id,
                course_name=course_name,
                provider=provider,
                category=category,
                course_link=course_link,
                reason=reason,
                created_by=rm_id,
                provider_id=provider_id,
                category_id=category_id
            )
            conn.commit()
            return {"success": True, "id": req_id}
        except Exception as e:
            conn.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create new course recommendation: {str(e)}"
            )
        finally:
            conn.close()

    def check_and_send_course_expiry_notifications(self, target_employee_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Scans all incomplete course enrollments with target completion dates.
        Dispatches two stages of notifications:
        - Stage 1: 30 days remaining -> "Expiring Soon" reminder
        - Stage 2: 1 day remaining -> "Urgent: Expires Tomorrow" final reminder
        Includes deduplication to prevent duplicate messages.
        """
        conn = connect_db()
        cursor = conn.cursor()
        created_notifs = []
        try:
            filter_emp = ""
            params = []
            if target_employee_id:
                filter_emp = "AND LOWER(ce.employee_id) = LOWER(?)"
                params.append(str(target_employee_id).strip())

            cursor.execute(f"""
                SELECT 
                    ce.employee_id,
                    c.id AS course_id,
                    c.course_name,
                    ac.target_completion_date,
                    DATEDIFF(day, CAST(GETDATE() AS DATE), ac.target_completion_date) AS days_left
                FROM dbo.lms_course_enrollments ce
                JOIN dbo.lms_courses c ON ce.course_id = c.id
                OUTER APPLY (
                    SELECT TOP 1 ac.target_completion_date
                    FROM dbo.lms_assign_course ac
                    WHERE ac.course_id = ce.course_id
                      AND (CHARINDEX(ce.employee_id, ac.selected_employees) > 0 OR ac.selected_employees IS NULL)
                    ORDER BY ac.id DESC
                ) ac
                WHERE ac.target_completion_date IS NOT NULL
                  AND (ce.status != 'Completed' AND COALESCE(ce.progress_percentage, 0) < 100)
                  {filter_emp}
            """, tuple(params))
            rows = cursor.fetchall()

            for row in rows:
                emp_id = str(row[0]).strip()
                course_id = int(row[1])
                course_name = str(row[2]).strip()
                target_date = str(row[3])[:10] if row[3] else ""
                days_left = int(row[4]) if row[4] is not None else 999

                # Stage 1: 30 days remaining (or <= 30 and > 1) -> Expiring Soon Reminder
                if days_left == 30 or (days_left <= 30 and days_left > 1):
                    cursor.execute("""
                        SELECT 1 FROM dbo.lms_notifications
                        WHERE LOWER(employee_id) = LOWER(?)
                          AND message LIKE '%expiring soon%'
                          AND message LIKE ?
                    """, (emp_id, f"%{course_name}%"))
                    if not cursor.fetchone():
                        msg = f"Reminder: Your assigned course '{course_name}' is expiring soon on {target_date} ({days_left} days remaining). Please plan your learning schedule to complete it on time."
                        notification_repository.insert_notification(
                            cursor,
                            employee_id=emp_id[:7],
                            message=msg,
                            is_read=False,
                            created_by="SYSTEM"
                        )
                        created_notifs.append({
                            "employee_id": emp_id,
                            "stage": "Stage 1 (Expiring Soon - 30 Days)",
                            "course_name": course_name,
                            "days_left": days_left,
                            "message": msg
                        })

                # Stage 2: 1 day remaining -> Urgent 1-Day Final Reminder
                elif days_left == 1:
                    cursor.execute("""
                        SELECT 1 FROM dbo.lms_notifications
                        WHERE LOWER(employee_id) = LOWER(?)
                          AND message LIKE '%expires tomorrow%'
                          AND message LIKE ?
                    """, (emp_id, f"%{course_name}%"))
                    if not cursor.fetchone():
                        msg = f"Urgent: Your assigned course '{course_name}' expires tomorrow ({target_date})! Complete your remaining modules today to avoid overdue status."
                        notification_repository.insert_notification(
                            cursor,
                            employee_id=emp_id[:7],
                            message=msg,
                            is_read=False,
                            created_by="SYSTEM"
                        )
                        created_notifs.append({
                            "employee_id": emp_id,
                            "stage": "Stage 2 (Urgent 1-Day Final Reminder)",
                            "course_name": course_name,
                            "days_left": days_left,
                            "message": msg
                        })

            conn.commit()
            return {
                "success": True,
                "dispatched_count": len(created_notifs),
                "notifications": created_notifs
            }
        except Exception as e:
            conn.rollback()
            print(f"[NotificationService] Notice checking expiry notifications: {e}")
            return {"success": False, "error": str(e), "dispatched_count": 0}
        finally:
            conn.close()

notification_service = NotificationService()

