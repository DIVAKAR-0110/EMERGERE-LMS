"""
Workshops & Training Service.
Provides data management, validation, and analytics for college events and workshops.
Encapsulates business logic and delegates database access to workshop_repository.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime
from fastapi import HTTPException, status
from database.connection import connect_db
from repositories.common.course_metadata_repository import course_metadata_repository
from repositories.ld import workshops_training_repository as workshop_repository


class WorkshopService:
    def get_all(self, search: Optional[str] = None) -> List[Dict[str, Any]]:
        conn = connect_db()
        cursor = conn.cursor()
        try:
            return workshop_repository.get_all_workshops(cursor, search=search)
        finally:
            conn.close()

    def get_unique_departments(self) -> List[str]:
        """
        Discovers unique normalized enterprise departments directly from Microsoft Entra ID (Azure AD).
        """
        unique_depts = set()
        try:
            from services.common.auth_service import employee_service
            employees = employee_service.get_all_employees()
            for e in employees:
                d = (e.get("department") or "").strip()
                if d:
                    unique_depts.add(d)
        except Exception as e:
            print(f"[WorkshopService] Failed to load Azure AD employees for departments: {e}")

        return sorted(list(unique_depts))

        if not unique_depts:
            return ["Software Development", "Data Engineering", "Cybersecurity", "Content Management", "Human Resources"]

        return sorted(list(unique_depts))

    def get_stats(self) -> Dict[str, Any]:
        conn = connect_db()
        cursor = conn.cursor()
        try:
            return workshop_repository.get_workshop_stats(cursor)
        finally:
            conn.close()

    def get_by_id(self, workshop_id: int) -> Dict[str, Any]:
        conn = connect_db()
        cursor = conn.cursor()
        try:
            row = workshop_repository.get_workshop_by_id(cursor, workshop_id)
            if not row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Workshop with ID {workshop_id} not found"
                )
            return row
        finally:
            conn.close()

    def create(self, data: Dict[str, Any], created_by: Optional[str] = None) -> Dict[str, Any]:
        event_name = (data.get("event_name") or "").strip()
        event_category = (data.get("event_category") or "Workshop").strip()
        department = (data.get("department") or "").strip() or None
        start_date_str = data.get("start_date")
        end_date_str = data.get("end_date")
        participants_count = int(data.get("participants_count") or 0)
        event_type = (data.get("event_type") or "Paid").strip()
        actual_spent = float(data.get("actual_spent") or 0.0)

        if not event_name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Event name is required")
        if not event_category:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Event category is required")
        if not start_date_str:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Start date is required")
        if participants_count < 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Participants count cannot be negative")
        
        # Enforce zero spend for Unpaid events
        if event_type.lower() == "unpaid":
            actual_spent = 0.0
        elif actual_spent < 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Actual spent cannot be negative")

        # Validate date range
        try:
            s_date = datetime.strptime(str(start_date_str)[:10], "%Y-%m-%d").date()
            e_date = datetime.strptime(str(end_date_str)[:10], "%Y-%m-%d").date() if end_date_str and str(end_date_str).strip() else None
            if e_date and e_date < s_date:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="End date must be on or after start date")
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid date format. Expected YYYY-MM-DD")

        conn = connect_db()
        cursor = conn.cursor()
        try:
            from database.connection import is_sql_server
            from utils.idempotency import is_unique_violation

            lock_hint = " WITH (UPDLOCK, HOLDLOCK)" if is_sql_server() else ""
            cursor.execute(
                f"""
                SELECT TOP 1 id FROM dbo.lms_workshops_training{lock_hint}
                WHERE LOWER(LTRIM(RTRIM(event_name))) = LOWER(?)
                  AND start_date = ?
                  AND LOWER(LTRIM(RTRIM(COALESCE(department, '')))) = LOWER(?)
                """,
                (event_name, s_date.isoformat(), department or ""),
            )
            if cursor.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Event '{event_name}' on {s_date.isoformat()} already exists.",
                )

            if event_category.lower() not in {"workshop", "training"}:
                event_category = course_metadata_repository.ensure_category_exists(
                    event_category, cursor=cursor, default="Workshop"
                )

            insert_payload = {
                "event_name": event_name,
                "event_category": event_category,
                "department": department,
                "start_date": s_date.isoformat(),
                "end_date": e_date.isoformat() if e_date else None,
                "participants_count": participants_count,
                "event_type": event_type,
                "actual_spent": actual_spent,
            }
            new_id = workshop_repository.insert_workshop(cursor, insert_payload, created_by=created_by)
            conn.commit()
            return workshop_repository.get_workshop_by_id(cursor, new_id)
        except Exception as e:
            conn.rollback()
            if isinstance(e, HTTPException):
                raise e
            if is_unique_violation(e):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Event '{event_name}' on {s_date.isoformat()} already exists.",
                )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create workshop: {str(e)}"
            )
        finally:
            conn.close()

    def update(self, workshop_id: int, data: Dict[str, Any], updated_by: Optional[str] = None) -> Dict[str, Any]:
        existing = self.get_by_id(workshop_id)
        if not existing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Workshop {workshop_id} not found")

        event_name = (data.get("event_name") if "event_name" in data else existing.get("event_name") or "").strip()
        event_category = (data.get("event_category") if "event_category" in data else existing.get("event_category") or "Workshop").strip()
        department = (data.get("department") if "department" in data else existing.get("department"))
        if department:
            department = department.strip() or None
        start_date_str = data.get("start_date") if "start_date" in data else existing.get("start_date")
        end_date_str = data.get("end_date") if "end_date" in data else existing.get("end_date")
        participants_count = int(data.get("participants_count") if "participants_count" in data else existing.get("participants_count") or 0)
        event_type = (data.get("event_type") if "event_type" in data else existing.get("event_type") or "Paid").strip()
        actual_spent = float(data.get("actual_spent") if "actual_spent" in data else existing.get("actual_spent") or 0.0)

        if not event_name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Event name is required")
        if not event_category:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Event category is required")
        if not start_date_str:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Start date is required")
        if participants_count < 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Participants count cannot be negative")
        
        if event_type.lower() == "unpaid":
            actual_spent = 0.0
        elif actual_spent < 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Actual spent cannot be negative")

        try:
            s_date = datetime.strptime(str(start_date_str)[:10], "%Y-%m-%d").date()
            e_date = datetime.strptime(str(end_date_str)[:10], "%Y-%m-%d").date() if end_date_str and str(end_date_str).strip() else None
            if e_date and e_date < s_date:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="End date must be on or after start date")
        except ValueError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid date format. Expected YYYY-MM-DD")

        conn = connect_db()
        cursor = conn.cursor()
        try:
            if event_category.lower() not in {"workshop", "training"}:
                event_category = course_metadata_repository.ensure_category_exists(
                    event_category, cursor=cursor, default="Workshop"
                )
            update_payload = {
                "event_name": event_name,
                "event_category": event_category,
                "department": department,
                "start_date": s_date.isoformat(),
                "end_date": e_date.isoformat() if e_date else None,
                "participants_count": participants_count,
                "event_type": event_type,
                "actual_spent": actual_spent,
            }
            workshop_repository.update_workshop(cursor, workshop_id, update_payload, updated_by=updated_by)
            conn.commit()
            return workshop_repository.get_workshop_by_id(cursor, workshop_id)
        except Exception as e:
            conn.rollback()
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update workshop: {str(e)}"
            )
        finally:
            conn.close()

    def delete(self, workshop_id: int) -> Dict[str, Any]:
        existing = self.get_by_id(workshop_id)
        if not existing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Workshop {workshop_id} not found")

        conn = connect_db()
        cursor = conn.cursor()
        try:
            workshop_repository.delete_workshop(cursor, workshop_id)
            conn.commit()
            return {"success": True, "message": f"Workshop {workshop_id} deleted successfully"}
        except Exception as e:
            conn.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete workshop: {str(e)}"
            )
        finally:
            conn.close()


workshop_service = WorkshopService()

workshops_training_service = workshop_service
