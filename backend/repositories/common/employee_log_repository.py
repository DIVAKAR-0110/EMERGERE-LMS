"""
Employee Log Repository.
Data access layer for dbo.lms_employee_logs.
Executes pure parameterized queries tracking login/logout session activity
and day-by-day attendance history.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, date
from database.connection import dictfetchall, dictfetchone, is_sql_server
from repositories.common import profile_repository

def _clean_emp_id(emp_id: Any) -> str:
    raw = str(emp_id or "").strip().upper()
    if raw.isdigit():
        return f"EMP{int(raw):03d}"
    return raw[:7]

def ensure_employee_profile(cursor, employee_id: str) -> str:
    """Ensures employee exists in dbo.lms_employee_profiles to satisfy foreign key."""
    clean_emp = _clean_emp_id(employee_id)
    if clean_emp:
        profile_repository.ensure_or_sync_profile(cursor, clean_emp)
    return clean_emp

def record_login(cursor, employee_id: str, min_gap_minutes: int = 0) -> int:
    """
    Inserts a new session login row into dbo.lms_employee_logs.
    Auto-closes any previous open sessions older than 12 hours.
    If min_gap_minutes > 0 and an active session exists within that window, reuses it.
    Returns the session log ID.
    """
    clean_emp = ensure_employee_profile(cursor, employee_id)
    if not clean_emp:
        return 0

    table = "dbo.lms_employee_logs" if is_sql_server() else "lms_employee_logs"

    # If min_gap_minutes specified, reuse active session if one exists within threshold
    if min_gap_minutes > 0:
        if is_sql_server():
            cursor.execute(f"""
                SELECT TOP 1 id FROM {table}
                WHERE employee_id = ? AND last_logged_out IS NULL
                  AND DATEDIFF(MINUTE, last_logged_in, GETDATE()) < ?
                ORDER BY id DESC
            """, (clean_emp, min_gap_minutes))
        else:
            cursor.execute(f"""
                SELECT id FROM {table}
                WHERE employee_id = ? AND last_logged_out IS NULL
                  AND (strftime('%s', 'now') - strftime('%s', last_logged_in)) < (? * 60)
                ORDER BY id DESC LIMIT 1
            """, (clean_emp, min_gap_minutes))
        existing_row = cursor.fetchone()
        if existing_row and existing_row[0]:
            return int(existing_row[0])

    # 1. Auto-close any stale unclosed sessions from earlier days or > 12h ago
    try:
        if is_sql_server():
            cursor.execute(f"""
                UPDATE {table}
                SET last_logged_out = DATEADD(HOUR, 8, last_logged_in), updated_at = GETDATE()
                WHERE employee_id = ? AND last_logged_out IS NULL 
                  AND DATEDIFF(HOUR, last_logged_in, GETDATE()) >= 12
            """, (clean_emp,))
        else:
            cursor.execute(f"""
                UPDATE {table}
                SET last_logged_out = datetime(last_logged_in, '+8 hours'), updated_at = CURRENT_TIMESTAMP
                WHERE employee_id = ? AND last_logged_out IS NULL
            """, (clean_emp,))
    except Exception as e:
        print(f"[Warning] Failed to auto-close stale sessions for {clean_emp}: {e}")

    # 2. Insert new session
    if is_sql_server():
        cursor.execute(f"""
            INSERT INTO {table} (
                employee_id, last_logged_in, last_logged_out, created_at
            )
            OUTPUT INSERTED.id
            VALUES (?, GETDATE(), NULL, GETDATE());
        """, (clean_emp,))
        row = cursor.fetchone()
        return int(row[0]) if row and row[0] else 0
    else:
        cursor.execute(f"""
            INSERT INTO {table} (
                employee_id, last_logged_in, last_logged_out, created_at
            )
            VALUES (?, CURRENT_TIMESTAMP, NULL, CURRENT_TIMESTAMP);
        """, (clean_emp,))
        return cursor.lastrowid or 0

def record_logout(cursor, employee_id: str) -> bool:
    """
    Updates the active/latest open session for this employee with last_logged_out = GETDATE().
    If all sessions were already closed, updates the most recent session.
    """
    clean_emp = _clean_emp_id(employee_id)
    if not clean_emp:
        return False

    # Check for latest open session
    lock_hint = " WITH (UPDLOCK)" if is_sql_server() else ""
    table = "dbo.lms_employee_logs" if is_sql_server() else "lms_employee_logs"
    now_func = "GETDATE()" if is_sql_server() else "CURRENT_TIMESTAMP"

    cursor.execute(f"""
        SELECT TOP 1 id 
        FROM {table}{lock_hint}
        WHERE employee_id = ? AND last_logged_out IS NULL
        ORDER BY id DESC
    """, (clean_emp,))
    row = cursor.fetchone()

    if row and row[0]:
        session_id = int(row[0])
        cursor.execute(f"""
            UPDATE {table}
            SET last_logged_out = {now_func}, updated_at = {now_func}
            WHERE id = ?
        """, (session_id,))
        return True

    # If no open session, update the most recent session row
    cursor.execute(f"""
        SELECT TOP 1 id 
        FROM {table}{lock_hint}
        WHERE employee_id = ?
        ORDER BY id DESC
    """, (clean_emp,))
    last_row = cursor.fetchone()
    if last_row and last_row[0]:
        session_id = int(last_row[0])
        cursor.execute(f"""
            UPDATE {table}
            SET last_logged_out = {now_func}, updated_at = {now_func}
            WHERE id = ?
        """, (session_id,))
        return True

    return False

def get_daily_logs_for_employee(
    cursor,
    employee_id: str,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Returns aggregated day-by-day login/logout records for an individual employee:
    - log_date (YYYY-MM-DD)
    - day_first_login
    - day_last_logout
    - total_sessions
    - total_duration_minutes
    - day_span_hours
    """
    clean_emp = _clean_emp_id(employee_id)
    table = "dbo.lms_employee_logs" if is_sql_server() else "lms_employee_logs"
    date_cast = "CAST(last_logged_in AS DATE)" if is_sql_server() else "DATE(last_logged_in)"

    query = f"""
        SELECT 
            employee_id,
            {date_cast} AS log_date,
            MIN(last_logged_in) AS day_first_login,
            MAX(last_logged_out) AS day_last_logout,
            COUNT(id) AS total_sessions
        FROM {table}
        WHERE employee_id = ?
    """
    params: List[Any] = [clean_emp]

    if date_from:
        query += f" AND {date_cast} >= ?"
        params.append(date_from)
    if date_to:
        query += f" AND {date_cast} <= ?"
        params.append(date_to)

    query += f" GROUP BY employee_id, {date_cast} ORDER BY log_date DESC"
    cursor.execute(query, tuple(params))
    rows = dictfetchall(cursor)

    results = []
    for r in rows:
        f_in = r.get("day_first_login")
        l_out = r.get("day_last_logout")
        duration_mins = None
        duration_str = "Active"

        if f_in and l_out:
            try:
                if isinstance(f_in, str):
                    f_in_dt = datetime.fromisoformat(f_in.replace("Z", ""))
                else:
                    f_in_dt = f_in
                if isinstance(l_out, str):
                    l_out_dt = datetime.fromisoformat(l_out.replace("Z", ""))
                else:
                    l_out_dt = l_out
                diff_sec = (l_out_dt - f_in_dt).total_seconds()
                duration_mins = max(0, int(diff_sec // 60))
                hours = duration_mins // 60
                mins = duration_mins % 60
                duration_str = f"{hours}h {mins}m" if hours > 0 else f"{mins}m"
            except Exception:
                duration_mins = None

        log_d = r.get("log_date")
        log_date_str = log_d.strftime("%Y-%m-%d") if hasattr(log_d, "strftime") else str(log_d or "")

        results.append({
            "employee_id": r.get("employee_id"),
            "log_date": log_date_str,
            "day_first_login": f_in.strftime("%Y-%m-%d %H:%M:%S") if hasattr(f_in, "strftime") else (str(f_in) if f_in else None),
            "day_last_logout": l_out.strftime("%Y-%m-%d %H:%M:%S") if hasattr(l_out, "strftime") else (str(l_out) if l_out else None),
            "total_sessions": r.get("total_sessions", 1),
            "duration_minutes": duration_mins,
            "duration_formatted": duration_str,
            "is_active_today": l_out is None and log_date_str == datetime.now().strftime("%Y-%m-%d")
        })

    return results

def get_all_sessions_for_employee(
    cursor,
    employee_id: str,
    limit: int = 50
) -> List[Dict[str, Any]]:
    """Returns individual login/logout session events for an individual employee."""
    clean_emp = _clean_emp_id(employee_id)
    table = "dbo.lms_employee_logs" if is_sql_server() else "lms_employee_logs"
    top_clause = f"TOP {int(limit)}" if is_sql_server() else ""
    limit_clause = f"LIMIT {int(limit)}" if not is_sql_server() else ""

    query = f"""
        SELECT {top_clause}
            id,
            employee_id,
            last_logged_in,
            last_logged_out,
            created_at,
            updated_at
        FROM {table}
        WHERE employee_id = ?
        ORDER BY id DESC
        {limit_clause}
    """
    cursor.execute(query, (clean_emp,))
    rows = dictfetchall(cursor)

    sessions = []
    for r in rows:
        in_t = r.get("last_logged_in")
        out_t = r.get("last_logged_out")
        dur_mins = None
        if in_t and out_t:
            try:
                t1 = in_t if isinstance(in_t, datetime) else datetime.fromisoformat(str(in_t))
                t2 = out_t if isinstance(out_t, datetime) else datetime.fromisoformat(str(out_t))
                dur_mins = max(0, int((t2 - t1).total_seconds() // 60))
            except Exception:
                dur_mins = None

        sessions.append({
            "id": r.get("id"),
            "employee_id": r.get("employee_id"),
            "last_logged_in": in_t.strftime("%Y-%m-%d %H:%M:%S") if hasattr(in_t, "strftime") else str(in_t),
            "last_logged_out": out_t.strftime("%Y-%m-%d %H:%M:%S") if hasattr(out_t, "strftime") else (str(out_t) if out_t else None),
            "duration_minutes": dur_mins,
            "status": "Completed" if out_t else "Active"
        })
    return sessions

def get_latest_logs_for_all_employees(cursor) -> Dict[str, Dict[str, Any]]:
    """
    Returns a dictionary mapping employee_id (lowercase) to their latest session's
    last_logged_in and last_logged_out timestamps.
    """
    table = "dbo.lms_employee_logs" if is_sql_server() else "lms_employee_logs"
    if is_sql_server():
        query = f"""
            WITH RankedLogs AS (
                SELECT 
                    employee_id,
                    last_logged_in,
                    last_logged_out,
                    ROW_NUMBER() OVER (
                        PARTITION BY employee_id 
                        ORDER BY last_logged_in DESC, id DESC
                    ) AS rn
                FROM {table}
            )
            SELECT employee_id, last_logged_in, last_logged_out
            FROM RankedLogs
            WHERE rn = 1;
        """
    else:
        query = f"""
            SELECT l1.employee_id, l1.last_logged_in, l1.last_logged_out
            FROM {table} l1
            INNER JOIN (
                SELECT employee_id, MAX(id) AS max_id
                FROM {table}
                GROUP BY employee_id
            ) l2 ON l1.id = l2.max_id;
        """
    cursor.execute(query)
    rows = dictfetchall(cursor)

    result = {}
    for r in rows:
        emp = _clean_emp_id(r.get("employee_id"))
        if emp:
            in_t = r.get("last_logged_in")
            out_t = r.get("last_logged_out")
            result[emp.lower()] = {
                "last_logged_in": in_t.isoformat() if hasattr(in_t, "isoformat") else (str(in_t) if in_t else None),
                "last_logged_out": out_t.isoformat() if hasattr(out_t, "isoformat") else (str(out_t) if out_t else None),
            }
    return result

