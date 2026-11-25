"""
Daily Learning Repository.
Data access layer for dbo.lms_learning_logs and dbo.lms_courses.
Executes pure parameterized SQL queries without transaction management.
"""

from typing import List, Dict, Any, Optional
from database.connection import dictfetchall, dictfetchone

MAX_LEARNING_NOTES_LENGTH = 250

def insert_daily_learning(
    cursor,
    emp_id: str,
    course_id: Optional[int],
    video_learning_duration_min: int,
    practice_handson_min: int,
    learning_description: Optional[str],
    video_learning_point: int = 20,
    practice_handson_point: int = 10,
    total_points: int = 0,
    progress: float = 0.00,
    created_by: Optional[str] = None
) -> int:
    """Inserts a daily learning log into dbo.lms_learning_logs."""
    query = """
        INSERT INTO dbo.lms_learning_logs (
            employee_id, course_id, video_duration_minutes, practice_duration_minutes,
            learning_notes, points, created_at, created_by, updated_at, updated_by
        )
        VALUES (?, ?, ?, ?, ?, ?, GETDATE(), ?, GETDATE(), ?)
    """
    cursor.execute(
        query,
        (
            emp_id.strip(),
            course_id,
            int(video_learning_duration_min or 0),
            int(practice_handson_min or 0),
            (learning_description or "")[:MAX_LEARNING_NOTES_LENGTH],
            int(total_points or 0),
            (created_by or emp_id).strip(),
            (created_by or emp_id).strip()
        )
    )
    cursor.execute("SELECT @@IDENTITY AS id")
    row = cursor.fetchone()
    return int(row[0]) if row and row[0] else 0

def get_daily_learnings(
    cursor,
    emp_id: str,
    limit: int = 50
) -> List[Dict[str, Any]]:
    """Retrieves all learning logs for an employee joined with course information."""
    query = """
        SELECT 
            ll.id AS daily_learning_id,
            ll.id,
            ll.employee_id AS emp_id,
            ll.employee_id,
            ll.course_id,
            COALESCE(c.course_name, 'General Learning Activity') AS course_name,
            COALESCE(c.course_name, 'General Learning Activity') AS course_title,
            COALESCE(cp.ProviderName, 'Emergere Academy') AS provider,
            COALESCE(c.duration_minutes, 150) AS course_duration_minutes,
            ll.video_duration_minutes,
            ll.video_duration_minutes AS video_learning_duration_min,
            ll.practice_duration_minutes,
            ll.practice_duration_minutes AS practice_handson_min,
            (COALESCE(ll.video_duration_minutes, 0) + COALESCE(ll.practice_duration_minutes, 0)) AS total_duration_min,
            ll.learning_notes,
            ll.learning_notes AS learning_description,
            ll.points,
            ll.points AS total_points,
            CONVERT(VARCHAR(19), ll.created_at, 120) AS created_at,
            CONVERT(VARCHAR(19), ll.updated_at, 120) AS updated_at,
            ll.created_by,
            ll.updated_by
        FROM dbo.lms_learning_logs ll
        LEFT JOIN dbo.lms_courses c ON ll.course_id = c.id
        LEFT JOIN dbo.CourseProviders cp ON c.provider_id = cp.ProviderId
        WHERE LOWER(ll.employee_id) = LOWER(?)
        ORDER BY COALESCE(ll.created_at, ll.updated_at) DESC, ll.id DESC
    """
    cursor.execute(query, (emp_id.strip(),))
    rows = dictfetchall(cursor)
    return rows[:limit] if limit else rows

def get_daily_learning_by_id(
    cursor,
    daily_learning_id: int
) -> Optional[Dict[str, Any]]:
    """Retrieves a single daily learning log by ID."""
    query = """
        SELECT 
            ll.id AS daily_learning_id,
            ll.id,
            ll.employee_id AS emp_id,
            ll.employee_id,
            ll.course_id,
            COALESCE(c.course_name, 'General Learning Activity') AS course_name,
            COALESCE(c.course_name, 'General Learning Activity') AS course_title,
            COALESCE(cp.ProviderName, 'Emergere Academy') AS provider,
            COALESCE(c.duration_minutes, 150) AS course_duration_minutes,
            ll.video_duration_minutes,
            ll.video_duration_minutes AS video_learning_duration_min,
            ll.practice_duration_minutes,
            ll.practice_duration_minutes AS practice_handson_min,
            (COALESCE(ll.video_duration_minutes, 0) + COALESCE(ll.practice_duration_minutes, 0)) AS total_duration_min,
            ll.learning_notes,
            ll.learning_notes AS learning_description,
            ll.points,
            ll.points AS total_points,
            CONVERT(VARCHAR(19), ll.created_at, 120) AS created_at,
            CONVERT(VARCHAR(19), ll.updated_at, 120) AS updated_at,
            ll.created_by,
            ll.updated_by
        FROM dbo.lms_learning_logs ll
        LEFT JOIN dbo.lms_courses c ON ll.course_id = c.id
        LEFT JOIN dbo.CourseProviders cp ON c.provider_id = cp.ProviderId
        WHERE ll.id = ?
    """
    cursor.execute(query, (daily_learning_id,))
    return dictfetchone(cursor)

def update_daily_learning(
    cursor,
    daily_learning_id: int,
    emp_id: str,
    course_id: Optional[int],
    video_learning_duration_min: int,
    practice_handson_min: int,
    learning_description: Optional[str],
    total_points: int = 0,
    progress: Optional[float] = None,
    updated_by: Optional[str] = None
) -> bool:
    """Updates an existing learning log."""
    query = """
        UPDATE dbo.lms_learning_logs
        SET 
            course_id = ?,
            video_duration_minutes = ?,
            practice_duration_minutes = ?,
            learning_notes = ?,
            points = ?,
            updated_at = GETDATE(),
            updated_by = ?
        WHERE id = ? AND LOWER(employee_id) = LOWER(?)
    """
    cursor.execute(
        query,
        (
            course_id,
            int(video_learning_duration_min or 0),
            int(practice_handson_min or 0),
            (learning_description or "")[:MAX_LEARNING_NOTES_LENGTH],
            int(total_points or 0),
            (updated_by or emp_id).strip(),
            daily_learning_id,
            emp_id.strip()
        )
    )
    return bool(cursor.rowcount and cursor.rowcount > 0)

def get_daily_learning_summary(
    cursor,
    emp_id: str,
    year: Optional[int] = None,
    month: Optional[int] = None
) -> Dict[str, Any]:
    """Calculates aggregated summary metrics for employee learning."""
    query = """
        SELECT 
            COUNT(*) AS total_logs,
            COALESCE(SUM(video_duration_minutes), 0) AS total_video_min,
            COALESCE(SUM(practice_duration_minutes), 0) AS total_practice_min,
            COALESCE(SUM(COALESCE(video_duration_minutes, 0) + COALESCE(practice_duration_minutes, 0)), 0) AS total_learning_min,
            COALESCE(SUM(points), 0) AS total_points,
            COUNT(DISTINCT CONVERT(VARCHAR(10), created_at, 120)) AS active_days
        FROM dbo.lms_learning_logs
        WHERE LOWER(employee_id) = LOWER(?)
    """
    params = [emp_id.strip()]
    if year and month:
        query += " AND YEAR(created_at) = ? AND MONTH(created_at) = ?"
        params.extend([year, month])
    elif year:
        query += " AND YEAR(created_at) = ?"
        params.append(year)

    cursor.execute(query, tuple(params))
    row = dictfetchone(cursor)
    if not row:
        return {
            "total_logs": 0,
            "total_video_min": 0,
            "total_practice_min": 0,
            "total_learning_min": 0,
            "total_earned_points": 0,
            "active_days": 0
        }

    v_min = row.get("total_video_min") or 0
    p_min = row.get("total_practice_min") or 0
    calculated_pts = round((v_min * 20.0 / 60.0) + (p_min * 10.0 / 60.0))
    stored_pts = row.get("total_points")
    earned_points = stored_pts if (stored_pts is not None and stored_pts > 0) else calculated_pts
    row["total_earned_points"] = earned_points
    return row

def get_cumulative_video_minutes(
    cursor,
    emp_id: str,
    course_id: int,
    exclude_log_id: Optional[int] = None
) -> int:
    """Returns the cumulative sum of video learning duration in minutes for an employee on a specific course."""
    if exclude_log_id:
        query = """
            SELECT COALESCE(SUM(video_duration_minutes), 0)
            FROM dbo.lms_learning_logs
            WHERE LOWER(employee_id) = LOWER(?) AND course_id = ? AND id != ?
        """
        cursor.execute(query, (emp_id.strip(), course_id, exclude_log_id))
    else:
        query = """
            SELECT COALESCE(SUM(video_duration_minutes), 0)
            FROM dbo.lms_learning_logs
            WHERE LOWER(employee_id) = LOWER(?) AND course_id = ?
        """
        cursor.execute(query, (emp_id.strip(), course_id))
    row = cursor.fetchone()
    return int(row[0]) if row and row[0] else 0

def get_daily_category_minutes(
    cursor,
    emp_id: str,
    target_date: Optional[str] = None,
    exclude_log_id: Optional[int] = None
) -> Dict[str, int]:
    """
    Returns total video learning minutes and practice duration minutes
    logged by an employee on a given calendar date (defaults to current date).
    """
    if exclude_log_id and target_date:
        query = """
            SELECT 
                COALESCE(SUM(video_duration_minutes), 0) AS total_video_min,
                COALESCE(SUM(practice_duration_minutes), 0) AS total_practice_min
            FROM dbo.lms_learning_logs
            WHERE LOWER(employee_id) = LOWER(?)
              AND CAST(created_at AS DATE) = CAST(? AS DATE)
              AND id != ?
        """
        cursor.execute(query, (emp_id.strip(), target_date, exclude_log_id))
    elif exclude_log_id:
        query = """
            SELECT 
                COALESCE(SUM(video_duration_minutes), 0) AS total_video_min,
                COALESCE(SUM(practice_duration_minutes), 0) AS total_practice_min
            FROM dbo.lms_learning_logs
            WHERE LOWER(employee_id) = LOWER(?)
              AND CAST(created_at AS DATE) = CAST(GETDATE() AS DATE)
              AND id != ?
        """
        cursor.execute(query, (emp_id.strip(), exclude_log_id))
    elif target_date:
        query = """
            SELECT 
                COALESCE(SUM(video_duration_minutes), 0) AS total_video_min,
                COALESCE(SUM(practice_duration_minutes), 0) AS total_practice_min
            FROM dbo.lms_learning_logs
            WHERE LOWER(employee_id) = LOWER(?)
              AND CAST(created_at AS DATE) = CAST(? AS DATE)
        """
        cursor.execute(query, (emp_id.strip(), target_date))
    else:
        query = """
            SELECT 
                COALESCE(SUM(video_duration_minutes), 0) AS total_video_min,
                COALESCE(SUM(practice_duration_minutes), 0) AS total_practice_min
            FROM dbo.lms_learning_logs
            WHERE LOWER(employee_id) = LOWER(?)
              AND CAST(created_at AS DATE) = CAST(GETDATE() AS DATE)
        """
        cursor.execute(query, (emp_id.strip(),))

    row = cursor.fetchone()
    if not row:
        return {"total_video_min": 0, "total_practice_min": 0}
    return {
        "total_video_min": int(row[0] or 0),
        "total_practice_min": int(row[1] or 0),
    }

def sync_employee_course_progress(
    cursor,
    emp_id: str,
    course_id: int,
    progress: float,
    total_video_min: int
) -> None:
    """Synchronizes progress and learning hours to dbo.lms_course_enrollments."""
    try:
        prog_val = round(max(0.0, min(100.0, float(progress or 0.0))), 2)
        # ENR-YYYY-023: Prevent floating-point arithmetic evaluating 99.8% to 99%
        if prog_val >= 99.5:
            prog_val = 100.0
        status_val = "Completed" if prog_val >= 100.0 else ("In Progress" if prog_val > 0.0 else "Not Started")
        video_status = "Completed" if prog_val >= 100.0 else ("ON TRACK" if prog_val >= 50.0 else "Low Progress")

        cursor.execute("""
            SELECT id, status FROM dbo.lms_course_enrollments
            WHERE LOWER(employee_id) = LOWER(?) AND course_id = ?
        """, (emp_id.strip(), course_id))
        existing = cursor.fetchone()

        is_newly_completed = False
        if existing:
            prev_status = str(existing[1] or "").strip()
            if status_val == "Completed" and prev_status != "Completed":
                is_newly_completed = True

            cursor.execute("""
                UPDATE dbo.lms_course_enrollments
                SET progress_percentage = ?,
                    hours_log = ?,
                    status = CASE WHEN ? = 'Completed' THEN 'Completed' ELSE (CASE WHEN status = 'Completed' THEN 'Completed' ELSE ? END) END,
                    video_status = ?,
                    last_accessed = CAST(GETDATE() AS DATE)
                WHERE id = ?
            """, (prog_val, total_video_min, status_val, status_val, video_status, existing[0]))
        else:
            if status_val == "Completed":
                is_newly_completed = True
            # Generate enrollment code
            cursor.execute("SELECT COUNT(*) FROM dbo.lms_course_enrollments")
            enr_count = (cursor.fetchone()[0] or 0) + 1
            code = f"ENR-2026-{enr_count:04d}"
            cursor.execute("""
                INSERT INTO dbo.lms_course_enrollments (
                    enrollment_code, employee_id, course_id, status, video_status,
                    hours_log, last_accessed, progress_percentage, created_at, created_by
                )
                VALUES (?, ?, ?, ?, ?, ?, CAST(GETDATE() AS DATE), ?, GETDATE(), ?)
            """, (code, emp_id.strip(), course_id, status_val, video_status, total_video_min, prog_val, emp_id.strip()))

        # Dispatch notification to L&D when course completion is reached
        if is_newly_completed:
            try:
                # 1. Fetch employee name
                emp_name = emp_id.strip()
                try:
                    from services.common.auth_service import employee_service
                    emp_obj = employee_service.get_employee_by_id(emp_id.strip()) or {}
                    emp_name = emp_obj.get("name") or emp_obj.get("full_name") or emp_id.strip()
                except Exception:
                    pass

                # 2. Fetch course title
                cursor.execute("""
                    SELECT course_name FROM dbo.lms_courses
                    WHERE id = ?
                """, (course_id,))
                crow = cursor.fetchone()
                course_title = crow[0] if crow and crow[0] else f"Course #{course_id}"

                # 3. Determine L&D recipients
                ld_recipients = set()
                # Creator/L&D assigned to this course
                cursor.execute("""
                    SELECT DISTINCT ld_id, created_by
                    FROM dbo.lms_assign_course
                    WHERE course_id = ?
                """, (course_id,))
                for a_row in cursor.fetchall():
                    if a_row[0]:
                        ld_recipients.add(str(a_row[0]).strip())
                    if a_row[1]:
                        ld_recipients.add(str(a_row[1]).strip())

                # Active L&D Team members from live directory
                try:
                    from services.common.auth_service import employee_service
                    for eid in employee_service.get_employee_ids_by_role("L&D", "L&D Team"):
                        ld_recipients.add(eid)
                except Exception:
                    pass

                # 4. Dispatch notification to each L&D member
                notif_msg = f"{emp_name} ({emp_id.strip()}) has completed the assigned course '{course_title}'. 1 license seat has been released."
                for ld_emp in ld_recipients:
                    clean_ld = str(ld_emp).strip()[:7]
                    cursor.execute("""
                        SELECT 1 FROM dbo.lms_notifications
                        WHERE employee_id = ? AND message = ?
                    """, (clean_ld, notif_msg))
                    if not cursor.fetchone():
                        from repositories.common import notification_repository
                        notification_repository.insert_notification(
                            cursor,
                            employee_id=clean_ld,
                            message=notif_msg,
                            is_read=False,
                            created_by=emp_id.strip()[:7]
                        )
            except Exception as notif_err:
                print(f"[sync_employee_course_progress] Notification dispatch warning: {notif_err}")
    except Exception as e:
        print(f"[sync_employee_course_progress] Notice: {e}")

def get_approved_courses_for_employee(
    cursor,
    employee_id: str,
    candidate_profile_ids: Optional[List[int]] = None
) -> List[Dict[str, Any]]:
    """
    Returns only individual courses the employee is actively enrolled in
    with status 'Not Started' and 'In Progress' (excluding 'Completed' and un-enrolled courses).
    """
    clean_emp = str(employee_id).strip()
    query = """
        SELECT DISTINCT
            c.id AS course_id,
            c.id,
            c.course_name AS course_title,
            c.course_name,
            COALESCE(cp.ProviderName, 'Emergere Academy') AS provider,
            COALESCE(cc.CategoryName, 'General') AS category,
            COALESCE(c.duration_minutes, 150) AS duration,
            CAST(COALESCE(ce.progress_percentage, 0.0) AS FLOAT) AS progress_percentage,
            ce.status,
            CONVERT(VARCHAR(19), COALESCE(
                (SELECT MAX(COALESCE(ll.updated_at, ll.created_at)) 
                 FROM dbo.lms_learning_logs ll 
                 WHERE LOWER(ll.employee_id) = LOWER(ce.employee_id) AND ll.course_id = c.id),
                ce.updated_at,
                ce.last_accessed,
                ce.created_at
            ), 120) AS last_updated
        FROM dbo.lms_course_enrollments ce
        JOIN dbo.lms_courses c ON ce.course_id = c.id
        LEFT JOIN dbo.CourseProviders cp ON c.provider_id = cp.ProviderId
        LEFT JOIN dbo.CourseCategories cc ON c.category_id = cc.CategoryId
        WHERE LOWER(ce.employee_id) = LOWER(?)
          AND ce.status IN ('Not Started', 'In Progress')
          AND (ce.progress_percentage IS NULL OR ce.progress_percentage < 100.0)
        ORDER BY c.course_name ASC
    """
    cursor.execute(query, (clean_emp,))
    courses = dictfetchall(cursor)
    return courses
