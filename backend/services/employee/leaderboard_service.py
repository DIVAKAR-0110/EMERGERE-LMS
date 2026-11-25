"""
Leaderboard Service.
Business logic layer managing leaderboard calculations, snapshot generation,
and metrics serving for Employee Leaderboard dashboard dynamically from database records.
"""

from typing import List, Dict, Any, Optional
from database.connection import connect_db
from repositories.employee import leaderboard_repository
from services.common.auth_service import employee_service

class LeaderboardService:
    def _resolve_emp_id(self, current_user: Any) -> str:
        """Extracts clean employee_id (e.g. 'EMP019')."""
        if isinstance(current_user, dict):
            emp_id = (
                current_user.get("employee_id")
                or current_user.get("empId")
                or current_user.get("Emp_Obj_Id")
                or current_user.get("id")
            )
            if emp_id:
                return str(emp_id).strip()
            email = current_user.get("work_email") or current_user.get("email")
            if email:
                emp = employee_service.get_employee_by_email(email)
                if emp and emp.get("employee_id"):
                    return str(emp["employee_id"]).strip()
        elif isinstance(current_user, str):
            identifier = current_user.strip()
            if identifier.upper().startswith("EMP"):
                return identifier.upper()
            if "@" in identifier:
                emp = employee_service.get_employee_by_email(identifier)
                if emp and emp.get("employee_id"):
                    return str(emp["employee_id"]).strip()
            return identifier

        raise ValueError("Authenticated user employee_id is required.")

    def recompute_snapshots(self, triggered_by_emp_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Calculates and saves fresh snapshot records in dbo.lms_leaderboard_snapshots.
        Triggered when daily learning logs are submitted or updated.
        """
        conn = connect_db()
        cursor = conn.cursor()
        try:
            snapshots = leaderboard_repository.recompute_and_record_snapshots(
                cursor,
                triggered_by_emp_id=triggered_by_emp_id
            )
            conn.commit()
            return snapshots
        except Exception as e:
            conn.rollback()
            print(f"[LeaderboardService] Warning: Snapshot computation failed: {e}")
            return []
        finally:
            conn.close()

    def get_leaderboard_data(
        self,
        current_user: Any,
        time_filter: str = "All Time"
    ) -> Dict[str, Any]:
        """
        Returns full leaderboard payload for frontend LeaderBoard page
        dynamically computed from the database based on time_filter ("This Week", "This Month", "All Time"):
        - leaderboard list with isCurrentUser marked
        - userStats for the logged-in user
        - overview statistics
        - department & domain breakdown
        """
        emp_id = self._resolve_emp_id(current_user)

        conn = connect_db()
        cursor = conn.cursor()
        try:
            # 1. Get dynamically ranked rows for the selected time filter
            ranks = leaderboard_repository.get_leaderboard_by_time_filter(cursor, time_filter=time_filter)

            # Mark isCurrentUser
            clean_user = emp_id.lower().strip()
            for item in ranks:
                is_curr = (item["employee_id"].lower().strip() == clean_user)
                item["isCurrentUser"] = is_curr
                item["currentUser"] = is_curr

            # 2. Compute userStats for the current user in this time filter
            user_stats = leaderboard_repository.get_user_stats(cursor, employee_id=emp_id, all_ranks=ranks)

            # 3. Department & domain breakdown for this time filter
            dept_list, dom_list = leaderboard_repository.get_department_and_domain_breakdown(cursor, time_filter=time_filter)

            # 4. Total employees count for company metrics
            all_emps = employee_service.get_all_employees()
            total_employees_count = len(all_emps) or 21

            # 5. Compute dynamic overview statistics from the database
            overview = leaderboard_repository.get_overview_metrics(
                cursor,
                time_filter=time_filter,
                ranks=ranks,
                all_employees_count=total_employees_count
            )

            return {
                "success": True,
                "timeFilter": time_filter,
                "leaderboard": ranks,
                "userStats": user_stats,
                "overview": overview,
                "departments": dept_list,
                "domains": dom_list
            }
        finally:
            conn.close()

leaderboard_service = LeaderboardService()
