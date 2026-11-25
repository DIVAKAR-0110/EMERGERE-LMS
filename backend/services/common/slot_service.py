"""
Slot Concurrency Management Service for LMS (Model B).
Enforces strict 4-slot concurrency scoped to (Corporate Email + Course Provider) pair.
Handles atomic slot acquisition, 100% completion release cascade, and slot reporting.
"""

import logging
from typing import Dict, Any, List, Optional
from database.connection import connect_db, is_sql_server, dictfetchall, dictfetchone

logger = logging.getLogger("SlotService")

class SlotService:
    def get_or_create_email_provider(
        self,
        course_email_id: int,
        provider_id: int,
        cursor=None,
        conn=None
    ) -> int:
        """
        Retrieves or initializes an EmailProviders junction record and ensures 4 slots exist.
        """
        should_close = False
        if cursor is None:
            conn = connect_db()
            cursor = conn.cursor()
            should_close = True

        try:
            cursor.execute(
                """
                SELECT EmailProviderId 
                FROM dbo.EmailProviders 
                WHERE CourseEmailId = ? AND ProviderId = ?
                """,
                (course_email_id, provider_id)
            )
            row = cursor.fetchone()
            if row:
                ep_id = row[0]
            else:
                cursor.execute(
                    """
                    INSERT INTO dbo.EmailProviders (CourseEmailId, ProviderId, MaxSlots, IsActive)
                    OUTPUT INSERTED.EmailProviderId
                    VALUES (?, ?, 4, 1)
                    """,
                    (course_email_id, provider_id)
                )
                inserted = cursor.fetchone()
                ep_id = inserted[0] if inserted else None

            # Ensure 4 slots exist for this EmailProviderId
            if ep_id:
                for s_num in range(1, 5):
                    cursor.execute(
                        """
                        IF NOT EXISTS (
                            SELECT 1 FROM dbo.lms_active_slots 
                            WHERE EmailProviderId = ? AND slot_number = ?
                        )
                        BEGIN
                            INSERT INTO dbo.lms_active_slots (EmailProviderId, slot_number, status)
                            VALUES (?, ?, 'Available');
                        END
                        """,
                        (ep_id, s_num, ep_id, s_num)
                    )

            if should_close and conn:
                conn.commit()
            return ep_id
        finally:
            if should_close and conn:
                conn.close()

    def get_course_email_provider(self, course_id: int, cursor=None) -> Optional[Dict[str, Any]]:
        """
        Resolves the EmailProviderId, email address, and provider name for a given course.
        """
        lock_hint = " WITH (NOLOCK)" if is_sql_server() else ""
        query = f"""
            SELECT 
                c.id AS course_id,
                c.course_name,
                c.provider_id,
                c.course_email_id,
                c.EmailProviderId,
                cp.ProviderName,
                ce.CourseEmail
            FROM dbo.lms_courses c{lock_hint}
            LEFT JOIN dbo.CourseProviders cp ON cp.ProviderId = c.provider_id
            LEFT JOIN dbo.CourseEmails ce ON ce.CourseEmailId = c.course_email_id
            WHERE c.id = ?
        """
        cursor.execute(query, (course_id,))
        return dictfetchone(cursor)

    def acquire_slot(
        self,
        course_id: int,
        employee_id: str,
        enrollment_id: Optional[int] = None,
        cursor=None,
        conn=None
    ) -> Dict[str, Any]:
        """
        Acquires an available slot for (Email + Provider) with concurrency row lock.
        Returns success=True with slot details, or success=False if all 4 slots are occupied.
        """
        should_close = False
        if cursor is None:
            conn = connect_db()
            cursor = conn.cursor()
            should_close = True

        try:
            course_info = self.get_course_email_provider(course_id, cursor)
            if not course_info:
                return {"success": False, "message": f"Course ID {course_id} not found."}

            ep_id = course_info.get("EmailProviderId")
            course_email_id = course_info.get("course_email_id")
            provider_id = course_info.get("provider_id")
            provider_name = course_info.get("ProviderName") or "Provider"
            course_email = course_info.get("CourseEmail") or "Corporate Account"

            # Auto-resolve or create EmailProviderId if not set on the course
            if not ep_id and course_email_id and provider_id:
                ep_id = self.get_or_create_email_provider(course_email_id, provider_id, cursor, conn)
                cursor.execute(
                    "UPDATE dbo.lms_courses SET EmailProviderId = ? WHERE id = ?",
                    (ep_id, course_id)
                )

            if not ep_id:
                # If neither email nor provider is configured on the course, allow fallback
                logger.warning(f"Course {course_id} lacks (course_email_id, provider_id) pairing. Slot check bypassed.")
                return {
                    "success": True,
                    "bypassed": True,
                    "message": "No email/provider slot restriction configured for this course."
                }

            # Check if this employee already occupies an active slot for this course
            cursor.execute(
                """
                SELECT s.slot_id, s.slot_number, s.status 
                FROM dbo.lms_active_slots s
                JOIN dbo.lms_course_enrollments e ON e.id = s.enrollment_id
                WHERE s.EmailProviderId = ? AND e.employee_id = ? AND e.course_id = ? AND s.status = 'Occupied'
                """,
                (ep_id, employee_id, course_id)
            )
            existing_occupied = cursor.fetchone()
            if existing_occupied:
                return {
                    "success": True,
                    "slot_id": existing_occupied[0],
                    "slot_number": existing_occupied[1],
                    "already_assigned": True,
                    "message": f"Employee {employee_id} is already occupying Slot #{existing_occupied[1]}."
                }

            # Concurrency check: find first available slot with UPDLOCK, HOLDLOCK
            lock_hint = " WITH (UPDLOCK, HOLDLOCK)" if is_sql_server() else ""
            cursor.execute(
                f"""
                SELECT TOP 1 slot_id, slot_number
                FROM dbo.lms_active_slots{lock_hint}
                WHERE EmailProviderId = ? AND status = 'Available'
                ORDER BY slot_number ASC
                """,
                (ep_id,)
            )
            free_slot = cursor.fetchone()

            if not free_slot:
                # Count current occupants for detailed error message
                cursor.execute(
                    """
                    SELECT s.slot_number, e.employee_id, e.progress_percentage
                    FROM dbo.lms_active_slots s
                    LEFT JOIN dbo.lms_course_enrollments e ON e.id = s.enrollment_id
                    WHERE s.EmailProviderId = ?
                    ORDER BY s.slot_number ASC
                    """,
                    (ep_id,)
                )
                occupants = cursor.fetchall()
                occupant_summary = ", ".join([f"Slot {o[0]}: {o[1]} ({float(o[2] or 0):.0f}%)" for o in occupants])
                
                msg = (
                    f"All 4 active learning slots for '{course_email}' on '{provider_name}' are currently occupied. "
                    f"Current active learners: [{occupant_summary}]. "
                    f"Please wait for an active learner to reach 100% completion or assign via another corporate email."
                )
                logger.warning(f"Slot capacity reached for EmailProviderId={ep_id}: {msg}")
                return {
                    "success": False,
                    "error_code": "SLOT_CAPACITY_FULL",
                    "email_provider_id": ep_id,
                    "provider_name": provider_name,
                    "course_email": course_email,
                    "message": msg
                }

            slot_id, slot_number = free_slot[0], free_slot[1]

            # Transition slot to Occupied
            cursor.execute(
                """
                UPDATE dbo.lms_active_slots
                SET status = 'Occupied',
                    enrollment_id = ?
                WHERE slot_id = ?
                """,
                (enrollment_id, slot_id)
            )

            # Sync live slot statistics for this EmailProviderId
            self._recalc_email_provider_slot_stats(ep_id, cursor)

            if should_close and conn:
                conn.commit()

            logger.info(f"Assigned Slot #{slot_number} (slot_id={slot_id}) on EmailProviderId={ep_id} to {employee_id} for course {course_id}")
            return {
                "success": True,
                "slot_id": slot_id,
                "slot_number": slot_number,
                "email_provider_id": ep_id,
                "provider_name": provider_name,
                "course_email": course_email,
                "message": f"Successfully occupied Slot #{slot_number}/4 on '{course_email}' ({provider_name})."
            }
        except Exception as e:
            if should_close and conn:
                conn.rollback()
            logger.error(f"Error in acquire_slot: {e}", exc_info=True)
            return {"success": False, "message": str(e)}
        finally:
            if should_close and conn:
                conn.close()

    def release_slot(
        self,
        enrollment_id: Optional[int] = None,
        slot_id: Optional[int] = None,
        course_id: Optional[int] = None,
        employee_id: Optional[str] = None,
        cursor=None,
        conn=None
    ) -> Dict[str, Any]:
        """
        Releases an occupied slot back to 'Available' status and clears course/employee associations.
        Can match by enrollment_id, slot_id, or (course_id, employee_id).
        """
        should_close = False
        if cursor is None:
            conn = connect_db()
            cursor = conn.cursor()
            should_close = True

        try:
            where_clauses = ["s.status = 'Occupied'"]
            params = []

            if slot_id:
                where_clauses.append("s.slot_id = ?")
                params.append(slot_id)
            elif enrollment_id:
                where_clauses.append("s.enrollment_id = ?")
                params.append(enrollment_id)
            elif course_id and employee_id:
                where_clauses.append("e.course_id = ? AND e.employee_id = ?")
                params.extend([course_id, employee_id])
            else:
                return {"success": False, "message": "Insufficient parameters to identify slot for release."}

            sql = f"""
                SELECT s.slot_id, s.EmailProviderId, s.slot_number, e.employee_id, e.course_id
                FROM dbo.lms_active_slots s
                LEFT JOIN dbo.lms_course_enrollments e ON e.id = s.enrollment_id
                WHERE {' AND '.join(where_clauses)}
            """
            cursor.execute(sql, tuple(params))
            found_slot = cursor.fetchone()

            if not found_slot:
                return {"success": True, "released": False, "message": "No active occupied slot matched criteria."}

            s_id, ep_id, s_num, emp_id, c_id = found_slot

            cursor.execute(
                """
                UPDATE dbo.lms_active_slots
                SET status = 'Available',
                    enrollment_id = NULL
                WHERE slot_id = ?
                """,
                (s_id,)
            )

            # Sync live slot statistics for this EmailProviderId
            self._recalc_email_provider_slot_stats(ep_id, cursor)

            if should_close and conn:
                conn.commit()

            logger.info(f"Released Slot #{s_num} (slot_id={s_id}) on EmailProviderId={ep_id} previously held by {emp_id}")
            return {
                "success": True,
                "released": True,
                "slot_id": s_id,
                "slot_number": s_num,
                "email_provider_id": ep_id,
                "message": f"Slot #{s_num} successfully released and made available."
            }
        except Exception as e:
            if should_close and conn:
                conn.rollback()
            logger.error(f"Error in release_slot: {e}", exc_info=True)
            return {"success": False, "message": str(e)}
        finally:
            if should_close and conn:
                conn.close()

    def update_slot_progress(
        self,
        enrollment_id: int,
        progress_percentage: float,
        cursor=None,
        conn=None
    ) -> Dict[str, Any]:
        """
        Syncs learner progress to the active slot.
        If verified progress >= 100.0, marks enrollment 'Completed' and cascades slot release.
        """
        should_close = False
        if cursor is None:
            conn = connect_db()
            cursor = conn.cursor()
            should_close = True

        try:
            norm_progress = min(max(float(progress_percentage or 0.0), 0.0), 100.0)

            # 1. Update enrollment progress
            cursor.execute(
                """
                UPDATE dbo.lms_course_enrollments
                SET progress_percentage = ?,
                    status = CASE WHEN ? >= 100.0 THEN 'Completed' ELSE status END,
                    updated_at = GETDATE()
                WHERE id = ?
                """,
                (norm_progress, norm_progress, enrollment_id)
            )

            # 2. Check slot
            cursor.execute(
                """
                SELECT s.slot_id, s.EmailProviderId, s.slot_number, e.employee_id
                FROM dbo.lms_active_slots s
                LEFT JOIN dbo.lms_course_enrollments e ON e.id = s.enrollment_id
                WHERE s.enrollment_id = ? AND s.status = 'Occupied'
                """,
                (enrollment_id,)
            )
            slot = cursor.fetchone()

            if not slot:
                if should_close and conn:
                    conn.commit()
                return {"success": True, "released": False, "progress": norm_progress}

            slot_id, ep_id, s_num, emp_id = slot

            if norm_progress >= 100.0:
                # Auto-release slot upon 100% completion
                release_result = self.release_slot(slot_id=slot_id, cursor=cursor, conn=conn)
                if should_close and conn:
                    conn.commit()
                return {
                    "success": True,
                    "released": True,
                    "progress": 100.0,
                    "slot_id": slot_id,
                    "slot_number": s_num,
                    "email_provider_id": ep_id,
                    "message": f"Course completed 100%. Slot #{s_num} on EmailProvider #{ep_id} released for new learners!"
                }
            else:
                # Progress is maintained directly in dbo.lms_course_enrollments (Single Source of Truth)
                if should_close and conn:
                    conn.commit()
                return {"success": True, "released": False, "progress": norm_progress, "slot_id": slot_id}
        except Exception as e:
            if should_close and conn:
                conn.rollback()
            logger.error(f"Error updating slot progress: {e}", exc_info=True)
            return {"success": False, "message": str(e)}
        finally:
            if should_close and conn:
                conn.close()

    def get_email_provider_slots(self, email_provider_id: int) -> Dict[str, Any]:
        """
        Retrieves live details of all 4 slots for an EmailProviderId including learner info.
        """
        conn = connect_db()
        cursor = conn.cursor()
        try:
            # Metadata
            cursor.execute(
                """
                SELECT 
                    ep.EmailProviderId,
                    ep.MaxSlots,
                    ep.IsActive,
                    ce.CourseEmailId,
                    ce.CourseEmail,
                    cp.ProviderId,
                    cp.ProviderName
                FROM dbo.EmailProviders ep
                JOIN dbo.CourseEmails ce ON ce.CourseEmailId = ep.CourseEmailId
                JOIN dbo.CourseProviders cp ON cp.ProviderId = ep.ProviderId
                WHERE ep.EmailProviderId = ?
                """,
                (email_provider_id,)
            )
            ep_meta = dictfetchone(cursor)
            if not ep_meta:
                return {}

            # Slots
            cursor.execute(
                """
                SELECT 
                    s.slot_id,
                    s.slot_number,
                    s.status,
                    e.progress_percentage,
                    s.occupied_slots,
                    s.available_slots,
                    s.enrollment_employee_ids,
                    e.employee_id,
                    c.id AS course_id,
                    c.course_name
                FROM dbo.lms_active_slots s
                LEFT JOIN dbo.lms_course_enrollments e ON e.id = s.enrollment_id
                LEFT JOIN dbo.lms_courses c ON c.id = e.course_id
                WHERE s.EmailProviderId = ?
                ORDER BY s.slot_number ASC
                """,
                (email_provider_id,)
            )
            slot_rows = dictfetchall(cursor)

            try:
                from services.common.auth_service import employee_service
            except Exception:
                employee_service = None

            for s in slot_rows:
                emp_id = s.get("employee_id")
                if emp_id and employee_service:
                    try:
                        emp = employee_service.get_employee_by_id(emp_id)
                        if emp:
                            s["employee_name"] = emp.get("name") or f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip()
                            s["department"] = emp.get("department") or emp.get("role") or "—"
                            s["designation"] = emp.get("designation") or emp.get("role") or "—"
                        else:
                            s["employee_name"] = emp_id
                            s["department"] = "—"
                            s["designation"] = "—"
                    except Exception:
                        s["employee_name"] = emp_id
                        s["department"] = "—"
                        s["designation"] = "—"
                else:
                    s["employee_name"] = emp_id or "—"
                    s["department"] = "—"
                    s["designation"] = "—"

            occupied_count = sum(1 for s in slot_rows if s["status"] == "Occupied")
            available_count = sum(1 for s in slot_rows if s["status"] == "Available")
            active_emp_ids = [s["employee_id"] for s in slot_rows if s.get("status") == "Occupied" and s.get("employee_id")]
            active_emp_names = [s.get("employee_name") for s in slot_rows if s.get("status") == "Occupied" and s.get("employee_name") and s.get("employee_name") != "—"]

            return {
                "email_provider_id": ep_meta["EmailProviderId"],
                "course_email": ep_meta["CourseEmail"],
                "course_email_id": ep_meta["CourseEmailId"],
                "provider_name": ep_meta["ProviderName"],
                "provider_id": ep_meta["ProviderId"],
                "max_slots": ep_meta.get("MaxSlots", 4),
                "occupied_slots": occupied_count,
                "available_slots": available_count,
                "enrollment_employee_ids": active_emp_ids,
                "enrollment_employee_ids_str": ", ".join(active_emp_ids) if active_emp_ids else "None",
                "enrollment_employee_names": active_emp_names,
                "is_full": available_count == 0,
                "slots": slot_rows
            }
        finally:
            conn.close()

    def get_all_email_providers_summary(self, provider_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Returns a summary of all EmailProviders with live slot counts and active employee IDs.
        Optionally filtered by provider_id.
        """
        conn = connect_db()
        cursor = conn.cursor()
        try:
            where_sql = "WHERE ep.IsActive = 1"
            params = []
            if provider_id:
                where_sql += " AND ep.ProviderId = ?"
                params.append(provider_id)

            if is_sql_server():
                sql = f"""
                    SELECT 
                        ep.EmailProviderId,
                        ep.MaxSlots,
                        ep.CourseEmailId,
                        ep.CourseEmail,
                        ep.ProviderId,
                        ep.ProviderName,
                        ep.occupied_slots,
                        ep.available_slots,
                        ep.MaxSlots AS total_slots,
                        ep.enrollment_employee_ids
                    FROM dbo.vw_active_slots_summary ep
                    {where_sql}
                    ORDER BY ep.ProviderName, ep.CourseEmail
                """
                cursor.execute(sql, tuple(params))
                rows = dictfetchall(cursor)
                for r in rows:
                    raw_ids = r.get("enrollment_employee_ids") or ""
                    if raw_ids and raw_ids != "None":
                        r["enrollment_employee_ids_list"] = [x.strip() for x in raw_ids.split(",") if x.strip()]
                    else:
                        r["enrollment_employee_ids_list"] = []
                return rows
            else:
                sql = f"""
                    SELECT 
                        ep.EmailProviderId,
                        ep.MaxSlots,
                        ce.CourseEmailId,
                        ce.CourseEmail,
                        cp.ProviderId,
                        cp.ProviderName,
                        SUM(CASE WHEN s.status = 'Occupied' THEN 1 ELSE 0 END) AS occupied_slots,
                        SUM(CASE WHEN s.status = 'Available' THEN 1 ELSE 0 END) AS available_slots,
                        COUNT(s.slot_id) AS total_slots
                    FROM dbo.EmailProviders ep
                    JOIN dbo.CourseEmails ce ON ce.CourseEmailId = ep.CourseEmailId
                    JOIN dbo.CourseProviders cp ON cp.ProviderId = ep.ProviderId
                    LEFT JOIN dbo.lms_active_slots s ON s.EmailProviderId = ep.EmailProviderId
                    {where_sql}
                    GROUP BY 
                        ep.EmailProviderId,
                        ep.MaxSlots,
                        ce.CourseEmailId,
                        ce.CourseEmail,
                        cp.ProviderId,
                        cp.ProviderName
                    ORDER BY cp.ProviderName, ce.CourseEmail
                """
                cursor.execute(sql, tuple(params))
                rows = dictfetchall(cursor)
                for r in rows:
                    r["enrollment_employee_ids"] = "None"
                    r["enrollment_employee_ids_list"] = []
                return rows
        finally:
            conn.close()

    def get_cascading_options(self) -> Dict[str, Any]:
        """
        Returns all active providers and emails mapped to each other for cascading dropdowns.
        """
        conn = connect_db()
        cursor = conn.cursor()
        try:
            cursor.execute(
                """
                SELECT 
                    ep.EmailProviderId,
                    ce.CourseEmailId,
                    ce.CourseEmail,
                    cp.ProviderId,
                    cp.ProviderName,
                    SUM(CASE WHEN s.status = 'Available' THEN 1 ELSE 0 END) AS available_slots
                FROM dbo.EmailProviders ep
                JOIN dbo.CourseEmails ce ON ce.CourseEmailId = ep.CourseEmailId
                JOIN dbo.CourseProviders cp ON cp.ProviderId = ep.ProviderId
                LEFT JOIN dbo.lms_active_slots s ON s.EmailProviderId = ep.EmailProviderId
                WHERE ep.IsActive = 1
                GROUP BY 
                    ep.EmailProviderId,
                    ce.CourseEmailId,
                    ce.CourseEmail,
                    cp.ProviderId,
                    cp.ProviderName
                ORDER BY cp.ProviderName, ce.CourseEmail
                """
            )
            rows = dictfetchall(cursor)

            # Organize by provider
            by_provider = {}
            for r in rows:
                p_id = r["ProviderId"]
                if p_id not in by_provider:
                    by_provider[p_id] = {
                        "provider_id": p_id,
                        "provider_name": r["ProviderName"],
                        "emails": []
                    }
                by_provider[p_id]["emails"].append({
                    "email_provider_id": r["EmailProviderId"],
                    "course_email_id": r["CourseEmailId"],
                    "course_email": r["CourseEmail"],
                    "available_slots": r["available_slots"]
                })

            return {
                "providers": list(by_provider.values()),
                "raw_mappings": rows
            }
        finally:
            conn.close()

    def _recalc_email_provider_slot_stats(self, email_provider_id: int, cursor) -> None:
        """
        Recalculates and denormalizes occupied_slots, available_slots, and enrollment_employee_ids
        across all slot rows for a given EmailProviderId.
        """
        cursor.execute(
            """
            SELECT e.employee_id
            FROM dbo.lms_active_slots s
            LEFT JOIN dbo.lms_course_enrollments e ON e.id = s.enrollment_id
            WHERE s.EmailProviderId = ? AND s.status = 'Occupied'
            ORDER BY s.slot_number ASC
            """,
            (email_provider_id,)
        )
        rows = cursor.fetchall()
        emp_ids = [r[0] for r in rows if r[0]]
        occ_count = len(rows)
        avail_count = max(0, 4 - occ_count)
        emp_ids_str = ", ".join(emp_ids) if emp_ids else "None"

        cursor.execute(
            """
            UPDATE dbo.lms_active_slots
            SET occupied_slots = ?,
                available_slots = ?,
                enrollment_employee_ids = ?
            WHERE EmailProviderId = ?
            """,
            (occ_count, avail_count, emp_ids_str, email_provider_id)
        )

slot_service = SlotService()
