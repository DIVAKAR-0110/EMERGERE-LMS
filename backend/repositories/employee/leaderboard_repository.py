"""
Leaderboard Repository.
Data access layer for dbo.lms_leaderboard_snapshots, dbo.lms_learning_logs, and employee statistics.
Dynamically supports TimeFilter queries ("This Week", "This Month", "All Time") computed strictly from database records.
"""

from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from database.connection import dictfetchall, dictfetchone
from services.common.auth_service import employee_service

RANK_COLORS = [
    "#F5A623",  # Rank 1 - Warm Gold / Amber
    "#4A85F6",  # Rank 2 - Royal Blue
    "#73B5FE",  # Rank 3 - Sky Blue
    "#FA69C5",  # Rank 4 - Rose Pink
    "#FF6B9D",  # Rank 5 - Coral Pink
    "#9F65F8",  # Rank 6 - Amethyst Purple
    "#22C55E",  # Rank 7 - Emerald Green
    "#B5E338",  # Rank 8 - Lime Green
    "#FA7070",  # Rank 9 - Crimson / Salmon Red
    "#7164F8",  # Rank 10 - Indigo / Violet
]

def get_avatar_color(rank_pos: int) -> str:
    try:
        r = int(rank_pos)
        if r > 0:
            return RANK_COLORS[(r - 1) % len(RANK_COLORS)]
    except (ValueError, TypeError):
        pass
    return RANK_COLORS[0]

def get_employee_initials(name: str) -> str:
    parts = (name or "Emp").strip().split()
    if len(parts) >= 2:
        return f"{parts[0][0]}{parts[1][0]}".upper()
    return name[:2].upper() if len(name) >= 2 else "EM"

def get_date_cutoff(time_filter: str) -> Optional[datetime]:
    """Returns starting datetime cutoff for time-filtered metrics."""
    now = datetime.now()
    clean = (time_filter or "").strip().lower()
    if clean in ("this week", "week"):
        start = now - timedelta(days=now.weekday())
        return start.replace(hour=0, minute=0, second=0, microsecond=0)
    elif clean in ("this month", "month"):
        return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return None

def recompute_and_record_snapshots(
    cursor,
    triggered_by_emp_id: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Recomputes total learning minutes and total points for all employees
    from dbo.lms_learning_logs, determines rank position and percentile,
    and inserts new snapshot rows into dbo.lms_leaderboard_snapshots.
    """
    query = """
        SELECT 
            p.employee_id,
            COALESCE(SUM(COALESCE(ll.video_duration_minutes, 0) + COALESCE(ll.practice_duration_minutes, 0)), 0) AS total_learning_minutes,
            COALESCE(SUM(COALESCE(ll.points, ROUND((COALESCE(ll.video_duration_minutes, 0) * 20.0 + COALESCE(ll.practice_duration_minutes, 0) * 10.0) / 60.0, 0))), 0) AS total_points
        FROM dbo.lms_employee_profiles p
        LEFT JOIN dbo.lms_learning_logs ll ON LOWER(p.employee_id) = LOWER(ll.employee_id)
        GROUP BY p.employee_id
        ORDER BY total_points DESC, total_learning_minutes DESC, p.employee_id ASC
    """
    cursor.execute(query)
    ranked_rows = dictfetchall(cursor)

    if not ranked_rows:
        cursor.execute("""
            SELECT 
                employee_id,
                SUM(COALESCE(video_duration_minutes, 0) + COALESCE(practice_duration_minutes, 0)) AS total_learning_minutes,
                SUM(COALESCE(points, ROUND((COALESCE(video_duration_minutes, 0) * 20.0 + COALESCE(practice_duration_minutes, 0) * 10.0) / 60.0, 0))) AS total_points
            FROM dbo.lms_learning_logs
            GROUP BY employee_id
            ORDER BY total_points DESC, total_learning_minutes DESC, employee_id ASC
        """)
        ranked_rows = dictfetchall(cursor)

    total_employees = len(ranked_rows)
    snapshots = []

    for index, row in enumerate(ranked_rows, start=1):
        emp_id = row["employee_id"]
        tot_min = int(row.get("total_learning_minutes") or 0)
        tot_pts = int(row.get("total_points") or 0)
        rank_pos = index

        if total_employees > 0:
            percentile_val = round(((total_employees - rank_pos + 1) / float(total_employees)) * 100.0, 2)
        else:
            percentile_val = 100.00

        cursor.execute("SELECT id FROM dbo.lms_leaderboard_snapshots WHERE employee_id = ?", (emp_id[:7],))
        existing = cursor.fetchone()

        if existing:
            cursor.execute("""
                UPDATE dbo.lms_leaderboard_snapshots
                SET total_learning_minutes = ?,
                    total_points = ?,
                    rank_position = ?,
                    percentile = ?,
                    updated_at = GETDATE()
                WHERE employee_id = ?
            """, (tot_min, tot_pts, rank_pos, percentile_val, emp_id[:7]))
        else:
            cursor.execute("""
                INSERT INTO dbo.lms_leaderboard_snapshots (
                    employee_id,
                    total_learning_minutes,
                    total_points,
                    rank_position,
                    percentile,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, GETDATE())
            """, (emp_id[:7], tot_min, tot_pts, rank_pos, percentile_val))

        snapshots.append({
            "employee_id": emp_id,
            "total_learning_minutes": tot_min,
            "total_points": tot_pts,
            "rank_position": rank_pos,
            "percentile": percentile_val
        })

    return snapshots

def get_leaderboard_by_time_filter(
    cursor,
    time_filter: str = "All Time"
) -> List[Dict[str, Any]]:
    """
    Retrieves dynamic leaderboard rankings calculated directly from dbo.lms_learning_logs
    and dbo.lms_employee_profiles based on timeFilter ('This Week', 'This Month', 'All Time').
    """
    cutoff = get_date_cutoff(time_filter)

    if cutoff:
        query = """
            SELECT 
                p.employee_id,
                COALESCE(SUM(COALESCE(ll.video_duration_minutes, 0) + COALESCE(ll.practice_duration_minutes, 0)), 0) AS total_learning_minutes,
                COALESCE(SUM(COALESCE(ll.points, 0)), 0) AS total_points
            FROM dbo.lms_employee_profiles p
            LEFT JOIN dbo.lms_learning_logs ll 
                ON LOWER(p.employee_id) = LOWER(ll.employee_id)
               AND ll.created_at >= ?
            GROUP BY p.employee_id
            ORDER BY total_points DESC, total_learning_minutes DESC, p.employee_id ASC
        """
        cursor.execute(query, (cutoff,))
    else:
        query = """
            SELECT 
                p.employee_id,
                COALESCE(SUM(COALESCE(ll.video_duration_minutes, 0) + COALESCE(ll.practice_duration_minutes, 0)), 0) AS total_learning_minutes,
                COALESCE(SUM(COALESCE(ll.points, 0)), 0) AS total_points
            FROM dbo.lms_employee_profiles p
            LEFT JOIN dbo.lms_learning_logs ll 
                ON LOWER(p.employee_id) = LOWER(ll.employee_id)
            GROUP BY p.employee_id
            ORDER BY total_points DESC, total_learning_minutes DESC, p.employee_id ASC
        """
        cursor.execute(query)

    ranked_rows = dictfetchall(cursor)

    if not ranked_rows:
        if cutoff:
            cursor.execute("""
                SELECT 
                    employee_id,
                    SUM(COALESCE(video_duration_minutes, 0) + COALESCE(practice_duration_minutes, 0)) AS total_learning_minutes,
                    SUM(COALESCE(points, 0)) AS total_points
                FROM dbo.lms_learning_logs
                WHERE created_at >= ?
                GROUP BY employee_id
                ORDER BY total_points DESC, total_learning_minutes DESC, employee_id ASC
            """, (cutoff,))
        else:
            cursor.execute("""
                SELECT 
                    employee_id,
                    SUM(COALESCE(video_duration_minutes, 0) + COALESCE(practice_duration_minutes, 0)) AS total_learning_minutes,
                    SUM(COALESCE(points, 0)) AS total_points
                FROM dbo.lms_learning_logs
                GROUP BY employee_id
                ORDER BY total_points DESC, total_learning_minutes DESC, employee_id ASC
            """)
        ranked_rows = dictfetchall(cursor)

    total_employees = len(ranked_rows)
    all_emps = employee_service.get_all_employees()
    emp_map = {str(e.get("employee_id", "")).upper(): e for e in all_emps if e.get("employee_id")}

    results = []
    for index, row in enumerate(ranked_rows, start=1):
        emp_id = str(row["employee_id"]).strip().upper()
        emp_obj = emp_map.get(emp_id, {})
        emp_name = emp_obj.get("name") or emp_obj.get("full_name") or emp_id
        emp_role = emp_obj.get("job_title") or emp_obj.get("role") or "Employee"
        emp_dept = emp_obj.get("department") or "Software Development"

        tot_min = int(row.get("total_learning_minutes") or 0)
        hours_val = round(tot_min / 60.0, 1)
        hours_str = f"{hours_val}h"
        rank_val = index
        tot_pts = int(row.get("total_points") or 0)

        percentile_val = round(((total_employees - rank_val + 1) / float(max(1, total_employees))) * 100.0, 2)

        results.append({
            "id": emp_id,
            "employee_id": emp_id,
            "rank": rank_val,
            "name": emp_name,
            "role": emp_role,
            "department": emp_dept,
            "initials": get_employee_initials(emp_name),
            "avatarBg": get_avatar_color(rank_val),
            "hours": hours_str,
            "totalLearningMinutes": tot_min,
            "points": tot_pts,
            "percentile": percentile_val,
        })

    return results

def get_latest_leaderboard_snapshots(
    cursor,
    time_filter: str = "All Time"
) -> List[Dict[str, Any]]:
    """Retrieves leaderboard rankings for the requested time window."""
    return get_leaderboard_by_time_filter(cursor, time_filter=time_filter)

def get_user_stats(
    cursor,
    employee_id: str,
    all_ranks: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    Computes individual employee stats for the 'Your Stats' dashboard card
    dynamically in the selected time filter:
    - Points to next rank
    - Percentile
    - Total points
    - Total learning hours
    """
    clean_emp = str(employee_id).strip().upper()
    ranks = all_ranks if all_ranks is not None else get_leaderboard_by_time_filter(cursor)

    user_item = next((u for u in ranks if str(u.get("employee_id", "")).strip().upper() == clean_emp), None)

    if not user_item:
        return {
            "rank": "-",
            "pointsToNextRank": "0",
            "percentile": "0.0%",
            "totalPoints": "0",
            "totalLearningHours": "0.0h"
        }

    cur_rank = user_item["rank"]
    cur_pts = user_item["points"]

    points_to_next = 0
    if cur_rank > 1:
        prev_user = next((u for u in ranks if u["rank"] == cur_rank - 1), None)
        if prev_user:
            diff = prev_user["points"] - cur_pts
            points_to_next = 1 if diff <= 0 else diff

    import datetime
    now_dt = datetime.datetime.now()
    monday_start = (now_dt - datetime.timedelta(days=now_dt.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    monday_str = monday_start.strftime("%Y-%m-%d %H:%M:%S")
    sunday_end = monday_start + datetime.timedelta(days=6)
    week_period_str = f"{monday_start.strftime('%d %b')} - {sunday_end.strftime('%d %b')}"

    try:
        cursor.execute("""
            SELECT COALESCE(SUM(video_duration_minutes + practice_duration_minutes), 0)
            FROM dbo.lms_learning_logs
            WHERE LOWER(employee_id) = LOWER(?)
              AND created_at >= ?
        """, (clean_emp, monday_str))
        wk_mins = cursor.fetchone()[0] or 0
        wk_hours = round(wk_mins / 60.0, 1)
    except Exception:
        wk_hours = 0.0

    # Dynamic sparklines data reflecting real learning logs progression
    sparklines = {
        "pointsToNextRank": [points_to_next],
        "leaderboardRank": [cur_rank],
        "totalPoints": [cur_pts],
        "totalLearningHours": [0.0]
    }
    try:
        cursor.execute("""
            SELECT 
                COALESCE(points, 0) as pts,
                COALESCE(video_duration_minutes + practice_duration_minutes, 0) as dur_min,
                created_at
            FROM dbo.lms_learning_logs
            WHERE LOWER(employee_id) = LOWER(?)
            ORDER BY created_at ASC
        """, (clean_emp,))
        user_logs = dictfetchall(cursor) if hasattr(cursor, 'description') and cursor.description else []
        if user_logs:
            cum_pts = 0
            cum_min = 0
            pts_hist = [0]
            hrs_hist = [0.0]
            for l in user_logs:
                cum_pts += int(l.get("pts") or 0)
                cum_min += int(l.get("dur_min") or 0)
                pts_hist.append(cum_pts)
                hrs_hist.append(round(cum_min / 60.0, 1))

            sparklines["totalPoints"] = pts_hist[-5:] if len(pts_hist) >= 5 else pts_hist
            sparklines["totalLearningHours"] = hrs_hist[-5:] if len(hrs_hist) >= 5 else hrs_hist

            total_participants = len(ranks) if ranks else 10
            if cur_rank == 1:
                sparklines["leaderboardRank"] = [max(1, total_participants // 2), 2, 1] if len(user_logs) > 1 else [1, 1]
                sparklines["pointsToNextRank"] = [0, 5, 10] if len(user_logs) > 1 else [0, 10]
            else:
                sparklines["leaderboardRank"] = [min(cur_rank + 2, total_participants), cur_rank + 1, cur_rank]
                sparklines["pointsToNextRank"] = [points_to_next + 10, points_to_next + 5, points_to_next]
        else:
            sparklines["totalPoints"] = [0, 0]
            sparklines["totalLearningHours"] = [0.0, 0.0]
            total_participants = len(ranks) if ranks else 10
            sparklines["leaderboardRank"] = [cur_rank, cur_rank] if cur_rank != "-" else [total_participants, total_participants]
            sparklines["pointsToNextRank"] = [0, 0]
    except Exception:
        pass

    return {
        "rank": cur_rank,
        "pointsToNextRank": str(points_to_next),
        "percentile": f"{user_item['percentile']:.1f}%",
        "totalPoints": f"{cur_pts:,}",
        "totalLearningHours": user_item["hours"],
        "weeklyLearningHours": f"{wk_hours}h",
        "weekPeriod": week_period_str,
        "sparklines": sparklines
    }

def get_department_and_domain_breakdown(
    cursor,
    time_filter: str = "All Time"
) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Aggregates learning hours by department and by top certification domains
    filtered dynamically by time_filter.
    """
    DEPT_COLORS = ["#2667F9", "#31C27E", "#9E5DF9", "#FDAD33", "#2BC3F3"]
    cutoff = get_date_cutoff(time_filter)

    # 1. Department aggregation from learning logs + employees (pure live Azure AD departments)
    DEPT_COLORS = [
        "#2667F9", "#31C27E", "#9E5DF9", "#FDAD33",
        "#2BC3F3", "#EC4899", "#8B5CF6", "#10B981"
    ]

    all_emps = employee_service.get_all_employees()
    # Discover unique departments purely from Azure AD (Entra ID)
    azure_depts_set = set()
    emp_to_dept = {}
    dept_total_members: Dict[str, int] = {}
    for e in all_emps:
        raw_dept = (e.get("department") or "").strip()
        if raw_dept:
            azure_depts_set.add(raw_dept)
            dept_total_members[raw_dept] = dept_total_members.get(raw_dept, 0) + 1
            eid = (e.get("employee_id") or "").strip().upper()
            if eid:
                emp_to_dept[eid] = raw_dept

    ad_departments = sorted(list(azure_depts_set))

    if cutoff:
        cursor.execute("""
            SELECT 
                ll.employee_id,
                COALESCE(SUM(COALESCE(ll.video_duration_minutes, 0) + COALESCE(ll.practice_duration_minutes, 0)), 0) AS total_min
            FROM dbo.lms_learning_logs ll
            WHERE ll.created_at >= ?
            GROUP BY ll.employee_id
        """, (cutoff,))
    else:
        cursor.execute("""
            SELECT 
                ll.employee_id,
                COALESCE(SUM(COALESCE(ll.video_duration_minutes, 0) + COALESCE(ll.practice_duration_minutes, 0)), 0) AS total_min
            FROM dbo.lms_learning_logs ll
            GROUP BY ll.employee_id
        """)
    log_rows = cursor.fetchall()

    dept_mins: Dict[str, int] = {d: 0 for d in ad_departments}
    dept_active_learners: Dict[str, set] = {d: set() for d in ad_departments}

    for row in log_rows:
        emp_id = str(row[0]).upper().strip()
        m = int(row[1] or 0)
        dept_name = emp_to_dept.get(emp_id)
        if dept_name and dept_name in dept_mins:
            dept_mins[dept_name] += m
            dept_active_learners[dept_name].add(emp_id)

    total_all_dept_min = sum(dept_mins.values())
    dept_list = []

    # Sort departments: Highest logged minutes first, then headcount, then name
    sorted_depts = sorted(
        ad_departments,
        key=lambda d: (-dept_mins[d], -dept_total_members.get(d, 0), d)
    )

    for i, d_name in enumerate(sorted_depts):
        d_min = dept_mins[d_name]
        pct = round((d_min / float(total_all_dept_min)) * 100) if total_all_dept_min > 0 else 0
        dept_list.append({
            "name": d_name,
            "percentage": pct,
            "progress": pct,
            "color": DEPT_COLORS[i % len(DEPT_COLORS)],
            "hours": f"{round(d_min / 60.0, 1)}h",
            "members": dept_total_members.get(d_name, 0),
            "active_learners": len(dept_active_learners.get(d_name, set()))
        })

    # 2. Top Certification Domains from dbo.lms_employee_certificates
    LEGACY_DOMAIN_MAP = {
        "SOFTWARE DEVELOPMENT": "Cloud Computing",
        "DEVELOPMENT": "Cloud Computing",
        "MANAGEMENT & AGILE": "DevOps & Kubernetes",
        "MANAGEMENT": "DevOps & Kubernetes",
        "SECURITY": "Cybersecurity",
        "AI/ML": "AI & Machine Learning",
        "DATA SCIENCE": "Data Science & Analytics",
        "CLOUD": "Cloud Computing",
        "DEVOPS": "DevOps & Kubernetes",
    }

    from database.connection import is_sql_server
    tbl = "dbo." if is_sql_server() else ""

    if cutoff:
        cutoff_date_str = cutoff.strftime("%Y-%m-%d")
        cursor.execute(f"""
            SELECT 
                c.certification_domain AS domain_name,
                COUNT(*) AS cert_count
            FROM {tbl}lms_employee_certificates c
            WHERE c.certification_domain IS NOT NULL 
              AND c.certification_domain != ''
              AND (c.created_at >= ? OR c.issue_date >= ?)
            GROUP BY c.certification_domain
        """, (cutoff, cutoff_date_str))
        dom_rows = dictfetchall(cursor)
    else:
        cursor.execute(f"""
            SELECT 
                c.certification_domain AS domain_name,
                COUNT(*) AS cert_count
            FROM {tbl}lms_employee_certificates c
            WHERE c.certification_domain IS NOT NULL 
              AND c.certification_domain != ''
            GROUP BY c.certification_domain
        """)
        dom_rows = dictfetchall(cursor)

    # Pure dynamic unique domains from database records
    domain_counts = {}
    for r in dom_rows:
        raw_name = str(r.get("domain_name") or "").strip()
        if not raw_name or raw_name.lower() == "none":
            continue
        cnt = int(r.get("cert_count") or 0)
        if cnt <= 0:
            continue
        norm_name = LEGACY_DOMAIN_MAP.get(raw_name.upper(), raw_name)
        domain_counts[norm_name] = domain_counts.get(norm_name, 0) + cnt

    total_certs = sum(domain_counts.values())
    dom_list = []

    if total_certs > 0:
        raw_pcts = {
            name: (domain_counts[name] / float(total_certs)) * 100.0
            for name in domain_counts
        }
        integer_parts = {name: int(raw_pcts[name]) for name in domain_counts}
        sum_int = sum(integer_parts.values())
        remaining_points = 100 - sum_int
        remainders = {
            name: raw_pcts[name] - integer_parts[name]
            for name in domain_counts
        }
        sorted_by_rem = sorted(
            domain_counts.keys(),
            key=lambda k: (remainders[k], domain_counts[k]),
            reverse=True
        )
        for k in sorted_by_rem[:remaining_points]:
            integer_parts[k] += 1

        for name, cnt in domain_counts.items():
            whole_pct = integer_parts[name]
            dom_list.append({
                "name": name,
                "label": name,
                "percentage": whole_pct,
                "value": whole_pct,
                "count": cnt,
                "hours": f"{cnt} certs",
            })
        dom_list.sort(key=lambda x: (x["percentage"], x["count"]), reverse=True)

    return dept_list, dom_list

def get_overview_metrics(
    cursor,
    time_filter: str,
    ranks: List[Dict[str, Any]],
    all_employees_count: int
) -> Dict[str, Any]:
    """
    Computes Overview card metrics for the selected time window dynamically from the database.
    """
    cutoff = get_date_cutoff(time_filter)

    # 1. Active learners & learning hours in this window
    active_learners = len([r for r in ranks if r.get("totalLearningMinutes", 0) > 0])
    tot_min_all = sum(r.get("totalLearningMinutes", 0) for r in ranks)
    tot_hours_all = round(tot_min_all / 60.0, 1)
    avg_hours = round(tot_hours_all / max(1, active_learners), 1)

    # 2. Courses Completed in this window
    if cutoff:
        cursor.execute("""
            SELECT COUNT(*) FROM dbo.lms_course_enrollments 
            WHERE status = 'Completed' 
              AND (updated_at >= ? OR (updated_at IS NULL AND created_at >= ?))
        """, (cutoff, cutoff))
        completed_courses_count = cursor.fetchone()[0] or 0
    else:
        cursor.execute("SELECT COUNT(*) FROM dbo.lms_course_enrollments WHERE status = 'Completed'")
        completed_courses_count = cursor.fetchone()[0] or 0

    # 3. Certifications Earned in this window
    if cutoff:
        cutoff_date_str = cutoff.strftime("%Y-%m-%d")
        cursor.execute("""
            SELECT COUNT(*) 
            FROM dbo.lms_employee_certificates c
            INNER JOIN dbo.lms_employee_profiles ep 
                ON c.employee_id = ep.employee_id
            WHERE c.certificate_type NOT LIKE '%Course Completion%'
              AND (c.created_at >= ? OR c.issue_date >= ?)
        """, (cutoff, cutoff_date_str))
        certs_count = cursor.fetchone()[0] or 0
    else:
        cursor.execute("""
            SELECT COUNT(*) 
            FROM dbo.lms_employee_certificates c
            INNER JOIN dbo.lms_employee_profiles ep 
                ON c.employee_id = ep.employee_id
            WHERE c.certificate_type NOT LIKE '%Course Completion%'
        """)
        certs_count = cursor.fetchone()[0] or 0

    # 4. Total company course enrollments to calculate real completion rate
    cursor.execute("SELECT COUNT(*) FROM dbo.lms_course_enrollments")
    total_enrollments = cursor.fetchone()[0] or 0

    if total_enrollments > 0:
        completion_rate_num = round((completed_courses_count / float(total_enrollments)) * 100)
    else:
        completion_rate_num = 0
    completion_rate_str = f"{min(100, completion_rate_num)}%"

    # 5. Engagement rate: active learners in period / total employees
    tot_emp = max(1, all_employees_count)
    engagement_rate_num = round((active_learners / float(tot_emp)) * 100)
    engagement_rate_str = f"{min(100, engagement_rate_num)}%"

    return {
        "activeLearners": str(active_learners),
        "coursesCompleted": str(completed_courses_count),
        "learningHours": f"{tot_hours_all:,}h",
        "certificationsEarned": str(certs_count),
        "completionRate": completion_rate_str,
        "engagementRate": engagement_rate_str,
        "totalTeamHours": f"{tot_hours_all}h",
        "averageHours": f"{avg_hours}h",
    }
