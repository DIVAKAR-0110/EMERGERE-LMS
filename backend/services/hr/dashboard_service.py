"""
HR Dashboard Service.
Business logic layer for HR Dashboard and Activity Feed.
Orchestrates event clustering, relative timestamps, and persistence.
"""

from datetime import datetime
from typing import Dict, Any, List, Optional
from fastapi import HTTPException, status
from database.connection import connect_db, dictfetchall
from repositories.hr import dashboard_repository as hr_activity_repository


def format_relative_time(dt_val: Optional[Any]) -> str:
    """Formats a datetime into a human-friendly relative time string."""
    if not dt_val:
        return "Recently"
    try:
        now = datetime.now()
        if isinstance(dt_val, str):
            dt_clean = dt_val.replace("Z", "")
            if "T" in dt_clean:
                dt = datetime.fromisoformat(dt_clean)
            else:
                dt = datetime.strptime(dt_clean.split(".")[0], "%Y-%m-%d %H:%M:%S")
        elif isinstance(dt_val, datetime):
            dt = dt_val
        else:
            return "Recently"

        diff_seconds = int((now - dt).total_seconds())
        if diff_seconds < 0:
            return "Just now"
        if diff_seconds < 60:
            return "Just now"
        if diff_seconds < 3600:
            mins = max(1, diff_seconds // 60)
            return f"{mins} min{'s' if mins > 1 else ''} ago"
        if diff_seconds < 86400:
            hours = max(1, diff_seconds // 3600)
            return f"{hours} hour{'s' if hours > 1 else ''} ago"
        if diff_seconds < 172800:
            return "1 day ago"
        days = diff_seconds // 86400
        return f"{days} days ago"
    except Exception:
        return "Recently"


class HRDashboardService:
    def get_activity_feed(self, limit: int = 10) -> Dict[str, Any]:
        """
        Retrieves and clusters events for HR Dashboard activity cards.
        """
        conn = connect_db()
        cursor = conn.cursor()
        try:
            cursor.execute("""
                SELECT TOP 50 id, activity_type, message, created_at, created_by
                FROM dbo.lms_hr_activity_feed
                ORDER BY created_at DESC, id DESC
            """)
            rows = dictfetchall(cursor)

            def get_category(act_type: str) -> Optional[str]:
                act_type = (act_type or "").upper()
                if "ONBOARD" in act_type:
                    return "ONBOARD"
                elif "CLAIM" in act_type or "CERTIF" in act_type:
                    return "CERT"
                elif "COURSE_REIMBURSEMENT" in act_type or "PAYMENT" in act_type:
                    return "PAYMENT"
                elif "REPORT" in act_type:
                    return "REPORT"
                return None

            clusters = []
            for r in rows:
                cat = get_category(r.get("activity_type"))
                if not cat:
                    continue

                raw_dt = r.get("created_at")
                if isinstance(raw_dt, str):
                    try:
                        dt = datetime.fromisoformat(raw_dt)
                    except Exception:
                        dt = None
                else:
                    dt = raw_dt

                if not dt:
                    continue

                matched = None
                for c in clusters:
                    if c["category"] == cat:
                        diff = abs((c["latest_time"] - dt).total_seconds())
                        if diff <= 600:
                            matched = c
                            break

                if matched:
                    matched["count"] += 1
                    matched["items"].append(r)
                    if dt > matched["latest_time"]:
                        matched["latest_time"] = dt
                else:
                    clusters.append({
                        "category": cat,
                        "activity_type": r.get("activity_type"),
                        "count": 1,
                        "latest_time": dt,
                        "items": [r]
                    })

            activities_list = []
            for idx, c in enumerate(clusters[:4]):
                cat = c["category"]
                cnt = c["count"]
                time_str = format_relative_time(c["latest_time"])

                if cat == "CERT":
                    title = f"{cnt} certification{'s' if cnt > 1 else ''} approved"
                    icon_type = "cert"
                    bg_class = "hr-activity-icon-green"
                    alt = "Certifications Approved"
                elif cat == "PAYMENT":
                    title = f"{cnt} reimbursement payment{'s' if cnt > 1 else ''} completed"
                    icon_type = "payment"
                    bg_class = "hr-activity-icon-blue"
                    alt = "Reimbursement Payments"
                elif cat == "REPORT":
                    title = c["items"][0].get("message") or "Monthly learning report generated"
                    icon_type = "report"
                    bg_class = "hr-activity-icon-purple"
                    alt = "Learning Report"
                elif cat == "ONBOARD":
                    title = f"{cnt} new employee{'s' if cnt > 1 else ''} onboarded"
                    icon_type = "employee"
                    bg_class = "hr-activity-icon-orange"
                    alt = "New Employees Onboarded"
                else:
                    title = c["items"][0].get("message") or "Activity recorded"
                    icon_type = "cert"
                    bg_class = "hr-activity-icon-green"
                    alt = "Activity"

                item_msgs = [it.get("message") for it in c["items"] if it.get("message")]
                tooltip = " | ".join(item_msgs[:3]) if item_msgs else title

                activities_list.append({
                    "id": f"act-cluster-{idx}-{c['items'][0].get('id', idx)}",
                    "activity_type": c["activity_type"],
                    "title": title,
                    "time": time_str,
                    "icon_type": icon_type,
                    "bg_class": bg_class,
                    "alt": alt,
                    "tooltip": tooltip,
                    "count": cnt,
                })

            raw_activities = hr_activity_repository.get_recent_hr_activities(cursor, limit=limit)
            return {
                "success": True,
                "activities": activities_list,
                "raw_feed": [
                    {
                        "id": a.get("id"),
                        "activity_type": a.get("activity_type"),
                        "message": a.get("message"),
                        "created_at": a.get("created_at").isoformat() if hasattr(a.get("created_at"), "isoformat") else str(a.get("created_at")),
                        "time": format_relative_time(a.get("created_at"))
                    }
                    for a in raw_activities
                ],
                "total": len(activities_list)
            }
        except Exception as e:
            print(f"[HRService] Error reading activity feed: {e}")
            return {"success": False, "activities": [], "total": 0, "error": str(e)}
        finally:
            conn.close()

    def log_activity(self, activity_type: str, message: str, current_user: Dict[str, Any]) -> Dict[str, Any]:
        """
        Inserts a new event into dbo.lms_hr_activity_feed.
        """
        creator_id = current_user.get("employee_id") if isinstance(current_user, dict) else None
        if not creator_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authenticated user employee_id is required.",
            )
        conn = connect_db()
        cursor = conn.cursor()
        try:
            new_id = hr_activity_repository.insert_hr_activity(
                cursor,
                activity_type=activity_type,
                message=message,
                created_by=creator_id
            )
            conn.commit()
            return {
                "success": True,
                "id": new_id,
                "message": "Activity recorded successfully"
            }
        except Exception as e:
            conn.rollback()
            print(f"[HRService] Error writing activity feed: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to record HR activity: {str(e)}"
            )
        finally:
            conn.close()


hr_dashboard_service = HRDashboardService()

__all__ = ["HRDashboardService", "hr_dashboard_service", "format_relative_time"]

