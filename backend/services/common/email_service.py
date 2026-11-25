"""
Email Notification Service (Microsoft Graph API).
Mirrors in-app notifications into branded corporate HTML emails across all 5 LMS roles:
Employee, Reporting Manager, L&D Team, HR Team, and CEO.
Dispatches asynchronously via background threads and records audit logs in dbo.lms_email_logs.
"""

import html
import re
import threading
from typing import Any, Dict, List, Optional, Tuple
from config import config
from database.connection import connect_db
from services.common.ms_graph_service import ms_graph_service


def _escape(val: Optional[Any]) -> str:
    return html.escape(str(val or ""))


def _extract_quoted_title(message: str) -> Optional[str]:
    m = re.search(r"['\"]([^'\"]{2,120})['\"]", message or "")
    return m.group(1).strip() if m else None


def _extract_code(message: str, pattern: str) -> Optional[str]:
    m = re.search(pattern, message or "", re.IGNORECASE)
    return m.group(0).strip() if m else None


def _extract_amount(message: str) -> Optional[str]:
    m = re.search(r"(\$|₹|USD|INR)\s?\d[\d,]*(?:\.\d{1,2})?", message or "", re.IGNORECASE)
    return m.group(0).strip() if m else None


def classify_notification_for_email(
    message: str,
    recipient_role: str = "Employee"
) -> Dict[str, Any]:
    """
    Classifies an in-app notification message into structured email metadata:
    event_type, subject, badge_label, badge_bg, badge_fg, cta_label, cta_path, details.
    """
    msg = (message or "").strip()
    msg_lower = msg.lower()
    role_lower = (recipient_role or "Employee").strip().lower()

    title = _extract_quoted_title(msg)
    req_code = _extract_code(msg, r"(?:ERC|CRQ|REQ|CLM|PAY)-\d+(?:-\d+)?")
    amount = _extract_amount(msg)

    details: List[Tuple[str, str]] = []
    if req_code:
        details.append(("Reference Code", f"#{req_code}"))
    if title:
        details.append(("Program / Item", title))
    if amount:
        details.append(("Amount", amount))

    # 1. Course Purchased / Credentials Ready
    if any(k in msg_lower for k in ("has been purchased", "was purchased", "credentials", "course ready")):
        return {
            "event_type": "COURSE_PURCHASED",
            "subject": f"[Emergere LMS] Course Ready: '{title or 'Course Access'}'",
            "badge_label": "COURSE READY",
            "badge_bg": "#ECFDF5",
            "badge_fg": "#047857",
            "cta_label": "Access Course in LMS",
            "cta_path": "/employee/course-library",
            "details": details,
        }

    # 2. Reimbursement Claim Paid / Settled
    if "reimbursement" in msg_lower and ("has been paid" in msg_lower or "settled" in msg_lower or "disbursed" in msg_lower):
        return {
            "event_type": "REIMBURSEMENT_PAID",
            "subject": f"[Emergere LMS] Reimbursement Processed{f': #{req_code}' if req_code else ''}{f' ({amount})' if amount else ''}",
            "badge_label": "REIMBURSEMENT PAID",
            "badge_bg": "#ECFDF5",
            "badge_fg": "#047857",
            "cta_label": "View Payment Slip",
            "cta_path": "/employee/certifications",
            "details": details,
        }

    # 3. Reimbursement Claim Review (RM / L&D / HR)
    if "reimbursement" in msg_lower and any(k in msg_lower for k in ("awaiting", "requires your", "submitted", "review")):
        cta_path = "/hr/approvals" if "hr" in role_lower else (
            "/ld/approvals" if "l&d" in role_lower else "/reporting-manager/approvals"
        )
        return {
            "event_type": "REIMBURSEMENT_REVIEW",
            "subject": f"[Emergere LMS] Action Required: Reimbursement Claim{f' #{req_code}' if req_code else ''}",
            "badge_label": "ACTION REQUIRED",
            "badge_bg": "#EFF6FF",
            "badge_fg": "#1D4ED8",
            "cta_label": "Review Claim",
            "cta_path": cta_path,
            "details": details,
        }

    # 4. Reimbursement Claim Decision (Approved / Rejected)
    if "reimbursement" in msg_lower:
        is_rejected = "rejected" in msg_lower or "declined" in msg_lower
        return {
            "event_type": "REIMBURSEMENT_STATUS",
            "subject": f"[Emergere LMS] Reimbursement Claim {'Rejected' if is_rejected else 'Update'}{f': #{req_code}' if req_code else ''}",
            "badge_label": "DECLINED" if is_rejected else "APPROVED",
            "badge_bg": "#FEF2F2" if is_rejected else "#ECFDF5",
            "badge_fg": "#B91C1C" if is_rejected else "#047857",
            "cta_label": "View Claim Details",
            "cta_path": "/employee/certifications",
            "details": details,
        }

    # 5. Certification Request Review (RM / L&D / CEO)
    if "certification" in msg_lower and any(k in msg_lower for k in ("awaiting", "requires your", "submitted", "approval")):
        cta_path = "/ceo/approvals" if "ceo" in role_lower else (
            "/ld/approvals" if "l&d" in role_lower else "/reporting-manager/approvals"
        )
        return {
            "event_type": "CERTIFICATION_REVIEW",
            "subject": f"[Emergere LMS] Certification Approval Needed{f': {title}' if title else ''}",
            "badge_label": "APPROVAL NEEDED",
            "badge_bg": "#EFF6FF",
            "badge_fg": "#1D4ED8",
            "cta_label": "Review Certification Request",
            "cta_path": cta_path,
            "details": details,
        }

    # 6. Certification Request Decision
    if "certification" in msg_lower:
        is_rejected = "rejected" in msg_lower or "declined" in msg_lower
        return {
            "event_type": "CERTIFICATION_STATUS",
            "subject": f"[Emergere LMS] Certification Request {'Declined' if is_rejected else 'Approved'}{f': {title}' if title else ''}",
            "badge_label": "DECLINED" if is_rejected else "APPROVED",
            "badge_bg": "#FEF2F2" if is_rejected else "#ECFDF5",
            "badge_fg": "#B91C1C" if is_rejected else "#047857",
            "cta_label": "View Certification",
            "cta_path": "/employee/certifications",
            "details": details,
        }

    # 7. Course Request Review (RM / L&D / CEO / Purchase)
    if any(k in msg_lower for k in ("ready for purchase", "ceo approved", "awaiting your approval", "requires your approval", "awaiting your review", "requested course", "submitted a new course request")):
        if "ready for purchase" in msg_lower or "ceo approved" in msg_lower:
            cta_path = "/ld/course-management"
            cta_label = "Process Procurement"
            subj = f"[Emergere LMS] Ready for Purchase{f': {title}' if title else ''}"
        elif "ceo" in role_lower:
            cta_path = "/ceo/approvals"
            cta_label = "Executive Decision Portal"
            subj = f"[Emergere LMS] Executive Approval Needed{f': {title}' if title else ''}"
        elif "l&d" in role_lower:
            cta_path = "/ld/approvals"
            cta_label = "Open L&D Approvals"
            subj = f"[Emergere LMS] L&D Review Required{f': {title}' if title else ''}"
        else:
            cta_path = "/reporting-manager/approvals"
            cta_label = "Review & Endorse Request"
            subj = f"[Emergere LMS] Course Request Review{f': {title}' if title else ''}"

        return {
            "event_type": "COURSE_REQUEST_REVIEW",
            "subject": subj,
            "badge_label": "ACTION REQUIRED",
            "badge_bg": "#EFF6FF",
            "badge_fg": "#1D4ED8",
            "cta_label": cta_label,
            "cta_path": cta_path,
            "details": details,
        }

    # 8. Course Assigned
    if "assigned" in msg_lower and ("course" in msg_lower or "l&d" in msg_lower):
        return {
            "event_type": "COURSE_ASSIGNED",
            "subject": f"[Emergere LMS] New Course Assigned{f': {title}' if title else ''}",
            "badge_label": "ASSIGNED COURSE",
            "badge_bg": "#EFF6FF",
            "badge_fg": "#1D4ED8",
            "cta_label": "Start Learning Now",
            "cta_path": "/employee/dashboard",
            "details": details,
        }

    # 9. Course / Material Recommended
    if "recommended" in msg_lower:
        return {
            "event_type": "COURSE_RECOMMENDATION",
            "subject": f"[Emergere LMS] Course Recommendation{f': {title}' if title else ''}",
            "badge_label": "RECOMMENDED",
            "badge_bg": "#F5F3FF",
            "badge_fg": "#6D28D9",
            "cta_label": "Explore in Course Library",
            "cta_path": "/employee/course-library",
            "details": details,
        }

    # 10. Expiry Reminders
    if "expir" in msg_lower or "urgent:" in msg_lower or "reminder:" in msg_lower:
        is_urgent = "urgent" in msg_lower or "7 day" in msg_lower
        return {
            "event_type": "COURSE_EXPIRY_REMINDER",
            "subject": f"[Emergere LMS] {'Urgent ' if is_urgent else ''}Course Expiry Reminder{f': {title}' if title else ''}",
            "badge_label": "URGENT REMINDER" if is_urgent else "REMINDER",
            "badge_bg": "#FEF2F2" if is_urgent else "#FFF7ED",
            "badge_fg": "#B91C1C" if is_urgent else "#C2410C",
            "cta_label": "Resume Course",
            "cta_path": "/employee/dashboard",
            "details": details,
        }

    # 11. On-Hold / Rejected / Approved general course updates
    if "on hold" in msg_lower:
        return {
            "event_type": "COURSE_ON_HOLD",
            "subject": f"[Emergere LMS] Course Request On Hold{f': {title}' if title else ''}",
            "badge_label": "ON HOLD",
            "badge_bg": "#FFF7ED",
            "badge_fg": "#C2410C",
            "cta_label": "View Status in LMS",
            "cta_path": "/employee/course-library",
            "details": details,
        }

    if "approved" in msg_lower:
        return {
            "event_type": "COURSE_APPROVED",
            "subject": f"[Emergere LMS] Approved{f': {title}' if title else ''}",
            "badge_label": "APPROVED",
            "badge_bg": "#ECFDF5",
            "badge_fg": "#047857",
            "cta_label": "View in LMS Portal",
            "cta_path": "/employee/course-library",
            "details": details,
        }

    if "rejected" in msg_lower or "declined" in msg_lower:
        return {
            "event_type": "COURSE_REJECTED",
            "subject": f"[Emergere LMS] Request Declined{f': {title}' if title else ''}",
            "badge_label": "DECLINED",
            "badge_bg": "#FEF2F2",
            "badge_fg": "#B91C1C",
            "cta_label": "View Details in LMS",
            "cta_path": "/employee/course-library",
            "details": details,
        }

    # Fallback General Notification
    return {
        "event_type": "GENERAL_NOTIFICATION",
        "subject": f"[Emergere LMS] Notification{f': {title}' if title else ''}",
        "badge_label": "NOTIFICATION",
        "badge_bg": "#F1F5F9",
        "badge_fg": "#334155",
        "cta_label": "Open Emergere LMS",
        "cta_path": "/employee/dashboard",
        "details": details,
    }


def render_email_html(
    recipient_name: str,
    message: str,
    meta: Dict[str, Any],
    portal_url: str
) -> str:
    """Renders a clean, responsive corporate HTML email matching Emergere LMS branding."""
    safe_name = _escape(recipient_name or "Team Member")
    safe_msg = _escape(message).replace("\n", "<br/>")
    badge_label = _escape(meta.get("badge_label", "NOTIFICATION"))
    badge_bg = meta.get("badge_bg", "#EFF6FF")
    badge_fg = meta.get("badge_fg", "#1D4ED8")
    cta_label = _escape(meta.get("cta_label", "Open LMS Portal"))
    cta_href = f"{portal_url.rstrip('/')}{meta.get('cta_path', '/employee/dashboard')}"

    details_html = ""
    details: List[Tuple[str, str]] = meta.get("details") or []
    if details:
        rows = "".join(
            f"""
            <tr>
                <td style="padding:8px 12px;font-size:13px;font-weight:600;color:#475569;border-bottom:1px solid #E2E8F0;width:36%;">{_escape(k)}</td>
                <td style="padding:8px 12px;font-size:13px;color:#0F172A;border-bottom:1px solid #E2E8F0;">{_escape(v)}</td>
            </tr>
            """
            for k, v in details
        )
        details_html = f"""
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;background-color:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;border-collapse:collapse;">
            {rows}
        </table>
        """

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>{_escape(meta.get("subject", "Emergere LMS Notification"))}</title>
</head>
<body style="margin:0;padding:0;background-color:#F1F5F9;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0F172A;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;background-color:#F1F5F9;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;box-shadow:0 4px 12px rgba(15,23,42,0.06);">
                    <!-- Header -->
                    <tr>
                        <td style="background:linear-gradient(135deg,#1E40AF 0%,#2563EB 100%);padding:22px 28px;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td>
                                        <div style="font-size:18px;font-weight:700;color:#FFFFFF;letter-spacing:-0.01em;">Emergere Learning &amp; Development</div>
                                        <div style="font-size:12px;color:#DBEAFE;margin-top:2px;">Learning Management System Portal</div>
                                    </td>
                                    <td align="right">
                                        <span style="display:inline-block;background-color:{badge_bg};color:{badge_fg};font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;letter-spacing:0.04em;">
                                            {badge_label}
                                        </span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style="padding:28px;">
                            <p style="margin:0 0 16px 0;font-size:15px;font-weight:600;color:#0F172A;">
                                Dear {safe_name},
                            </p>
                            <p style="margin:0 0 18px 0;font-size:14px;line-height:1.6;color:#334155;">
                                {safe_msg}
                            </p>

                            {details_html}

                            <table cellpadding="0" cellspacing="0" style="margin:26px 0 8px 0;">
                                <tr>
                                    <td align="center" style="border-radius:8px;background-color:#2563EB;">
                                        <a href="{_escape(cta_href)}" target="_blank" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:8px;">
                                            {cta_label} &rarr;
                                        </a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color:#F8FAFC;padding:18px 28px;border-top:1px solid #E2E8F0;">
                            <p style="margin:0 0 6px 0;font-size:12px;color:#64748B;">
                                This is an automated notification from the Emergere LMS Portal.
                            </p>
                            <p style="margin:0;font-size:11px;color:#94A3B8;">
                                &copy; Emergere Computing Solutions. For assistance, contact the L&amp;D Team.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>"""


class EmailNotificationService:
    """Orchestrates background Microsoft Graph API email dispatch and audit logging."""

    def _log_email_attempt(
        self,
        recipient_email: str,
        recipient_name: Optional[str],
        recipient_role: Optional[str],
        subject: str,
        event_type: str,
        status: str,
        error_message: Optional[str] = None,
        reference_id: Optional[str] = None,
        reference_type: Optional[str] = None
    ):
        """Persists email delivery audit record into dbo.lms_email_logs."""
        conn = None
        try:
            conn = connect_db()
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO dbo.lms_email_logs (
                    recipient_email, recipient_name, recipient_role,
                    subject, event_type, status, sent_at,
                    error_message, reference_id, reference_type
                )
                VALUES (?, ?, ?, ?, ?, ?, GETDATE(), ?, ?, ?)
                """,
                (
                    str(recipient_email or "")[:255],
                    str(recipient_name or "")[:100] if recipient_name else None,
                    str(recipient_role or "")[:50] if recipient_role else None,
                    str(subject or "")[:255],
                    str(event_type or "GENERAL")[:60],
                    str(status or "PENDING")[:20],
                    str(error_message) if error_message else None,
                    str(reference_id)[:50] if reference_id else None,
                    str(reference_type)[:50] if reference_type else None,
                )
            )
            conn.commit()
        except Exception as log_err:
            print(f"[EmailService] Failed to log email record: {log_err}")
        finally:
            if conn is not None:
                try:
                    conn.close()
                except Exception:
                    pass

    def send_notification_email_sync(
        self,
        employee_id: str,
        message: str,
        reference_id: Optional[str] = None,
        reference_type: Optional[str] = None,
        explicit_subject: Optional[str] = None
    ) -> Dict[str, Any]:
        """Resolves employee email, builds HTML email, dispatches via MS Graph, and logs result."""
        from services.common.auth_service import employee_service

        emp_code = str(employee_id or "").strip()
        if not emp_code or emp_code.upper() == "ALL":
            return {"status": "SKIPPED", "reason": "Broadcast target ALL skipped"}

        emp = employee_service.get_employee_by_id(emp_code)
        if not emp:
            self._log_email_attempt(
                recipient_email=f"{emp_code}@unknown",
                recipient_name=emp_code,
                recipient_role="Unknown",
                subject=explicit_subject or "[Emergere LMS] Notification",
                event_type="UNKNOWN_USER",
                status="SKIPPED_NO_EMAIL",
                error_message=f"Employee '{emp_code}' not found in directory",
                reference_id=reference_id,
                reference_type=reference_type,
            )
            return {"status": "SKIPPED_NO_EMAIL", "employee_id": emp_code}

        recipient_email = (emp.get("work_email") or emp.get("email") or "").strip()
        recipient_name = emp.get("name") or emp.get("full_name") or emp_code
        recipient_role = emp.get("role") or "Employee"

        if not recipient_email or "@" not in recipient_email:
            self._log_email_attempt(
                recipient_email=recipient_email or f"{emp_code}@missing",
                recipient_name=recipient_name,
                recipient_role=recipient_role,
                subject=explicit_subject or "[Emergere LMS] Notification",
                event_type="NO_EMAIL",
                status="SKIPPED_NO_EMAIL",
                error_message="No valid corporate email address on employee record",
                reference_id=reference_id,
                reference_type=reference_type,
            )
            return {"status": "SKIPPED_NO_EMAIL", "employee_id": emp_code}

        meta = classify_notification_for_email(message, recipient_role=recipient_role)
        if explicit_subject:
            meta["subject"] = explicit_subject

        portal_url = getattr(config, "FRONTEND_URL", "http://localhost:3000")
        html_body = render_email_html(
            recipient_name=recipient_name,
            message=message,
            meta=meta,
            portal_url=portal_url,
        )

        # Dispatch via Microsoft Graph API
        send_res = ms_graph_service.send_mail(
            to_email=recipient_email,
            subject=meta["subject"],
            html_body=html_body,
        )

        if send_res.get("success"):
            status_val = "SENT"
            err_msg = None
        else:
            status_val = "FAILED"
            err_msg = send_res.get("error") or "Unknown Microsoft Graph dispatch error"

        self._log_email_attempt(
            recipient_email=recipient_email,
            recipient_name=recipient_name,
            recipient_role=recipient_role,
            subject=meta["subject"],
            event_type=meta["event_type"],
            status=status_val,
            error_message=err_msg,
            reference_id=reference_id,
            reference_type=reference_type,
        )
        return {
            "status": status_val,
            "recipient_email": recipient_email,
            "subject": meta["subject"],
            "event_type": meta["event_type"],
            "method": send_res.get("method"),
            "error": err_msg,
        }

    def enqueue_notification_email(
        self,
        employee_id: str,
        message: str,
        reference_id: Optional[str] = None,
        reference_type: Optional[str] = None,
        explicit_subject: Optional[str] = None
    ):
        """Non-blocking background dispatch for email notification."""
        if not employee_id or str(employee_id).strip().upper() == "ALL":
            return

        t = threading.Thread(
            target=self.send_notification_email_sync,
            args=(employee_id, message, reference_id, reference_type, explicit_subject),
            daemon=True,
        )
        t.start()


email_service = EmailNotificationService()
