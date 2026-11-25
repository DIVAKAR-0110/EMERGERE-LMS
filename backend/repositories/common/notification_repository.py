"""
Notification & Recommendation Repository.
Data access layer executing parameterized SQL queries for dbo.lms_notifications,
dbo.lms_course_recommend, and dbo.lms_recommend_new_course.
"""

from typing import List, Dict, Any, Optional
from database.connection import dictfetchall, dictfetchone

def get_or_create_profile_id(
    cursor,
    employee_id: str,
    work_email: Optional[str] = None,
    full_name: Optional[str] = None,
    azure_ad_oid: Optional[str] = None
) -> str:
    """Helper delegating to profile_repository.ensure_or_sync_profile."""
    from repositories.common import profile_repository
    return profile_repository.ensure_or_sync_profile(
        cursor,
        employee_id=employee_id,
        created_by=employee_id
    )

def insert_notification(
    cursor,
    employee_id: str,
    message: str,
    is_read: bool = False,
    created_by: Optional[str] = None
) -> int:
    """Inserts a notification into dbo.lms_notifications."""
    query = """
        INSERT INTO dbo.lms_notifications (
            employee_id, message, is_read, created_at, created_by
        )
        VALUES (?, ?, ?, GETDATE(), ?)
    """
    cursor.execute(
        query,
        (
            employee_id.strip(),
            message.strip(),
            1 if is_read else 0,
            (created_by or employee_id).strip()
        )
    )
    cursor.execute("SELECT @@IDENTITY AS id")
    row = cursor.fetchone()
    notif_id = int(row[0]) if row and row[0] else 0

    if not is_read:
        try:
            from services.common.email_service import email_service
            email_service.enqueue_notification_email(
                employee_id=employee_id.strip(),
                message=message.strip(),
                reference_id=str(notif_id) if notif_id else None,
                reference_type="NOTIFICATION",
            )
        except Exception as email_err:
            print(f"[NotificationRepo] Email dispatch enqueue warning: {email_err}")

    return notif_id

MANAGEMENT_ROLES = {"Reporting Manager", "L&D Team", "HR Team", "CEO"}

def normalize_role_name(raw_role: Optional[str]) -> str:
    """Normalizes role strings to canonical system role names."""
    if not raw_role:
        return "Employee"
    s = str(raw_role).strip().lower()
    if "l&d" in s or "l_d" in s or s == "ld" or "learning" in s:
        return "L&D Team"
    if "reporting" in s or "manager" in s:
        return "Reporting Manager"
    if s == "hr" or "human resources" in s or "hr team" in s:
        return "HR Team"
    if s == "ceo" or "executive" in s:
        return "CEO"
    return "Employee"

def _resolve_notification_scope_and_roles(msg_lower: str, ntype: str):
    """
    Determines whether a notification belongs to personal Employee learning ('EMPLOYEE')
    or management/team/org oversight ('MANAGEMENT'), along with the target management roles.
    """
    # 1. Explicit personal learning notices addressed directly to the learner
    personal_prefixes = (
        "your ",
        "congratulations! your ",
        "reminder: your ",
        "urgent: your ",
        "reimbursement review for requested course",
    )
    if (
        msg_lower.startswith(personal_prefixes)
        or "to your learning library" in msg_lower
        or "assigned to your library" in msg_lower
        or "has assigned the course" in msg_lower
        or "recommended the course" in msg_lower
        or "recommended the study material" in msg_lower
        or " for you." in msg_lower
        or ntype in ("COURSE_RECOMMENDATION", "MATERIAL_RECOMMENDATION", "COURSE_ON_HOLD", "COURSE_REQUEST_PURCHASED")
    ):
        return "EMPLOYEE", set()

    # 2. Certification request workflow (Management copies)
    if ntype.startswith("CERTIFICATION_REQUEST"):
        if "submitted a new certification request" in msg_lower:
            return "MANAGEMENT", {"Reporting Manager"}
        if "requires your approval" in msg_lower:
            return "MANAGEMENT", {"L&D Team"}
        if "awaits your approval" in msg_lower:
            return "MANAGEMENT", {"CEO"}
        if "added to certificate management" in msg_lower or "by the ceo" in msg_lower:
            return "MANAGEMENT", {"L&D Team"}
        return "MANAGEMENT", MANAGEMENT_ROLES

    # 3. Course request workflow (Management copies)
    if ntype.startswith("COURSE_REQUEST_") and ntype != "COURSE_REQUEST_PURCHASED":
        if "submitted a new course request" in msg_lower:
            return "MANAGEMENT", {"Reporting Manager"}
        if "is awaiting your review" in msg_lower or "awaits your approval" in msg_lower:
            return "MANAGEMENT", {"CEO"}
        if "is ready for purchase" in msg_lower:
            return "MANAGEMENT", {"L&D Team"}
        if "urgent escalation" in msg_lower:
            return "MANAGEMENT", {"Reporting Manager", "L&D Team", "CEO"}
        return "MANAGEMENT", MANAGEMENT_ROLES

    # 4. Reimbursement claims & course purchase claims (Management copies)
    if ntype.startswith("REIMBURSEMENT_CLAIM") or ntype.startswith("COURSE_REIMBURSEMENT"):
        if "new course reimbursement claim" in msg_lower or "awaits hr review" in msg_lower:
            return "MANAGEMENT", {"HR Team"}
        if "submitted a new certification reimbursement claim" in msg_lower or "approved and processed by hr" in msg_lower:
            return "MANAGEMENT", {"Reporting Manager"}
        if (
            "submitted by" in msg_lower
            or "approved and paid by hr" in msg_lower
            or "was rejected by hr" in msg_lower
            or "course reimbursement" in msg_lower
            or msg_lower.startswith("course purchase approved")
            or msg_lower.startswith("course purchase rejected")
        ):
            return "MANAGEMENT", {"L&D Team"}
        return "MANAGEMENT", MANAGEMENT_ROLES

    # 5. Enrollment requests & completions / seat release
    if ntype == "COURSE_ENROLLMENT_REQUEST" or "has requested enrollment" in msg_lower:
        return "MANAGEMENT", {"L&D Team"}
    if "'s enrollment request" in msg_lower:
        return "MANAGEMENT", {"Reporting Manager"}
    if "license seat has been released" in msg_lower or "has completed the assigned course" in msg_lower:
        return "MANAGEMENT", {"L&D Team", "Reporting Manager", "CEO"}

    # 6. Generic approval / escalation / recommendation defaults
    if "recommended" in msg_lower or "expiring" in msg_lower or "expires tomorrow" in msg_lower:
        return "EMPLOYEE", set()
    if "requires your approval" in msg_lower or "awaiting your review" in msg_lower or "submitted a new" in msg_lower:
        return "MANAGEMENT", MANAGEMENT_ROLES

    return "EMPLOYEE", set()

def filter_notifications_by_view(
    rows: List[Dict[str, Any]],
    view_mode: Optional[str] = None,
    user_role: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Filters classified notification rows according to active view_mode ('PRIMARY' | 'EMPLOYEE') and role."""
    mode = str(view_mode or "").strip().upper()
    if mode not in ("PRIMARY", "EMPLOYEE"):
        return rows

    if mode == "EMPLOYEE":
        return [r for r in rows if r.get("notification_scope") == "EMPLOYEE"]

    norm_role = normalize_role_name(user_role)
    if norm_role not in MANAGEMENT_ROLES:
        return [r for r in rows if r.get("notification_scope") == "EMPLOYEE"]

    filtered = []
    for r in rows:
        if r.get("notification_scope") != "MANAGEMENT":
            continue
        allowed = r.get("_allowed_roles") or MANAGEMENT_ROLES
        if norm_role in allowed:
            filtered.append(r)
    return filtered

def _format_duration_minutes(dur_val: Any) -> Optional[str]:
    if isinstance(dur_val, int):
        h = dur_val // 60
        m = dur_val % 60
        return f"{h}h {m}m" if h > 0 and m > 0 else (f"{h}h" if h > 0 else f"{m}m")
    return str(dur_val) if dur_val else None


def _parse_ts(ts_str: Optional[str]):
    if not ts_str:
        return None
    from datetime import datetime
    try:
        return datetime.strptime(str(ts_str)[:19], "%Y-%m-%d %H:%M:%S")
    except Exception:
        return None


def get_user_notifications(
    cursor,
    employee_id: str,
    view_mode: Optional[str] = None,
    user_role: Optional[str] = None
) -> List[Dict[str, Any]]:
    """Retrieves notifications for a given employee from dbo.lms_notifications, scoped by view_mode & role."""
    clean_emp = employee_id.strip()
    query = """
        SELECT 
            n.id AS notification_id,
            n.id,
            n.employee_id,
            0 AS recipient_user_id,
            'NOTIFICATION' AS notification_type,
            'Notification' AS title,
            n.message,
            CAST(n.is_read AS BIT) AS is_read,
            CONVERT(VARCHAR(19), n.created_at, 120) AS created_at,
            n.created_by
        FROM dbo.lms_notifications n
        WHERE LOWER(n.employee_id) = LOWER(?)
        ORDER BY n.created_at DESC, n.id DESC
    """
    cursor.execute(query, (clean_emp,))
    rows = dictfetchall(cursor)
    if not rows:
        return []

    import re
    req_code_re = re.compile(r"\b((?:CLM|CRQ|REQ)-\d{4}-\d+|(?:CLM|CRQ|REQ)-\d+)\b", re.IGNORECASE)
    quoted_title_re = re.compile(r"['\"]([^'\"]+)['\"]")
    sub_by_re = re.compile(r"submitted by\s+([A-Za-z][A-Za-z .'-]+?)(?:\s*\(|\s+for|\.)", re.IGNORECASE)
    from_re = re.compile(r"\bfrom\s+([A-Za-z][A-Za-z .'-]+?)\s+(?:requires|awaiting|awaits|has been|was)\b", re.IGNORECASE)
    paren_re = re.compile(r"\(([A-Za-z][A-Za-z .'-]+?)\)\s+was\s+(?:approved|rejected)", re.IGNORECASE)

    need_claims = False
    need_cert_reqs = False
    need_course_reqs = False
    need_materials = False
    need_courses = False
    need_rec_fallback = False

    # First pass: classify types & extract codes/titles/senders cleanly in memory
    for r in rows:
        r["is_read"] = bool(r.get("is_read"))
        msg = (r.get("message") or "").strip()
        msg_lower = msg.lower()

        req_code_match = req_code_re.search(msg)
        extracted_req_code = req_code_match.group(1).upper() if req_code_match else None
        r["_extracted_req_code"] = extracted_req_code
        if extracted_req_code:
            r["request_code"] = extracted_req_code
            r["course_request_id"] = extracted_req_code

        # Classify notification type & title (explicit workflows first, before generic status words)
        if "course reimbursement" in msg_lower or msg_lower.startswith("course purchase approved") or msg_lower.startswith("course purchase rejected"):
            if "paid" in msg_lower or "payment record" in msg_lower:
                r["notification_type"] = "COURSE_REIMBURSEMENT_PAID"
                r["title"] = "Course Reimbursement Paid"
            elif "approved" in msg_lower:
                r["notification_type"] = "COURSE_REIMBURSEMENT_APPROVED"
                r["title"] = "Course Reimbursement Approved"
            elif "rejected" in msg_lower:
                r["notification_type"] = "COURSE_REIMBURSEMENT_REJECTED"
                r["title"] = "Course Reimbursement Rejected"
            else:
                r["notification_type"] = "COURSE_REIMBURSEMENT_PENDING"
                r["title"] = "Course Reimbursement"
        elif "reimbursement claim" in msg_lower:
            if "paid" in msg_lower or "reimbursed" in msg_lower:
                r["notification_type"] = "REIMBURSEMENT_CLAIM_PAID"
                r["title"] = "Reimbursement Claim Paid"
            elif "approved" in msg_lower:
                r["notification_type"] = "REIMBURSEMENT_CLAIM_APPROVED"
                r["title"] = "Reimbursement Claim Approved"
            elif "rejected" in msg_lower:
                r["notification_type"] = "REIMBURSEMENT_CLAIM_REJECTED"
                r["title"] = "Reimbursement Claim Rejected"
            else:
                r["notification_type"] = "REIMBURSEMENT_CLAIM_PENDING"
                r["title"] = "Reimbursement Claim"
        elif "certification request" in msg_lower:
            if "awaits your approval" in msg_lower or "requires your approval" in msg_lower:
                r["notification_type"] = "CERTIFICATION_REQUEST_PENDING"
                r["title"] = "Certification Request"
            elif "submitted a new certification request" in msg_lower:
                r["notification_type"] = "CERTIFICATION_REQUEST_SUBMITTED"
                r["title"] = "Certification Request"
            elif "was approved" in msg_lower:
                r["notification_type"] = "CERTIFICATION_REQUEST_APPROVED"
                r["title"] = "Certification Request Approved"
            elif "was rejected" in msg_lower:
                r["notification_type"] = "CERTIFICATION_REQUEST_REJECTED"
                r["title"] = "Certification Request Rejected"
            elif "was reopened" in msg_lower:
                r["notification_type"] = "CERTIFICATION_REQUEST_REOPENED"
                r["title"] = "Certification Request Reopened"
            else:
                r["notification_type"] = "CERTIFICATION_REQUEST_SUBMITTED"
                r["title"] = "Certification Request"
        elif "course request" in msg_lower or "requested course" in msg_lower:
            if "purchased" in msg_lower or "available in the course library" in msg_lower:
                r["notification_type"] = "COURSE_REQUEST_PURCHASED"
                r["title"] = "Course Purchased"
            elif "awaiting your review" in msg_lower or "ready for purchase" in msg_lower or "urgent escalation" in msg_lower or "submitted a new course request" in msg_lower:
                r["notification_type"] = "COURSE_REQUEST_APPROVAL"
                r["title"] = "Course Request"
            elif "was approved" in msg_lower or "forwarded to the ceo" in msg_lower:
                r["notification_type"] = "COURSE_REQUEST_APPROVED"
                r["title"] = "Course Request Approved"
            elif "was not approved" in msg_lower or "rejected" in msg_lower:
                r["notification_type"] = "COURSE_REQUEST_REJECTED"
                r["title"] = "Course Request Rejected"
            elif "reopened" in msg_lower:
                r["notification_type"] = "COURSE_REQUEST_REOPENED"
                r["title"] = "Course Request Reopened"
            else:
                r["notification_type"] = "COURSE_REQUEST_SUBMITTED"
                r["title"] = "Course Request"
        elif "on hold" in msg_lower or "put on hold" in msg_lower or "hold" in msg_lower:
            r["notification_type"] = "COURSE_ON_HOLD"
            r["title"] = "Course On Hold"
        elif "approved" in msg_lower:
            r["notification_type"] = "COURSE_APPROVED"
            r["title"] = "Course Request Approved"
        elif "purchased" in msg_lower:
            r["notification_type"] = "COURSE_REQUEST_PURCHASED"
            r["title"] = "Course Purchased"
        elif "study material" in msg_lower:
            r["notification_type"] = "MATERIAL_RECOMMENDATION"
            r["title"] = "Study Material Recommended"
        elif "recommended" in msg_lower:
            r["notification_type"] = "COURSE_RECOMMENDATION"
            r["title"] = "Course Recommendation"
        elif "awaiting" in msg_lower or "pending" in msg_lower:
            r["notification_type"] = "COURSE_PENDING_APPROVAL"
            r["title"] = "Course Awaiting Review"

        m = quoted_title_re.search(msg)
        extracted_title = m.group(1).strip() if m else None
        r["_extracted_title"] = extracted_title
        if extracted_title:
            r["course_title"] = extracted_title

        if " recommended" in msg:
            sender_part = msg.split(" recommended")[0].strip()
            if sender_part:
                r["recommender_name"] = sender_part
        elif " submitted" in msg:
            sender_part = msg.split(" submitted")[0].strip()
            if sender_part:
                r["requester_name"] = sender_part
        else:
            sub_by_match = sub_by_re.search(msg)
            if sub_by_match:
                r["requester_name"] = sub_by_match.group(1).strip()
            else:
                from_match = from_re.search(msg)
                if from_match:
                    r["requester_name"] = from_match.group(1).strip()
                else:
                    paren_match = paren_re.search(msg)
                    if paren_match:
                        r["requester_name"] = paren_match.group(1).strip()

        ntype = r["notification_type"]
        if ntype.startswith("REIMBURSEMENT_CLAIM") and (extracted_req_code or extracted_title):
            need_claims = True
        elif ntype.startswith("CERTIFICATION_REQUEST") and (extracted_req_code or extracted_title):
            need_cert_reqs = True
        elif ntype.startswith("COURSE_REQUEST_") and ntype != "COURSE_REQUEST_PURCHASED" and (extracted_req_code or extracted_title):
            need_course_reqs = True
        elif extracted_title:
            if ntype == "MATERIAL_RECOMMENDATION":
                need_materials = True
            else:
                need_courses = True
        elif ntype in ("COURSE_RECOMMENDATION", "MATERIAL_RECOMMENDATION", "NOTIFICATION"):
            need_rec_fallback = True

    # Bulk preload required lookup maps (at most 1 query per needed entity instead of N+1)
    claims_by_code, claims_by_name = {}, {}
    if need_claims:
        try:
            cursor.execute("SELECT id, claim_code, certification_name, provider, 'Certification' AS claim_type FROM dbo.lms_reimbursement_claims ORDER BY id DESC")
            for cl_row in cursor.fetchall():
                if cl_row[1]:
                    claims_by_code.setdefault(str(cl_row[1]).strip().upper(), cl_row)
                if cl_row[2]:
                    claims_by_name.setdefault(str(cl_row[2]).strip().lower(), cl_row)
        except Exception:
            pass

    cert_reqs_by_code, cert_reqs_by_name = {}, {}
    if need_cert_reqs:
        try:
            cursor.execute("SELECT id, request_code, certification_name, provider, category FROM dbo.lms_certification_requests ORDER BY id DESC")
            for cert_row in cursor.fetchall():
                if cert_row[1]:
                    cert_reqs_by_code.setdefault(str(cert_row[1]).strip().upper(), cert_row)
                if cert_row[2]:
                    cert_reqs_by_name.setdefault(str(cert_row[2]).strip().lower(), cert_row)
        except Exception:
            pass

    course_reqs_by_code, course_reqs_by_name = {}, {}
    if need_course_reqs:
        try:
            cursor.execute("SELECT id, request_code, course_name, provider, category, course_link FROM dbo.lms_course_requests ORDER BY id DESC")
            for creq_row in cursor.fetchall():
                if creq_row[1]:
                    course_reqs_by_code.setdefault(str(creq_row[1]).strip().upper(), creq_row)
                if creq_row[2]:
                    course_reqs_by_name.setdefault(str(creq_row[2]).strip().lower(), creq_row)
        except Exception:
            pass

    materials_by_title = {}
    if need_materials:
        try:
            cursor.execute("SELECT file_path, material_type, id, title FROM dbo.lms_study_materials ORDER BY id DESC")
            for sm_row in cursor.fetchall():
                if sm_row[3]:
                    materials_by_title.setdefault(str(sm_row[3]).strip().lower(), sm_row)
        except Exception:
            pass

    courses_by_name, rec_new_by_name = {}, {}
    if need_courses:
        try:
            cursor.execute("SELECT provider, category, duration_minutes, support_document, id, course_name FROM dbo.lms_courses ORDER BY id DESC")
            for c_row in cursor.fetchall():
                if c_row[5]:
                    courses_by_name.setdefault(str(c_row[5]).strip().lower(), c_row)
            cursor.execute(
                """
                SELECT 
                    COALESCE(cp.ProviderName, 'Udemy') AS provider,
                    COALESCE(cc.CategoryName, 'Development') AS category,
                    rc.course_link,
                    rc.course_name
                FROM dbo.lms_recommend_new_course rc
                LEFT JOIN dbo.CourseProviders cp ON rc.provider_id = cp.ProviderId
                LEFT JOIN dbo.CourseCategories cc ON rc.category_id = cc.CategoryId
                WHERE LOWER(rc.employee_id) = LOWER(?)
                ORDER BY rc.id DESC
                """,
                (clean_emp,),
            )
            for nc_row in cursor.fetchall():
                if nc_row[3]:
                    rec_new_by_name.setdefault(str(nc_row[3]).strip().lower(), nc_row)
        except Exception:
            pass

    rec_fallback_rows = []
    if need_rec_fallback:
        try:
            cursor.execute("""
                SELECT
                    COALESCE(c.course_name, sm.title) AS title,
                    COALESCE(cp.ProviderName, sm.material_type, 'Online') AS provider,
                    COALESCE(cc.CategoryName, 'General') AS category,
                    COALESCE(c.support_document, sm.file_path) AS course_url,
                    c.duration_minutes,
                    cr.study_material_id,
                    COALESCE(c.id, sm.id) AS resolved_id,
                    CONVERT(VARCHAR(19), cr.created_at, 120) AS rec_created_at
                FROM dbo.lms_course_recommend cr
                LEFT JOIN dbo.lms_courses c ON cr.course_id = c.id
                LEFT JOIN dbo.CourseProviders cp ON c.provider_id = cp.ProviderId
                LEFT JOIN dbo.CourseCategories cc ON c.category_id = cc.CategoryId
                LEFT JOIN dbo.lms_study_materials sm ON cr.study_material_id = sm.id
                WHERE LOWER(cr.employee_id) = LOWER(?)
                  AND (c.course_name IS NOT NULL OR sm.title IS NOT NULL)
            """, (clean_emp,))
            for rec_row in cursor.fetchall():
                rec_dt = _parse_ts(rec_row[7])
                if rec_dt is not None:
                    rec_fallback_rows.append((rec_dt, rec_row))
        except Exception:
            pass

    # Second pass: enrich in memory without per-row SQL calls
    for r in rows:
        msg = (r.get("message") or "").strip()
        msg_lower = msg.lower()
        extracted_req_code = r.pop("_extracted_req_code", None)
        extracted_title = r.pop("_extracted_title", None)
        ntype = r["notification_type"]

        if ntype.startswith("REIMBURSEMENT_CLAIM"):
            cl_row = claims_by_code.get(extracted_req_code) if extracted_req_code else None
            if not cl_row and extracted_title:
                cl_row = claims_by_name.get(extracted_title.lower())
            if cl_row:
                r["course_id"] = cl_row[0]
                r["request_code"] = cl_row[1] or extracted_req_code
                r["course_request_id"] = r["request_code"]
                if not extracted_title and cl_row[2]:
                    extracted_title = cl_row[2]
                    r["course_title"] = cl_row[2]
                r["provider_name"] = cl_row[3]
                r["category_name"] = cl_row[4] or "Certification"
        elif ntype.startswith("CERTIFICATION_REQUEST"):
            cert_row = cert_reqs_by_code.get(extracted_req_code) if extracted_req_code else None
            if not cert_row and extracted_title:
                cert_row = cert_reqs_by_name.get(extracted_title.lower())
            if cert_row:
                r["course_id"] = cert_row[0]
                r["request_code"] = cert_row[1] or extracted_req_code
                r["course_request_id"] = r["request_code"]
                if not extracted_title and cert_row[2]:
                    extracted_title = cert_row[2]
                    r["course_title"] = cert_row[2]
                r["provider_name"] = cert_row[3]
                r["category_name"] = cert_row[4]
        elif ntype.startswith("COURSE_REQUEST_") and ntype != "COURSE_REQUEST_PURCHASED":
            creq_row = course_reqs_by_code.get(extracted_req_code) if extracted_req_code else None
            if not creq_row and extracted_title:
                creq_row = course_reqs_by_name.get(extracted_title.lower())
            if creq_row:
                r["course_id"] = creq_row[0]
                r["request_code"] = creq_row[1] or extracted_req_code
                r["course_request_id"] = r["request_code"]
                if not extracted_title and creq_row[2]:
                    extracted_title = creq_row[2]
                    r["course_title"] = creq_row[2]
                r["provider_name"] = creq_row[3]
                r["category_name"] = creq_row[4]
                r["course_url"] = creq_row[5]
        elif extracted_title:
            title_key = extracted_title.lower()
            if ntype == "MATERIAL_RECOMMENDATION":
                sm_row = materials_by_title.get(title_key)
                if sm_row:
                    r["course_url"] = sm_row[0]
                    r["provider_name"] = sm_row[1] or "Document"
                    r["course_id"] = sm_row[2]
            else:
                c_row = courses_by_name.get(title_key)
                if c_row:
                    r["provider_name"] = c_row[0]
                    r["category_name"] = c_row[1]
                    r["duration"] = _format_duration_minutes(c_row[2])
                    r["course_url"] = c_row[3]
                    r["course_id"] = c_row[4]
                else:
                    nc_row = rec_new_by_name.get(title_key)
                    if nc_row:
                        r["provider_name"] = nc_row[0]
                        r["category_name"] = nc_row[1]
                        r["course_url"] = nc_row[2]
        elif ntype in ("COURSE_RECOMMENDATION", "MATERIAL_RECOMMENDATION", "NOTIFICATION") and rec_fallback_rows:
            msg_dt = _parse_ts(r.get("created_at"))
            if msg_dt is not None:
                best_diff = 300
                rec_match = None
                for rec_dt, cand in rec_fallback_rows:
                    diff = abs((rec_dt - msg_dt).total_seconds())
                    if diff < best_diff:
                        best_diff = diff
                        rec_match = cand
                if rec_match:
                    extracted_title = rec_match[0]
                    r["course_title"] = extracted_title
                    r["provider_name"] = rec_match[1]
                    r["category_name"] = rec_match[2]
                    r["course_url"] = rec_match[3]
                    r["course_id"] = rec_match[6]
                    r["duration"] = _format_duration_minutes(rec_match[4])
                    if rec_match[5]:
                        r["notification_type"] = "MATERIAL_RECOMMENDATION"
                        r["title"] = "Study Material Recommended"
                    else:
                        r["notification_type"] = "COURSE_RECOMMENDATION"
                        r["title"] = "Course Recommendation"

        # Ensure notification message clearly references the course title
        if extracted_title and extracted_title.lower() not in msg_lower:
            sender = r.get("recommender_name") or "Reporting Manager"
            item_type = "study material" if r.get("notification_type") == "MATERIAL_RECOMMENDATION" else "course"
            r["message"] = f"{sender} recommended the {item_type} '{extracted_title}' to support your learning journey."

        scope, allowed_roles = _resolve_notification_scope_and_roles(
            (r.get("message") or "").strip().lower(),
            r.get("notification_type") or "NOTIFICATION"
        )
        r["notification_scope"] = scope
        r["_allowed_roles"] = allowed_roles

    scoped_rows = filter_notifications_by_view(rows, view_mode=view_mode, user_role=user_role)
    for r in scoped_rows:
        r.pop("_allowed_roles", None)
    return scoped_rows

def mark_notification_as_read(
    cursor,
    notification_id: int,
    employee_id: str
) -> bool:
    """Marks a single notification as read in dbo.lms_notifications."""
    query = """
        UPDATE dbo.lms_notifications
        SET is_read = 1
        WHERE id = ? AND LOWER(employee_id) = LOWER(?)
    """
    cursor.execute(query, (notification_id, employee_id.strip()))
    return cursor.rowcount > 0

def mark_all_notifications_as_read(
    cursor,
    employee_id: str,
    view_mode: Optional[str] = None,
    user_role: Optional[str] = None
) -> int:
    """Marks all notifications as read for an employee within active view_mode & role scope."""
    mode = str(view_mode or "").strip().upper()
    if mode in ("PRIMARY", "EMPLOYEE"):
        matching = get_user_notifications(cursor, employee_id, view_mode=mode, user_role=user_role)
        unread_ids = [int(r["notification_id"]) for r in matching if not r.get("is_read") and r.get("notification_id")]
        if not unread_ids:
            return 0
        total_updated = 0
        clean_emp = employee_id.strip()
        for idx in range(0, len(unread_ids), 400):
            chunk = unread_ids[idx:idx + 400]
            placeholders = ",".join("?" for _ in chunk)
            query = f"""
                UPDATE dbo.lms_notifications
                SET is_read = 1
                WHERE LOWER(employee_id) = LOWER(?) AND is_read = 0 AND id IN ({placeholders})
            """
            cursor.execute(query, (clean_emp, *chunk))
            total_updated += cursor.rowcount
        return total_updated

    query = """
        UPDATE dbo.lms_notifications
        SET is_read = 1
        WHERE LOWER(employee_id) = LOWER(?) AND is_read = 0
    """
    cursor.execute(query, (employee_id.strip(),))
    return cursor.rowcount

def delete_notification(
    cursor,
    notification_id: int,
    employee_id: str
) -> bool:
    """Deletes a notification from dbo.lms_notifications."""
    query = """
        DELETE FROM dbo.lms_notifications
        WHERE id = ? AND LOWER(employee_id) = LOWER(?)
    """
    cursor.execute(query, (notification_id, employee_id.strip()))
    return cursor.rowcount > 0

def insert_course_recommendation(
    cursor,
    employee_id: str,
    course_id: Optional[int] = None,
    study_material_id: Optional[int] = None,
    created_by: Optional[str] = None
) -> int:
    """Records a course recommendation into dbo.lms_course_recommend."""
    query = """
        INSERT INTO dbo.lms_course_recommend (
            employee_id, course_id, study_material_id, created_at, created_by
        )
        VALUES (?, ?, ?, GETDATE(), ?)
    """
    cursor.execute(
        query,
        (
            employee_id.strip(),
            course_id,
            study_material_id,
            (created_by or "SYSTEM").strip()
        )
    )
    cursor.execute("SELECT @@IDENTITY AS id")
    row = cursor.fetchone()
    return int(row[0]) if row and row[0] else 0

def insert_recommend_new_course(
    cursor,
    rm_id: str,
    employee_id: str,
    course_name: str,
    provider: Optional[str] = None,
    category: Optional[str] = None,
    course_link: Optional[str] = None,
    reason: Optional[str] = None,
    created_by: Optional[str] = None,
    provider_id: Optional[int] = None,
    category_id: Optional[int] = None,
    **kwargs
) -> int:
    """Records a request to recommend a new course into dbo.lms_recommend_new_course."""
    p_id = provider_id or kwargs.get("provider_id")
    c_id = category_id or kwargs.get("category_id")

    query = """
        INSERT INTO dbo.lms_recommend_new_course (
            rm_id, employee_id, course_name, provider_id, category_id,
            course_link, reason, created_at, created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, GETDATE(), ?)
    """
    cursor.execute(
        query,
        (
            rm_id.strip()[:7],
            employee_id.strip()[:7],
            course_name.strip()[:100],
            p_id,
            c_id,
            (course_link.strip()[:255] if course_link else None),
            (reason.strip()[:500] if reason else None),
            (created_by or rm_id).strip()[:7]
        )
    )
    cursor.execute("SELECT @@IDENTITY AS id")
    row = cursor.fetchone()
    return int(row[0]) if row and row[0] else 0

def get_manager_recommendations(
    cursor,
    rm_id: str
) -> List[Dict[str, Any]]:
    """Retrieves all recommended courses created by a reporting manager."""
    query = """
        SELECT 
            rc.id,
            rc.rm_id,
            rc.employee_id,
            rc.course_name,
            rc.provider_id,
            COALESCE(cp.ProviderName, 'Udemy') AS provider_name,
            COALESCE(cp.ProviderName, 'Udemy') AS provider,
            rc.category_id,
            COALESCE(cc.CategoryName, 'Development') AS category_name,
            COALESCE(cc.CategoryName, 'Development') AS category,
            rc.course_link,
            rc.reason,
            CONVERT(VARCHAR(19), rc.created_at, 120) AS created_at,
            rc.created_by
        FROM dbo.lms_recommend_new_course rc
        LEFT JOIN dbo.CourseProviders cp ON rc.provider_id = cp.ProviderId
        LEFT JOIN dbo.CourseCategories cc ON rc.category_id = cc.CategoryId
        WHERE LOWER(rc.rm_id) = LOWER(?)
        ORDER BY rc.created_at DESC, rc.id DESC
    """
    cursor.execute(query, (rm_id.strip(),))
    return dictfetchall(cursor)
