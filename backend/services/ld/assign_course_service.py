"""
Assign Course Service.
Handles business logic, validations, and notifications for dbo.lms_LD_assign_course.
"""

import re
from typing import List, Dict, Any, Optional
from datetime import datetime
from fastapi import HTTPException, status
from database.connection import connect_db
from repositories.ld import assign_course_repository as repo
from repositories.ld import course_enrollment_repository as enr_repo
from repositories.ld import course_repository
from repositories.common import notification_repository
from services.common.auth_service import employee_service

class AssignCourseService:
    def assign_course(
        self,
        current_user: Optional[Dict[str, Any]],
        data: Dict[str, Any],
        enforce_capacity: bool = True
    ) -> Dict[str, Any]:
        """
        Assigns a course to one or more employees:
        1. Validates course existence
        2. Validates start and target completion dates
        3. Inserts records into dbo.lms_LD_assign_course
        4. Syncs to lms_employee_course so it appears in employee library
        5. Dispatches bell notification to each assigned employee
        """
        course_id = data.get("course_id")
        employee_ids = data.get("employee_ids", [])
        start_date = data.get("learning_starting_date")
        target_date = data.get("target_completion_date")
        note = data.get("assignment_note")
        if note is not None:
            note = (
                re.sub(
                    r"\n{2,}",
                    "\n",
                    re.sub(
                        r" *\n *",
                        "\n",
                        re.sub(
                            r" {2,}",
                            " ",
                            str(note).replace("\r\n", "\n").replace("\r", "\n").replace("\t", " "),
                        ),
                    ),
                ).strip()[:250]
                or None
            )

        if not course_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Course ID is required."
            )
        if not employee_ids or len(employee_ids) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one employee must be selected for assignment."
            )
        if not start_date or not target_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Both learning start date and target completion date are required."
            )

        # Validate dates
        try:
            d_start = datetime.fromisoformat(str(start_date).replace("Z", "+00:00"))
            d_target = datetime.fromisoformat(str(target_date).replace("Z", "+00:00"))
            if d_target < d_start:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Target completion date must be on or after the learning start date."
                )
        except ValueError:
            # If plain YYYY-MM-DD string
            if str(target_date) < str(start_date):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Target completion date must be on or after the learning start date."
                )

        conn = connect_db()
        cursor = conn.cursor()
        try:
            # 1. Verify course
            course = course_repository.get_course_by_id(cursor, course_id)
            if not course:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Course with ID {course_id} not found."
                )
            course_title = course.get("course_title") or "Assigned Course"

            # 1b. Validate Model B 4-member capacity limit via EmailProviders & lms_active_slots
            from services.common.slot_service import slot_service

            approved_list = enr_repo.get_approved_employees_for_course(cursor, course_id)
            already_assigned_eids = {e["empId"].strip().upper() for e in approved_list}
            new_eids = [str(eid).strip() for eid in employee_ids if str(eid).strip().upper() not in already_assigned_eids]

            # Prevent re-assigning employees who have already completed this course
            cursor.execute("""
                SELECT employee_id FROM dbo.lms_course_enrollments
                WHERE course_id = ? AND status = 'Completed'
            """, (course_id,))
            completed_eids = {str(r[0]).strip().upper() for r in cursor.fetchall() if r[0]}
            already_completed = [eid for eid in new_eids if eid.upper() in completed_eids]
            if already_completed:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Employee(s) {', '.join(already_completed)} have already completed this course and cannot be re-assigned."
                )

            course_ep = slot_service.get_course_email_provider(course_id, cursor)
            if course_ep and course_ep.get("EmailProviderId"):
                ep_id = course_ep["EmailProviderId"]
                cursor.execute(
                    "SELECT COUNT(*) FROM dbo.lms_active_slots WHERE EmailProviderId = ? AND status = 'Available'",
                    (ep_id,)
                )
                avail_slots = cursor.fetchone()[0]
                if enforce_capacity and len(new_eids) > avail_slots:
                    c_email = course_ep.get("CourseEmail") or "Corporate Account"
                    p_name = course_ep.get("ProviderName") or "Provider"
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Cannot assign course: Capacity limit reached. '{c_email}' on '{p_name}' has only {avail_slots} slot(s) available, cannot assign {len(new_eids)} employee(s)."
                    )
            elif enforce_capacity and len(approved_list) + len(new_eids) > 4:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot assign course: Course license capacity is limited to 4 concurrent members. Currently {len(approved_list)}/4 active, cannot add {len(new_eids)} more."
                )

            # 2. Resolve creator identity strictly from current_user
            if not current_user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authenticated L&D user is required to assign courses."
                )
            creator_emp_id = current_user.get("employee_id") or current_user.get("Emp_Obj_Id")
            if not creator_emp_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Authenticated user is missing an employee_id."
                )
            creator_name = current_user.get("name") or current_user.get("full_name") or creator_emp_id

            creator_profile_id = notification_repository.get_or_create_profile_id(
                cursor,
                employee_id=creator_emp_id
            ) or 1

            created_assignments = []

            # 3. Insert assignment header in dbo.lms_assign_course with selected employees
            selected_employees_str = ", ".join(new_eids) if new_eids else ", ".join(str(e).strip() for e in employee_ids)
            from database.connection import is_sql_server
            if is_sql_server():
                cursor.execute(
                    """
                    SELECT TOP 1 id FROM dbo.lms_assign_course WITH (UPDLOCK, HOLDLOCK)
                    WHERE course_id = ?
                      AND COALESCE(selected_employees, '') = ?
                      AND learning_start_date = ?
                      AND target_completion_date = ?
                      AND created_at >= DATEADD(second, -30, GETDATE())
                    """,
                    (course_id, selected_employees_str[:255], str(start_date)[:10], str(target_date)[:10]),
                )
            else:
                cursor.execute(
                    """
                    SELECT id FROM dbo.lms_assign_course
                    WHERE course_id = ?
                      AND COALESCE(selected_employees, '') = ?
                      AND learning_start_date = ?
                      AND target_completion_date = ?
                      AND created_at >= datetime('now', '-30 seconds')
                    LIMIT 1
                    """,
                    (course_id, selected_employees_str[:255], str(start_date)[:10], str(target_date)[:10]),
                )
            if cursor.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Assignment for '{course_title}' to these employees was just submitted."
                )

            assign_id = repo.insert_assignment(
                cursor=cursor,
                course_id=course_id,
                ld_id=creator_emp_id,
                learning_starting_date=str(start_date)[:10],
                target_completion_date=str(target_date)[:10],
                assignment_note=note,
                created_by=creator_emp_id,
                selected_employees=selected_employees_str
            )

            # 4. Provision assigned enrollment in dbo.lms_course_enrollments and notify each employee
            for emp_ref in employee_ids:
                emp_code = str(emp_ref).strip()

                # Provision course enrollment with status 'Assigned'
                enr_code = repo.provision_assigned_course_enrollment(
                    cursor=cursor,
                    employee_id=emp_code,
                    course_id=course_id,
                    created_by=creator_emp_id,
                    assignment_id=assign_id
                )

                # Acquire Model B Concurrency Slot
                cursor.execute("SELECT id FROM dbo.lms_course_enrollments WHERE enrollment_code = ?", (enr_code,))
                enr_row = cursor.fetchone()
                enr_id = enr_row[0] if enr_row else None
                slot_service.acquire_slot(
                    course_id=course_id,
                    employee_id=emp_code,
                    enrollment_id=enr_id,
                    cursor=cursor,
                    conn=conn
                )

                # Send Bell Notification to the assigned employee in dbo.lms_notifications
                try:
                    notif_msg = f"L&D has assigned the course '{course_title}' ({enr_code}) to your learning library. Target completion: {str(target_date)[:10]}."
                    if note and note.strip():
                        notif_msg += f" Note: {note.strip()}"

                    cursor.execute("""
                        INSERT INTO dbo.lms_notifications (employee_id, message, is_read, created_at, created_by)
                        VALUES (?, ?, 0, GETDATE(), ?)
                    """, (emp_code[:7], notif_msg, creator_emp_id[:7]))
                    from services.common.email_service import email_service
                    email_service.enqueue_notification_email(
                        employee_id=emp_code[:7],
                        message=notif_msg,
                        reference_id=enr_code,
                        reference_type="COURSE_ASSIGNMENT",
                    )
                except Exception as ne:
                    print(f"[AssignCourseService] Warning: Could not insert notification: {ne}")

                created_assignments.append({
                    "assign_course_id": assign_id,
                    "enrollment_code": enr_code,
                    "employee_code": emp_code,
                    "course_id": course_id,
                    "course_title": course_title,
                    "learning_starting_date": str(start_date)[:10],
                    "target_completion_date": str(target_date)[:10],
                })

            conn.commit()

            return {
                "message": f"Successfully assigned '{course_title}' to {len(created_assignments)} employee(s).",
                "assignedCount": len(created_assignments),
                "assignments": created_assignments
            }
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def get_assigned_courses(
        self,
        course_id: Optional[int] = None,
        employee_id: Optional[str] = None,
        search: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        conn = connect_db()
        cursor = conn.cursor()
        try:
            rows = repo.get_assigned_courses(cursor, course_id=course_id, employee_id=employee_id, search=search)
            for r in rows:
                emp_code = r.get("employee_code")
                emp_info = None
                if emp_code:
                    emp_info = employee_service.get_employee_by_id(emp_code)
                    if not emp_info and str(emp_code).isdigit():
                        emp_info = employee_service.get_employee_by_id(f"EMP{int(emp_code):03d}")
                if emp_info:
                    r["employee_name"] = emp_info.get("name") or emp_info.get("full_name") or emp_code
                    r["employee_role"] = emp_info.get("job_title") or emp_info.get("role") or "Employee"
                    r["employee_department"] = emp_info.get("department") or "Engineering"
                    r["employee_email"] = emp_info.get("email") or emp_info.get("work_email") or ""
                else:
                    email = r.get("employee_email") or ""
                    r["employee_name"] = email.split("@")[0].replace(".", " ").title() if email else (emp_code or "Employee")
                    r["employee_role"] = "Employee"
                    r["employee_department"] = "Engineering"
                    r["employee_email"] = email

                # Populate all colleagues assigned in this batch
                raw_selected = r.get("selected_employees") or ""
                colleagues = []
                colleague_codes = [c.strip() for c in raw_selected.split(",") if c.strip()]
                for c_code in colleague_codes:
                    c_info = employee_service.get_employee_by_id(c_code)
                    if not c_info and str(c_code).isdigit():
                        c_info = employee_service.get_employee_by_id(f"EMP{int(c_code):03d}")
                    if c_info:
                        colleagues.append({
                            "empId": c_code,
                            "employee_id": c_code,
                            "name": c_info.get("name") or c_info.get("full_name") or c_code,
                            "role": c_info.get("job_title") or c_info.get("role") or "Employee",
                            "department": c_info.get("department") or "Engineering",
                            "email": c_info.get("email") or c_info.get("work_email") or "",
                        })
                    else:
                        colleagues.append({
                            "empId": c_code,
                            "employee_id": c_code,
                            "name": c_code,
                            "role": "Employee",
                            "department": "Engineering",
                            "email": "",
                        })
                if not r.get("other_employees") or len(r.get("other_employees")) == 0:
                    r["other_employees"] = colleagues
                if not r.get("approved_employees"):
                    r["approved_employees"] = r["other_employees"]

                creator_code = r.get("creator_code")
                if creator_code:
                    c_info = employee_service.get_employee_by_id(creator_code)
                    r["created_by_name"] = c_info.get("name") if c_info else creator_code
                else:
                    r["created_by_name"] = None

                enr_code = r.get("enrollment_code") or f"ENR-2026-{r.get('assign_course_id', 1):04d}"
                r["enrollment_code"] = enr_code
                asn_code = f"ENR-2026-{r.get('assign_course_id', 1):04d}"
                r["assignment_id"] = asn_code
                r["assignment_code"] = asn_code
            return rows
        finally:
            conn.close()

    def batch_assign_employees(
        self,
        current_user: Optional[Dict[str, Any]],
        course_id: int,
        assignments: List[Dict[str, Any]],
        learning_starting_date: str,
        target_completion_date: str,
        note: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        ENR-YYYY-024: Batch assigns courses from a list of rows or CSV.
        Validates email syntax per row:
        - If a row contains invalid email syntax (e.g. Row 15), records the error.
        - Continues processing the remaining valid rows (e.g. 49 valid rows).
        - Does NOT roll back the entire transaction.
        """
        import re
        EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")

        errors = []
        valid_assignments = []

        for idx, item in enumerate(assignments, start=1):
            email = str(item.get("email") or item.get("employee_email") or "").strip()
            emp_id = str(item.get("employee_id") or item.get("emp_id") or "").strip()

            # Email validation
            if not email or not EMAIL_REGEX.match(email):
                errors.append({
                    "row": idx,
                    "email": email or "(empty)",
                    "employee_id": emp_id or "N/A",
                    "error": f"Invalid email syntax: '{email}'"
                })
                continue

            # Resolve employee
            emp = employee_service.get_employee_by_email(email)
            if not emp and emp_id:
                emp = employee_service.get_employee_by_id(emp_id)

            resolved_id = emp.get("employee_id") if emp else emp_id
            if not resolved_id:
                resolved_id = email.split("@")[0].upper()[:7]

            valid_assignments.append({
                "row": idx,
                "email": email,
                "employee_id": resolved_id,
                "name": emp.get("name") if emp else email.split("@")[0]
            })

        # Process valid assignments in database
        assigned_results = []
        if valid_assignments:
            valid_emp_ids = [v["employee_id"] for v in valid_assignments]
            res = self.assign_course(
                current_user=current_user,
                data={
                    "course_id": course_id,
                    "employee_ids": valid_emp_ids,
                    "learning_starting_date": learning_starting_date,
                    "target_completion_date": target_completion_date,
                    "assignment_note": note
                },
                enforce_capacity=False
            )
            assigned_results = res.get("assignments", [])

        return {
            "success": True,
            "total_rows": len(assignments),
            "assigned_count": len(valid_assignments),
            "failed_count": len(errors),
            "errors": errors,
            "assignments": assigned_results,
            "message": f"Batch assignment processed: {len(valid_assignments)} employees assigned successfully, {len(errors)} error(s) reported."
        }

    def batch_assign_csv(
        self,
        current_user: Optional[Dict[str, Any]],
        course_id: int,
        csv_text: str,
        learning_starting_date: str,
        target_completion_date: str,
        note: Optional[str] = None
    ) -> Dict[str, Any]:
        """Parses CSV content and delegates to batch_assign_employees."""
        import csv
        import io
        reader = csv.DictReader(io.StringIO(csv_text.strip()))
        rows = list(reader)
        # If no headers or only single column
        if not rows or not reader.fieldnames:
            lines = [l.strip() for l in csv_text.strip().splitlines() if l.strip()]
            rows = [{"email": l.split(",")[0].strip()} for l in lines]

        return self.batch_assign_employees(
            current_user=current_user,
            course_id=course_id,
            assignments=rows,
            learning_starting_date=learning_starting_date,
            target_completion_date=target_completion_date,
            note=note
        )

assign_course_service = AssignCourseService()
