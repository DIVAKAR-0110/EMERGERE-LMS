"""
Workshops & Training Repository.
Data access layer executing pure parameterized SQL queries for dbo.lms_workshops_training.
Supports both Microsoft SQL Server and SQLite fallback.
"""

from typing import List, Dict, Any, Optional
from datetime import datetime, date
from decimal import Decimal
from database.connection import is_sql_server, dictfetchall, dictfetchone


def _get_table_name() -> str:
    return "dbo.lms_workshops_training" if is_sql_server() else "lms_workshops_training"


def get_all_workshops(cursor, search: Optional[str] = None) -> List[Dict[str, Any]]:
    """Retrieves all workshops and training events, optionally filtered by search pattern."""
    tbl = _get_table_name()
    if search and search.strip():
        pattern = f"%{search.strip().lower()}%"
        query = f"""
            SELECT id, event_name, event_category, department, start_date, end_date,
                   participants_count, event_type, actual_spent, created_at, created_by,
                   updated_at, updated_by
            FROM {tbl}
            WHERE LOWER(event_name) LIKE ? 
               OR LOWER(COALESCE(department, '')) LIKE ?
               OR LOWER(COALESCE(event_category, '')) LIKE ?
               OR LOWER(COALESCE(event_type, '')) LIKE ?
            ORDER BY start_date DESC, id DESC
        """
        cursor.execute(query, (pattern, pattern, pattern, pattern))
    else:
        query = f"""
            SELECT id, event_name, event_category, department, start_date, end_date,
                   participants_count, event_type, actual_spent, created_at, created_by,
                   updated_at, updated_by
            FROM {tbl}
            ORDER BY start_date DESC, id DESC
        """
        cursor.execute(query)

    rows = dictfetchall(cursor)
    for r in rows:
        if not r.get("event_category"):
            r["event_category"] = "Training" if "training" in (r.get("event_name") or "").lower() else "Workshop"
        if not r.get("event_type"):
            r["event_type"] = "Paid" if float(r.get("actual_spent") or 0.0) > 0 else "Unpaid"
        if isinstance(r.get("start_date"), (datetime, date)):
            r["start_date"] = r["start_date"].isoformat()
        if isinstance(r.get("end_date"), (datetime, date)):
            r["end_date"] = r["end_date"].isoformat()
        if isinstance(r.get("created_at"), (datetime, date)):
            r["created_at"] = r["created_at"].isoformat()
        if isinstance(r.get("updated_at"), (datetime, date)):
            r["updated_at"] = r["updated_at"].isoformat()
        if isinstance(r.get("actual_spent"), Decimal):
            r["actual_spent"] = float(r["actual_spent"])
        r["actual_spent"] = float(r.get("actual_spent") or 0.0)
    return rows


def get_workshop_by_id(cursor, workshop_id: int) -> Optional[Dict[str, Any]]:
    """Retrieves a single workshop record by primary key ID."""
    tbl = _get_table_name()
    query = f"""
        SELECT id, event_name, event_category, department, start_date, end_date,
               participants_count, event_type, actual_spent, created_at, created_by,
               updated_at, updated_by
        FROM {tbl}
        WHERE id = ?
    """
    cursor.execute(query, (workshop_id,))
    row = dictfetchone(cursor)
    if not row:
        return None

    if not row.get("event_category"):
        row["event_category"] = "Training" if "training" in (row.get("event_name") or "").lower() else "Workshop"
    if not row.get("event_type"):
        row["event_type"] = "Paid" if float(row.get("actual_spent") or 0.0) > 0 else "Unpaid"
    if isinstance(row.get("start_date"), (datetime, date)):
        row["start_date"] = row["start_date"].isoformat()
    if isinstance(row.get("end_date"), (datetime, date)):
        row["end_date"] = row["end_date"].isoformat()
    if isinstance(row.get("created_at"), (datetime, date)):
        row["created_at"] = row["created_at"].isoformat()
    if isinstance(row.get("updated_at"), (datetime, date)):
        row["updated_at"] = row["updated_at"].isoformat()
    if isinstance(row.get("actual_spent"), Decimal):
        row["actual_spent"] = float(row["actual_spent"])
    row["actual_spent"] = float(row.get("actual_spent") or 0.0)
    return row


def get_workshop_stats(cursor) -> Dict[str, Any]:
    """Retrieves aggregate metrics across all workshop and training events."""
    tbl = _get_table_name()
    cursor.execute(f"""
        SELECT 
            COUNT(*) AS total_events,
            SUM(COALESCE(participants_count, 0)) AS total_participants,
            SUM(COALESCE(actual_spent, 0)) AS total_spent,
            SUM(CASE WHEN LOWER(COALESCE(event_type, 'paid')) = 'paid' THEN 1 ELSE 0 END) AS paid_events_count,
            SUM(CASE WHEN LOWER(COALESCE(event_type, 'paid')) = 'paid' THEN COALESCE(participants_count, 0) ELSE 0 END) AS paid_participants_count,
            SUM(CASE WHEN LOWER(COALESCE(event_type, '')) = 'unpaid' THEN 1 ELSE 0 END) AS unpaid_events_count,
            SUM(CASE WHEN LOWER(COALESCE(event_type, '')) = 'unpaid' THEN COALESCE(participants_count, 0) ELSE 0 END) AS unpaid_participants_count
        FROM {tbl}
    """)
    row = dictfetchone(cursor)
    total_events = int(row.get("total_events") or 0) if row else 0
    total_participants = int(row.get("total_participants") or 0) if row else 0
    total_spent_val = float(row.get("total_spent") or 0.0) if row else 0.0
    paid_events_count = int(row.get("paid_events_count") or 0) if row else 0
    paid_participants_count = int(row.get("paid_participants_count") or 0) if row else 0
    unpaid_events_count = int(row.get("unpaid_events_count") or 0) if row else 0
    unpaid_participants_count = int(row.get("unpaid_participants_count") or 0) if row else 0

    cursor.execute(f"SELECT COALESCE(event_category, CASE WHEN LOWER(event_name) LIKE '%training%' THEN 'Training' ELSE 'Workshop' END) FROM {tbl}")
    event_rows = cursor.fetchall()
    workshops_count = 0
    training_count = 0
    for er in event_rows:
        cat = (str(er[0]) if er and er[0] else "").strip().lower()
        if "training" in cat:
            training_count += 1
        else:
            workshops_count += 1

    return {
        "total_events": total_events,
        "workshops_count": workshops_count,
        "training_count": training_count,
        "total_participants": total_participants,
        "paid_events_count": paid_events_count,
        "paid_participants_count": paid_participants_count,
        "unpaid_events_count": unpaid_events_count,
        "unpaid_participants_count": unpaid_participants_count,
        "total_spent": total_spent_val,
        "total_spent_formatted": f"₹{int(total_spent_val):,}"
    }


def insert_workshop(cursor, data: Dict[str, Any], created_by: Optional[str] = None) -> int:
    """Inserts a new workshop record and returns the new auto-generated ID."""
    tbl = _get_table_name()
    event_name = data.get("event_name")
    event_category = data.get("event_category") or "Workshop"
    department = data.get("department")
    start_date = data.get("start_date")
    end_date = data.get("end_date")
    participants_count = int(data.get("participants_count") or 0)
    event_type = data.get("event_type") or "Paid"
    actual_spent = float(data.get("actual_spent") or 0.0)
    creator = created_by or "SYSTEM"

    if is_sql_server():
        query = f"""
            SET NOCOUNT ON;
            INSERT INTO {tbl} (
                event_name, event_category, department, start_date, end_date,
                participants_count, event_type, actual_spent, created_by
            )
            OUTPUT INSERTED.id
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
        """
        cursor.execute(query, (
            event_name, event_category, department, start_date, end_date,
            participants_count, event_type, actual_spent, creator
        ))
        row = cursor.fetchone()
        return int(row[0]) if row and row[0] is not None else 0
    else:
        query = f"""
            INSERT INTO {tbl} (
                event_name, event_category, department, start_date, end_date,
                participants_count, event_type, actual_spent, created_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        cursor.execute(query, (
            event_name, event_category, department, start_date, end_date,
            participants_count, event_type, actual_spent, creator
        ))
        return int(cursor.lastrowid or 0)


def update_workshop(cursor, workshop_id: int, data: Dict[str, Any], updated_by: Optional[str] = None) -> None:
    """Updates an existing workshop record."""
    tbl = _get_table_name()
    now_sql = "GETDATE()" if is_sql_server() else "CURRENT_TIMESTAMP"
    query = f"""
        UPDATE {tbl}
        SET event_name = ?,
            event_category = ?,
            department = ?,
            start_date = ?,
            end_date = ?,
            participants_count = ?,
            event_type = ?,
            actual_spent = ?,
            updated_at = {now_sql},
            updated_by = ?
        WHERE id = ?
    """
    cursor.execute(query, (
        data.get("event_name"),
        data.get("event_category") or "Workshop",
        data.get("department"),
        data.get("start_date"),
        data.get("end_date"),
        int(data.get("participants_count") or 0),
        data.get("event_type") or "Paid",
        float(data.get("actual_spent") or 0.0),
        updated_by or "SYSTEM",
        workshop_id
    ))


def delete_workshop(cursor, workshop_id: int) -> bool:
    """Deletes a workshop by ID."""
    tbl = _get_table_name()
    cursor.execute(f"DELETE FROM {tbl} WHERE id = ?", (workshop_id,))
    return cursor.rowcount > 0
