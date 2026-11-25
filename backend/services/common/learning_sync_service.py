"""
Learning Sync Service.
Synchronizes employee video course learning hours, completion status,
and last accessed timestamps from the browser extension into dbo.lms_course_enrollments.
"""

from typing import Dict, Any, Optional
from datetime import datetime, date
from database.connection import connect_db
from services.common.auth_service import employee_service

class LearningSyncService:
    def sync_learning_session(
        self,
        employee_id: str,
        course_id: int,
        session_seconds: int,
        is_completed: bool = False,
        progress_percentage: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Updates enrollment progress for an employee:
        1. Increments hours_log by session_seconds / 3600.0.
        2. Updates last_accessed to today's date.
        3. Updates progress_percentage and status if completed.
        4. Prints a formatted summary of employee, course, and watch timings to backend console.
        """
        if not employee_id:
            raise ValueError("employee_id is required")
        if not course_id:
            raise ValueError("course_id is required")

        session_hours = round(max(0, session_seconds) / 3600.0, 2)
        emp_clean = str(employee_id).strip().upper()
        today_date = date.today().isoformat()

        conn = connect_db()
        cursor = conn.cursor()
        try:
            # 1. Resolve Employee Name
            emp_info = employee_service.get_employee_by_id(emp_clean) or {}
            emp_name = emp_info.get("name") or emp_info.get("full_name") or emp_info.get("display_name") or emp_clean

            # 2. Resolve Course Name
            cursor.execute("SELECT course_name FROM dbo.lms_courses WHERE id = ?", (course_id,))
            c_row = cursor.fetchone()
            course_name = c_row[0] if c_row else f"Course #{course_id}"

            # 3. Check if enrollment exists (using RTRIM/LTRIM for SQL Server 2008 compatibility)
            cursor.execute("""
                SELECT id, hours_log, progress_percentage, status
                FROM dbo.lms_course_enrollments
                WHERE UPPER(RTRIM(LTRIM(employee_id))) = ? AND course_id = ?
            """, (emp_clean, course_id))
            row = cursor.fetchone()

            if row:
                enr_id = row[0]
                current_hours = row[1] or 0
                current_prog = float(row[2] or 0)
                current_status = row[3] or "In Progress"

                # Calculate updated hours (stored as int in SQL Server 2008)
                added_int_hours = int(round(session_hours)) if session_hours >= 1 else (1 if session_seconds >= 1800 else 0)
                new_hours = current_hours + added_int_hours
                new_status = "Completed" if is_completed else ("In Progress" if current_status != "Completed" else "Completed")
                new_progress = 100.0 if is_completed else (progress_percentage if progress_percentage is not None else current_prog)

                cursor.execute("""
                    UPDATE dbo.lms_course_enrollments
                    SET hours_log = ?,
                        last_accessed = ?,
                        progress_percentage = ?,
                        status = ?,
                        video_status = ?,
                        updated_at = GETDATE()
                    WHERE id = ?
                """, (new_hours, today_date, new_progress, new_status, new_status, enr_id))

                # Model B: Sync slot progress and auto-release on 100% completion
                try:
                    from services.common.slot_service import slot_service
                    slot_service.update_slot_progress(
                        enrollment_id=enr_id,
                        progress_percentage=new_progress,
                        cursor=cursor,
                        conn=conn
                    )
                except Exception as se:
                    print(f"[LearningSync] Notice syncing slot progress: {se}")
            else:
                # Insert new active enrollment record if none existed
                new_status = "Completed" if is_completed else "In Progress"
                new_progress = 100.0 if is_completed else (progress_percentage or 0.0)
                enr_code = f"ENR-{emp_clean}-{course_id}"
                new_hours = int(round(session_hours))

                cursor.execute("""
                    INSERT INTO dbo.lms_course_enrollments (
                        enrollment_code, employee_id, course_id, status, video_status,
                        hours_log, last_accessed, progress_percentage, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, GETDATE(), GETDATE())
                """, (enr_code, emp_clean, course_id, new_status, new_status, new_hours, today_date, new_progress))

            conn.commit()

            # 4. Format Watch Timing
            mins = session_seconds // 60
            secs = session_seconds % 60
            timing_str = f"{mins}m {secs:02d}s"

            # 5. Print formatted banner to Python backend terminal
            print("\n" + "=" * 74)
            print("🎓 [LMS EXTENSION LEARNING SYNC] VIDEO WATCH SESSION RECORDED")
            print("=" * 74)
            print(f"  👤 Employee Name    : {emp_name} ({emp_clean})")
            print(f"  📚 Course Name      : {course_name} (ID: {course_id})")
            print(f"  ⏱️  Active Watch Time : {timing_str} ({session_seconds} seconds)")
            print(f"  📊 Total Hours Log  : {new_hours} hrs")
            print(f"  📅 Date Logged      : {today_date}")
            print(f"  📌 Status           : {new_status} (Progress: {new_progress}%)")
            print("=" * 74 + "\n")

            return {
                "success": True,
                "employee_name": emp_name,
                "employee_id": emp_clean,
                "course_name": course_name,
                "course_id": course_id,
                "session_seconds": session_seconds,
                "active_timing": timing_str,
                "total_hours_log": new_hours,
                "last_accessed": today_date,
                "status": new_status,
                "progress": new_progress,
                "is_completed": is_completed,
                "message": f"Successfully synced {timing_str} for {emp_name} on '{course_name}'"
            }
        except Exception as e:
            conn.rollback()
            print(f"❌ [LMS Extension Sync Error] {str(e)}")
            raise RuntimeError(f"Database error while syncing learning session: {str(e)}")
        finally:
            conn.close()

learning_sync_service = LearningSyncService()
