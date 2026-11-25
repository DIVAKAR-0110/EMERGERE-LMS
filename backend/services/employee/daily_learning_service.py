"""
Daily Learning Service.
Business logic orchestrating employee daily learning logs,
duration conversions, mathematical points generation, and course progress tracking.
Directly integrated with dbo.lms_learning_logs, dbo.lms_courses, and dbo.lms_course_enrollments.
"""

import re
from typing import List, Dict, Any, Optional
from datetime import datetime
from fastapi import HTTPException, status

from database.connection import connect_db
from repositories.employee import daily_learning_repository
from services.common.auth_service import employee_service

MAX_LEARNING_NOTES_LENGTH = daily_learning_repository.MAX_LEARNING_NOTES_LENGTH


def _validate_learning_description(description: str) -> str:
    """Normalizes repeated spaces/tabs to a single space and enforces max character limit."""
    text = str(description or "").replace("\r\n", "\n").replace("\r", "\n").replace("\t", " ")
    text = re.sub(r" {2,}", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\n{2,}", "\n", text).strip()
    if len(text) > MAX_LEARNING_NOTES_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Learning description cannot exceed {MAX_LEARNING_NOTES_LENGTH} characters."
        )
    return text

def parse_duration_to_minutes(dur_val: Any) -> int:
    """Converts a duration value (minutes as int or string like '2h 30m') into integer minutes."""
    if not dur_val:
        return 150
    if isinstance(dur_val, int):
        return dur_val
    s = str(dur_val).strip()
    h_match = re.search(r'(\d+)\s*(?:h|hr|hrs|hours)', s, re.I)
    m_match = re.search(r'(\d+)\s*(?:m|min|mins|minutes)', s, re.I)
    hours = int(h_match.group(1)) if h_match else 0
    mins = int(m_match.group(1)) if m_match else 0
    if not h_match and not m_match:
        nums = re.findall(r'\d+', s)
        if nums:
            hours = int(nums[0])
    tot = hours * 60 + mins
    return tot if tot > 0 else 150

def format_duration_string(hours: int, minutes: int) -> str:
    """Formats duration into decimal hours or minutes badge string (e.g. 1h 20m -> 1.2h, 1h 30m -> 1.5h, 4h, 10m)."""
    if minutes == 30:
        return f"{hours}.5h" if hours > 0 else "0.5h"
    if hours > 0 and minutes > 0:
        if minutes == 20:
            return f"{hours}.2h"
        elif minutes == 10:
            return f"{hours}.1h"
        elif minutes == 40:
            return f"{hours}.4h"
        elif minutes == 15:
            return f"{hours}.25h"
        elif minutes == 45:
            return f"{hours}.75h"
        elif minutes % 10 == 0:
            return f"{hours}.{minutes // 10}h"
        else:
            dec = round(hours + minutes / 60.0, 1)
            dec_str = f"{dec}".rstrip('0').rstrip('.')
            return f"{dec_str}h"
    if hours > 0:
        return f"{hours}h"
    return f"{minutes}m"

class DailyLearningService:
    def calculate_points(
        self,
        video_min: int,
        practice_min: int,
        video_rate: int = 20,
        practice_rate: int = 10
    ) -> Dict[str, Any]:
        """
        Calculates learning points mathematically:
        - video_points = (video_min * video_rate) / 60.0
        - practice_points = (practice_min * practice_rate) / 60.0
        - total_points = round(video_points + practice_points)
        """
        v_min = max(0, int(video_min or 0))
        p_min = max(0, int(practice_min or 0))

        v_rate = max(0, int(video_rate or 20))
        p_rate = max(0, int(practice_rate or 10))

        video_pts = (v_min * v_rate) / 60.0
        practice_pts = (p_min * p_rate) / 60.0
        total_pts = round(video_pts + practice_pts)

        return {
            "video_min": v_min,
            "practice_min": p_min,
            "video_points": round(video_pts, 2),
            "practice_points": round(practice_pts, 2),
            "total_points": int(total_pts)
        }

    def calculate_progress(
        self,
        cursor,
        emp_id: str,
        course_id: int,
        session_video_min: int,
        exclude_log_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Calculates course progress mathematically:
        1. Retrieves total duration from dbo.lms_courses.
        2. Computes cumulative prior video minutes for this (emp_id, course_id).
        3. Total video minutes = prior + session.
        4. Progress % = min(100.0, round((total / course_duration) * 100, 2)).
        """
        cursor.execute("SELECT duration_minutes, course_name FROM dbo.lms_courses WHERE id = ?", (course_id,))
        c_row = cursor.fetchone()
        duration_val = c_row[0] if c_row and c_row[0] else 150
        course_title = c_row[1] if c_row and c_row[1] else "Course"
        course_min = parse_duration_to_minutes(duration_val)

        prior_video_min = daily_learning_repository.get_cumulative_video_minutes(
            cursor, emp_id=emp_id, course_id=course_id, exclude_log_id=exclude_log_id
        )

        session_min = max(0, int(session_video_min or 0))
        total_video_min = prior_video_min + session_min

        if course_min <= 0:
            progress = 0.00
        else:
            raw_prog = (total_video_min / float(course_min)) * 100.0
            # ENR-YYYY-023: Prevent floating-point arithmetic rounding down 99.8% to 99%, ensuring completion badge triggers
            if raw_prog >= 99.5 or total_video_min >= course_min:
                progress = 100.00
            else:
                progress = round(min(100.0, raw_prog), 2)

        return {
            "course_id": course_id,
            "course_title": course_title,
            "course_duration": f"{course_min // 60}h {course_min % 60}m" if course_min >= 60 else f"{course_min}m",
            "course_duration_min": course_min,
            "prior_video_min": prior_video_min,
            "session_video_min": session_min,
            "total_video_min": total_video_min,
            "progress": progress
        }

    def _resolve_emp_id(self, current_user: Any) -> str:
        """Extracts clean employee_id (e.g. 'EMP018') without requiring legacy profile lookup."""
        if isinstance(current_user, dict):
            emp_id = current_user.get("employee_id")
            if emp_id:
                return str(emp_id).strip()
            email = current_user.get("work_email") or current_user.get("email")
            if email:
                emp = employee_service.get_employee_by_email(email)
                if emp and emp.get("employee_id"):
                    return str(emp["employee_id"]).strip()
            oid = current_user.get("microsoft_object_id") or current_user.get("oid")
            if oid:
                emp = employee_service.get_employee_by_id(oid)
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
            emp = employee_service.get_employee_by_id(identifier)
            if emp and emp.get("employee_id"):
                return str(emp["employee_id"]).strip()
            return identifier

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user employee_id is required.",
        )

    def _resolve_course_id(self, cursor, course_id_or_title: Any) -> tuple[int, str]:
        """Resolves course id and course_name from dbo.lms_courses."""
        if course_id_or_title:
            if isinstance(course_id_or_title, int) or (isinstance(course_id_or_title, str) and course_id_or_title.isdigit()):
                c_id = int(course_id_or_title)
                cursor.execute("SELECT id, course_name FROM dbo.lms_courses WHERE id = ?", (c_id,))
                row = cursor.fetchone()
                if row:
                    return int(row[0]), str(row[1])
            else:
                title_str = str(course_id_or_title).strip()
                cursor.execute(
                    "SELECT TOP 1 id, course_name FROM dbo.lms_courses WHERE LOWER(course_name) = LOWER(?)",
                    (title_str,)
                )
                row = cursor.fetchone()
                if row:
                    return int(row[0]), str(row[1])
                # Partial match
                cursor.execute(
                    "SELECT TOP 1 id, course_name FROM dbo.lms_courses WHERE LOWER(course_name) LIKE LOWER(?)",
                    (f"%{title_str}%",)
                )
                row = cursor.fetchone()
                if row:
                    return int(row[0]), str(row[1])

        # Fallback to first course in catalog
        cursor.execute("SELECT TOP 1 id, course_name FROM dbo.lms_courses ORDER BY id ASC")
        fallback_row = cursor.fetchone()
        if fallback_row:
            return int(fallback_row[0]), str(fallback_row[1])

        return 1, "General Learning Activity"

    def create_learning_log(
        self,
        current_user: Any,
        payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Converts hours + minutes to total minutes, computes points mathematically,
        and saves to dbo.lms_learning_logs.
        """
        v_h = int(payload.get("video_hours") or payload.get("videoHours") or 0)
        v_m = int(payload.get("video_minutes") or payload.get("videoMinutes") or 0)
        video_duration_min = int(payload.get("video_learning_duration_min") or payload.get("video_duration_minutes") or (v_h * 60 + v_m))

        p_h = int(payload.get("practice_hours") or payload.get("practiceHours") or 0)
        p_m = int(payload.get("practice_minutes") or payload.get("practiceMinutes") or 0)
        practice_duration_min = int(payload.get("practice_handson_min") or payload.get("practice_duration_minutes") or (p_h * 60 + p_m))

        total_min = video_duration_min + practice_duration_min
        if total_min <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Total learning duration must be greater than 0 minutes."
            )
        if total_min > 12 * 60:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Total combined duration cannot exceed 12 hours per day."
            )

        video_rate = int(payload.get("video_learning_point") or 20)
        practice_rate = int(payload.get("practice_handson_point") or 10)

        calc = self.calculate_points(
            video_min=video_duration_min,
            practice_min=practice_duration_min,
            video_rate=video_rate,
            practice_rate=practice_rate
        )
        total_points = calc["total_points"]

        description = _validate_learning_description(
            (payload.get("learning_description") or payload.get("description") or payload.get("learning_notes") or "").strip()
        )

        conn = connect_db()
        cursor = conn.cursor()
        try:
            from database.connection import is_sql_server

            emp_id = self._resolve_emp_id(current_user)
            course_target = payload.get("course_id") or payload.get("course") or payload.get("title")
            course_id, course_title = self._resolve_course_id(cursor, course_target)

            # Enforce unified 12-hour daily limit across Video Learning Duration and Practice & Hands-on combined
            today_cats = daily_learning_repository.get_daily_category_minutes(cursor, emp_id)
            already_total_min = today_cats["total_video_min"] + today_cats["total_practice_min"]

            if (already_total_min + total_min) > 12 * 60:
                rem_total = max(0, 12 * 60 - already_total_min)
                rem_h = rem_total // 60
                rem_m = rem_total % 60
                already_h = already_total_min // 60
                already_m = already_total_min % 60
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Daily learning limit of 12 hours in total exceeded. "
                        f"You have already logged {already_h}h {already_m}m today; "
                        f"you can only log up to {rem_h}h {rem_m}m more across video and practice today."
                    )
                )

            calc_prog = self.calculate_progress(
                cursor=cursor,
                emp_id=emp_id,
                course_id=course_id,
                session_video_min=video_duration_min
            )
            progress_pct = calc_prog["progress"]

            log_id = daily_learning_repository.insert_daily_learning(
                cursor=cursor,
                emp_id=emp_id,
                course_id=course_id,
                video_learning_duration_min=video_duration_min,
                practice_handson_min=practice_duration_min,
                learning_description=description,
                video_learning_point=video_rate,
                practice_handson_point=practice_rate,
                total_points=total_points,
                progress=progress_pct,
                created_by=emp_id
            )

            # Synchronize progress to dbo.lms_course_enrollments
            daily_learning_repository.sync_employee_course_progress(
                cursor=cursor,
                emp_id=emp_id,
                course_id=course_id,
                progress=progress_pct,
                total_video_min=calc_prog["total_video_min"]
            )

            # Model B: Sync slot progress and auto-release on 100% completion
            try:
                from services.common.slot_service import slot_service
                cursor.execute(
                    "SELECT id FROM dbo.lms_course_enrollments WHERE employee_id = ? AND course_id = ?",
                    (emp_id, course_id)
                )
                enr_r = cursor.fetchone()
                if enr_r:
                    slot_service.update_slot_progress(
                        enrollment_id=enr_r[0],
                        progress_percentage=progress_pct,
                        cursor=cursor,
                        conn=conn
                    )
            except Exception as se:
                print(f"[DailyLearningService] Notice updating slot progress: {se}")

            # Recompute and record leaderboard snapshots in dbo.lms_leaderboard_snapshots
            try:
                from repositories.employee import leaderboard_repository
                leaderboard_repository.recompute_and_record_snapshots(cursor, triggered_by_emp_id=emp_id)
            except Exception as e_snap:
                print(f"[create_learning_log] Warning: Leaderboard snapshot recomputation failed: {e_snap}")

            conn.commit()

            now = datetime.now()
            tot_h = total_min // 60
            tot_m = total_min % 60
            formatted_duration = format_duration_string(tot_h, tot_m)

            return {
                "success": True,
                "id": f"log-{log_id}",
                "daily_learning_id": log_id,
                "emp_id": emp_id,
                "employee_id": emp_id,
                "course_id": course_id,
                "course_name": course_title,
                "course_title": course_title,
                "title": course_title,
                "date": now.strftime("%d %b"),
                "time": now.strftime("%I:%M %p"),
                "duration": formatted_duration,
                "video_learning_duration_min": video_duration_min,
                "practice_handson_min": practice_duration_min,
                "total_duration_min": total_min,
                "videoHours": video_duration_min // 60,
                "videoMinutes": video_duration_min % 60,
                "practiceHours": practice_duration_min // 60,
                "practiceMinutes": practice_duration_min % 60,
                "learning_hours": video_duration_min // 60,
                "learning_minutes": video_duration_min % 60,
                "progress": progress_pct,
                "course_duration": calc_prog["course_duration"],
                "course_duration_min": calc_prog["course_duration_min"],
                "description": description or "Learning activity",
                "learning_notes": description or "Learning activity",
                "topic": description or "Learning activity",
                "video_learning_point": video_rate,
                "practice_handson_point": practice_rate,
                "video_points": calc["video_points"],
                "practice_points": calc["practice_points"],
                "total_points": total_points,
                "created_at": now.strftime("%Y-%m-%d %H:%M:%S")
            }
        except HTTPException:
            conn.rollback()
            raise
        except Exception as e:
            conn.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to record daily learning: {str(e)}"
            )
        finally:
            conn.close()

    def get_logs_for_employee(
        self,
        current_user: Any,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Retrieves and formats learning logs for both employee page and manager team logs."""
        conn = connect_db()
        cursor = conn.cursor()
        try:
            emp_id = self._resolve_emp_id(current_user)
            raw_logs = daily_learning_repository.get_daily_learnings(cursor, emp_id, limit)

            formatted = []
            for r in raw_logs:
                dt = None
                display_dt_str = r.get("created_at") or r.get("updated_at")
                if display_dt_str:
                    try:
                        dt = datetime.strptime(str(display_dt_str)[:19], "%Y-%m-%d %H:%M:%S")
                    except Exception:
                        pass

                date_str = dt.strftime("%d %b") if dt else "Today"
                date_full_str = dt.strftime("%Y-%m-%d") if dt else datetime.now().strftime("%Y-%m-%d")
                time_str = dt.strftime("%I:%M %p") if dt else "12:00 PM"

                v_min = r.get("video_duration_minutes") or r.get("video_learning_duration_min") or 0
                p_min = r.get("practice_duration_minutes") or r.get("practice_handson_min") or 0
                tot_m = v_min + p_min
                h = tot_m // 60
                m = tot_m % 60
                dur_str = format_duration_string(h, m)

                notes = r.get("learning_notes") or r.get("learning_description") or ""

                calc = self.calculate_points(video_min=v_min, practice_min=p_min)
                pts_val = r.get("points") if r.get("points") is not None else (r.get("total_points") if r.get("total_points") is not None else calc["total_points"])

                formatted.append({
                    "id": f"log-{r['daily_learning_id']}",
                    "daily_learning_id": r["daily_learning_id"],
                    "emp_id": r["emp_id"],
                    "employee_id": r["employee_id"],
                    "course_id": r["course_id"],
                    "course_name": r.get("course_name") or "Course Learning",
                    "course_title": r.get("course_title") or "Course Learning",
                    "title": r.get("course_title") or "Course Learning",
                    "learning_date": date_full_str,
                    "date": date_str,
                    "time": time_str,
                    "duration": dur_str,
                    "hours": dur_str,
                    "learning_hours": h,
                    "learning_minutes": m,
                    "video_learning_duration_min": v_min,
                    "practice_handson_min": p_min,
                    "total_duration_min": tot_m,
                    "videoHours": v_min // 60,
                    "videoMinutes": v_min % 60,
                    "practiceHours": p_min // 60,
                    "practiceMinutes": p_min % 60,
                    "description": notes,
                    "learning_notes": notes,
                    "learning_topic": notes or "Completed lessons",
                    "topic": notes or "Completed lessons",
                    "points": pts_val,
                    "total_points": pts_val,
                    "created_at": r.get("created_at"),
                    "updated_at": r.get("updated_at")
                })

            return formatted
        finally:
            conn.close()

    def get_summary_for_employee(
        self,
        current_user: Any,
        year: Optional[int] = None,
        month: Optional[int] = None
    ) -> Dict[str, Any]:
        """Calculates monthly summary statistics."""
        conn = connect_db()
        cursor = conn.cursor()
        try:
            emp_id = self._resolve_emp_id(current_user)
            now = datetime.now()
            y = year or now.year
            m = month or now.month
            summary = daily_learning_repository.get_daily_learning_summary(cursor, emp_id, y, m)

            tot_min = summary.get("total_learning_min") or 0
            hours_val = round(tot_min / 60.0, 1)

            return {
                "emp_id": emp_id,
                "year": y,
                "month": m,
                "total_logs": summary.get("total_logs") or 0,
                "total_hours": hours_val,
                "total_video_min": summary.get("total_video_min") or 0,
                "total_practice_min": summary.get("total_practice_min") or 0,
                "total_learning_min": tot_min,
                "total_earned_points": summary.get("total_earned_points") or 0,
                "active_days": summary.get("active_days") or 0
            }
        finally:
            conn.close()

    def update_learning_log(
        self,
        current_user: Any,
        daily_learning_id: int,
        payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Updates an existing learning log."""
        conn = connect_db()
        cursor = conn.cursor()
        try:
            emp_id = self._resolve_emp_id(current_user)
            existing = daily_learning_repository.get_daily_learning_by_id(cursor, daily_learning_id)
            if not existing:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Learning log #{daily_learning_id} not found."
                )

            # Enforce 24-hour edit window
            created_val = existing.get("created_at")
            if created_val:
                try:
                    if isinstance(created_val, str):
                        created_dt = datetime.strptime(str(created_val)[:19], "%Y-%m-%d %H:%M:%S")
                    else:
                        created_dt = created_val
                    hours_elapsed = (datetime.now() - created_dt).total_seconds() / 3600.0
                    if hours_elapsed > 24.0:
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail="Learning logs can only be edited within 24 hours of submission."
                        )
                except HTTPException:
                    raise
                except Exception:
                    pass

            # Determine video duration
            if payload.get("video_learning_duration_min") is not None:
                video_duration_min = int(payload["video_learning_duration_min"])
            elif payload.get("video_hours") is not None or payload.get("video_minutes") is not None or payload.get("videoHours") is not None or payload.get("videoMinutes") is not None:
                v_h = int(payload.get("video_hours") or payload.get("videoHours") or 0)
                v_m = int(payload.get("video_minutes") or payload.get("videoMinutes") or 0)
                video_duration_min = v_h * 60 + v_m
            else:
                video_duration_min = existing.get("video_duration_minutes") or 0

            # Determine practice duration
            if payload.get("practice_handson_min") is not None:
                practice_duration_min = int(payload["practice_handson_min"])
            elif payload.get("practice_hours") is not None or payload.get("practice_minutes") is not None or payload.get("practiceHours") is not None or payload.get("practiceMinutes") is not None:
                p_h = int(payload.get("practice_hours") or payload.get("practiceHours") or 0)
                p_m = int(payload.get("practice_minutes") or payload.get("practiceMinutes") or 0)
                practice_duration_min = p_h * 60 + p_m
            else:
                practice_duration_min = existing.get("practice_duration_minutes") or 0

            total_min = video_duration_min + practice_duration_min
            description = _validate_learning_description(
                (payload.get("learning_description") or payload.get("description") or payload.get("learning_notes") or existing.get("learning_notes") or "").strip()
            )

            course_target = payload.get("course_id") or payload.get("course") or payload.get("title") or existing["course_id"]
            course_id, course_title = self._resolve_course_id(cursor, course_target)

            target_emp_id = (existing.get("employee_id") or emp_id).strip()

            # Enforce unified 12-hour daily limit across Video Learning Duration and Practice & Hands-on combined
            log_date_str = str(existing.get("created_at") or "")[:10] if existing.get("created_at") else None
            other_cats = daily_learning_repository.get_daily_category_minutes(
                cursor, target_emp_id, target_date=log_date_str, exclude_log_id=daily_learning_id
            )
            already_other_total = other_cats["total_video_min"] + other_cats["total_practice_min"]

            if (already_other_total + total_min) > 12 * 60:
                rem_total = max(0, 12 * 60 - already_other_total)
                rem_h = rem_total // 60
                rem_m = rem_total % 60
                already_h = already_other_total // 60
                already_m = already_other_total % 60
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Daily learning limit of 12 hours in total exceeded. "
                        f"Other logs on this date total {already_h}h {already_m}m; "
                        f"you can enter at most {rem_h}h {rem_m}m across video and practice."
                    )
                )

            calc_prog = self.calculate_progress(
                cursor=cursor,
                emp_id=target_emp_id,
                course_id=course_id,
                session_video_min=video_duration_min,
                exclude_log_id=daily_learning_id
            )
            progress_pct = calc_prog["progress"]

            calc_pts = self.calculate_points(
                video_min=video_duration_min,
                practice_min=practice_duration_min
            )
            total_points = calc_pts["total_points"]

            daily_learning_repository.update_daily_learning(
                cursor=cursor,
                daily_learning_id=daily_learning_id,
                emp_id=target_emp_id,
                course_id=course_id,
                video_learning_duration_min=video_duration_min,
                practice_handson_min=practice_duration_min,
                learning_description=description,
                total_points=total_points,
                progress=progress_pct,
                updated_by=target_emp_id
            )

            daily_learning_repository.sync_employee_course_progress(
                cursor=cursor,
                emp_id=target_emp_id,
                course_id=course_id,
                progress=progress_pct,
                total_video_min=calc_prog["total_video_min"]
            )

            # Recompute and record leaderboard snapshots in dbo.lms_leaderboard_snapshots
            try:
                from repositories.employee import leaderboard_repository
                leaderboard_repository.recompute_and_record_snapshots(cursor, triggered_by_emp_id=target_emp_id)
            except Exception as e_snap:
                print(f"[update_learning_log] Warning: Leaderboard snapshot recomputation failed: {e_snap}")

            conn.commit()

            tot_h = total_min // 60
            tot_m = total_min % 60
            formatted_duration = format_duration_string(tot_h, tot_m)
            now = datetime.now()
            existing_created_at = existing.get("created_at")
            orig_dt = None
            if existing_created_at:
                try:
                    orig_dt = datetime.strptime(str(existing_created_at)[:19], "%Y-%m-%d %H:%M:%S")
                except Exception:
                    pass
            date_str = orig_dt.strftime("%d %b") if orig_dt else now.strftime("%d %b")
            date_full_str = orig_dt.strftime("%Y-%m-%d") if orig_dt else now.strftime("%Y-%m-%d")
            time_str = orig_dt.strftime("%I:%M %p") if orig_dt else now.strftime("%I:%M %p")

            return {
                "success": True,
                "id": f"log-{daily_learning_id}",
                "daily_learning_id": daily_learning_id,
                "emp_id": target_emp_id,
                "employee_id": target_emp_id,
                "course_id": course_id,
                "title": course_title,
                "course_name": course_title,
                "course_title": course_title,
                "learning_date": date_full_str,
                "date": date_str,
                "time": time_str,
                "duration": formatted_duration,
                "video_learning_duration_min": video_duration_min,
                "practice_handson_min": practice_duration_min,
                "total_duration_min": total_min,
                "videoHours": video_duration_min // 60,
                "videoMinutes": video_duration_min % 60,
                "practiceHours": practice_duration_min // 60,
                "practiceMinutes": practice_duration_min % 60,
                "learning_hours": tot_h,
                "learning_minutes": tot_m,
                "description": description,
                "learning_notes": description,
                "learning_topic": description,
                "topic": description,
                "points": total_points,
                "total_points": total_points,
                "progress": progress_pct,
                "created_at": str(existing_created_at)[:19] if existing_created_at else now.strftime("%Y-%m-%d %H:%M:%S"),
                "updated_at": now.strftime("%Y-%m-%d %H:%M:%S")
            }
        except HTTPException:
            conn.rollback()
            raise
        except Exception as e:
            conn.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update daily learning: {str(e)}"
            )
        finally:
            conn.close()

    def get_approved_courses_for_employee(self, current_user: Any) -> List[Dict[str, Any]]:
        """Retrieves courses for the employee from database catalog."""
        conn = connect_db()
        cursor = conn.cursor()
        try:
            emp_id = self._resolve_emp_id(current_user)
            courses = daily_learning_repository.get_approved_courses_for_employee(
                cursor=cursor,
                employee_id=emp_id
            )
            for c in courses:
                c_dur = c.get("duration") or 150
                c_min = parse_duration_to_minutes(c_dur)
                c["duration_minutes"] = c_min
                h = c_min // 60
                m = c_min % 60
                c["duration"] = f"{h}h {m}m" if h > 0 and m > 0 else (f"{h}h" if h > 0 else f"{m}m")
                c_prog = self.calculate_progress(cursor, emp_id, c["course_id"], session_video_min=0)
                enr_prog = float(c.get("progress_percentage") or 0.0)
                c["current_progress"] = max(c_prog["progress"], enr_prog)
                completed_min = int(c_prog.get("prior_video_min") or 0)
                if completed_min == 0 and enr_prog > 0 and c_min > 0:
                    completed_min = int(round(c_min * (enr_prog / 100.0)))
                c["completed_minutes"] = completed_min
                c["remaining_minutes"] = max(0, c_min - completed_min)
            return courses
        finally:
            conn.close()

daily_learning_service = DailyLearningService()
