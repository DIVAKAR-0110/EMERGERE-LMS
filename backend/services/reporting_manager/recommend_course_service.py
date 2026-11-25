"""
Manager Course Recommendation Service.
Orchestrates manager course recommendations, persistent storage in dbo.lms_recommend_new_course,
and targeted notifications in dbo.lms_notifications.
"""

import re
from typing import List, Dict, Any, Optional
from fastapi import HTTPException, status

from database.connection import connect_db
from repositories.reporting_manager import recommend_course_repository as manager_recommendation_repository
from repositories.common import notification_repository
from repositories.common.course_metadata_repository import course_metadata_repository
from services.common.auth_service import employee_service

class ManagerRecommendationService:
    def create_manager_recommendation(
        self,
        current_user: Dict[str, Any],
        payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Creates a manager course recommendation in dbo.lms_recommend_new_course
        and notifies selected employees in dbo.lms_notifications.
        """
        course_name = (payload.get("course_name") or payload.get("title") or "").strip()
        if not course_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Course name is required."
            )

        raw_reason = str(payload.get("reason_for_new_course") or payload.get("reason") or "")
        reason = re.sub(r"\n{2,}", "\n", re.sub(r" *\n *", "\n", re.sub(r" {2,}", " ", raw_reason.replace("\r\n", "\n").replace("\r", "\n").replace("\t", " ")))).strip()[:500]
        if not reason:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Reason for new course is required."
            )

        target_members_input = (
            payload.get("employee_ids")
            or payload.get("selected_member_ids")
            or payload.get("selected_employee_ids")
            or []
        )
        if not isinstance(target_members_input, list):
            target_members_input = [target_members_input] if target_members_input else []

        provider_input = payload.get("provider") or payload.get("provider_platform") or "Udemy"
        category_input = payload.get("category") or payload.get("course_category") or "Development"
        course_link = payload.get("course_link") or payload.get("course_url")
        if course_link and len(course_link) > 255:
            course_link = course_link[:255]

        # Resolve manager identity
        manager_id = (
            payload.get("manager_id")
            or (current_user.get("employee_id") if isinstance(current_user, dict) else None)
        )
        if not manager_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authenticated manager employee_id is required.",
            )
        manager_name = (
            payload.get("manager_name")
            or (current_user.get("name") if isinstance(current_user, dict) else None)
            or "Reporting Manager"
        )

        conn = connect_db()
        cursor = conn.cursor()
        try:
            from database.connection import is_sql_server
            lock_hint = " WITH (UPDLOCK, HOLDLOCK)" if is_sql_server() else ""

            # Resolve normalized provider and category IDs (and canonical names)
            provider_id = course_metadata_repository.resolve_provider_id(
                payload.get("provider_id") or payload.get("provider") or provider_input,
                cursor=cursor
            )
            category_id = course_metadata_repository.resolve_category_id(
                payload.get("category_id") or payload.get("category") or category_input,
                cursor=cursor
            )
            provider_name = course_metadata_repository.ensure_provider_exists(
                provider_id or provider_input, cursor=cursor, default="Udemy"
            )
            category_name = course_metadata_repository.ensure_category_exists(
                category_id or category_input, cursor=cursor, default="Development"
            )
            if not provider_id:
                provider_id = course_metadata_repository.resolve_provider_id(provider_name, cursor=cursor)
            if not category_id:
                category_id = course_metadata_repository.resolve_category_id(category_name, cursor=cursor)

            target_emp_ids = []
            for emp_ref in target_members_input:
                if isinstance(emp_ref, dict):
                    e_code = emp_ref.get("employee_id") or emp_ref.get("id")
                else:
                    e_code = str(emp_ref).strip()
                if e_code and e_code not in target_emp_ids:
                    target_emp_ids.append(e_code)

            if not target_emp_ids:
                target_emp_ids = ["ALL"]

            rec_ids = []
            notified_count = 0

            for emp_id in target_emp_ids:
                cursor.execute(
                    f"""
                    SELECT TOP 1 id FROM dbo.lms_recommend_new_course{lock_hint}
                    WHERE LOWER(rm_id) = LOWER(?)
                      AND LOWER(employee_id) = LOWER(?)
                      AND LOWER(LTRIM(RTRIM(course_name))) = LOWER(?)
                      AND provider_id = ?
                    """,
                    (str(manager_id)[:7], str(emp_id)[:7], course_name[:100], provider_id),
                )
                existing_rec = cursor.fetchone()
                if existing_rec:
                    rec_ids.append(int(existing_rec[0]))
                    continue

                r_id = manager_recommendation_repository.insert_manager_recommended_course(
                    cursor=cursor,
                    manager_id=manager_id,
                    course_name=course_name,
                    provider_name=provider_name,
                    category_name=category_name,
                    course_link=course_link,
                    reason_for_new_course=reason,
                    target_employee_id=emp_id,
                    created_by=manager_id,
                    provider_id=provider_id,
                    category_id=category_id
                )
                rec_ids.append(r_id)

                if emp_id != "ALL":
                    try:
                        notification_repository.insert_notification(
                            cursor=cursor,
                            employee_id=emp_id,
                            message=f"{manager_name} recommended new course '{course_name}' for you. Reason: {reason}",
                            created_by=manager_id
                        )
                        notified_count += 1
                    except Exception as err:
                        print(f"[Warning] Failed to insert notification for {emp_id}: {err}")

            conn.commit()

            return {
                "success": True,
                "recommendation_id": rec_ids[0] if rec_ids else 0,
                "recommendation_ids": rec_ids,
                "course_name": course_name,
                "manager_id": manager_id,
                "manager_name": manager_name,
                "notified_count": notified_count,
                "message": f"Course recommendation submitted and {notified_count} team members notified."
            }
        except HTTPException:
            conn.rollback()
            raise
        except Exception as e:
            conn.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to submit manager course recommendation: {str(e)}"
            )
        finally:
            conn.close()

    def get_all_manager_recommendations(self, manager_id: Optional[Any] = None) -> List[Dict[str, Any]]:
        conn = connect_db()
        cursor = conn.cursor()
        try:
            return manager_recommendation_repository.get_manager_recommended_courses(cursor, manager_id)
        finally:
            conn.close()

manager_recommendation_service = ManagerRecommendationService()

recommend_course_service = manager_recommendation_service
