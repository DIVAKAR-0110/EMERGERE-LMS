"""
FastAPI Authentication & User Profile Router.
Provides GET /me, dev login, role switching, and Azure AD directory endpoints.
Maintains 100% contract compatibility with the React frontend.
"""

import urllib.parse
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from models.common.auth_models import DevLoginRequest, RoleUpdateRequest, LogoutRequest
from services.common.auth_service import employee_service, ALLOWED_ROLES
from utils.auth import get_current_user, require_employee_id
from config import config

router = APIRouter(prefix="/auth", tags=["Basics"])

def format_user_dto(employee: Dict[str, Any]) -> Dict[str, Any]:
    azure_oid = employee.get("microsoft_object_id") or employee.get("azure_user_id") or employee.get("id") or ""
    return {
        "employee_id": employee["employee_id"],
        "azure_user_id": azure_oid,
        "microsoft_object_id": azure_oid,
        "name": employee.get("name", ""),
        "full_name": employee.get("full_name", employee.get("name", "")),
        "email": employee.get("email", ""),
        "work_email": employee.get("work_email", employee.get("email", "")),
        "role": employee["role"],
        "job_title": employee.get("job_title", employee["role"]),
        "department": employee.get("department", "Engineering"),
        "job_location": employee.get("job_location", "Coimbatore, India"),
        "mobile_number": employee.get("mobile_number", "+91 98765 42301"),
        "reporting_manager": employee.get("reporting_manager", "Gowri Shankar (CEO)"),
        "reporting_manager_id": employee.get("reporting_manager_id"),
        "date_of_joining": employee.get("date_of_joining", "01/06/2024"),
        "linkedin_url": employee.get("linkedin_url") or None,
        "is_active": employee.get("is_active", True)
    }

@router.get(
    "/me",
    summary="Verify Current User Session & RBAC Access",
    response_description="Authenticated employee session identity, role, and RBAC portal permissions"
)
@router.get(
    "/session",
    summary="Verify Current User Session & RBAC Access (Alias)",
    include_in_schema=False
)
def verify_current_session(
    employee_id: Optional[str] = None,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Returns the authenticated employee's LMS session identity and RBAC portal permissions.
    Fetches real-time attributes from Microsoft Entra ID and automatically synchronizes
    the employee's Microsoft Object ID into dbo.lms_employee_profiles.
    """
    active_user = user
    if employee_id and config.ENABLE_DEV_MOCK_AUTH:
        target_emp = employee_service.get_employee_by_id(employee_id)
        if not target_emp:
            for emp in employee_service.get_all_employees():
                if (emp.get("email") or "").strip().lower() == employee_id.strip().lower():
                    target_emp = emp
                    break
        if target_emp:
            active_user = target_emp

    is_completed = False
    db_linkedin_url = None
    try:
        from database.connection import connect_db
        from repositories.common import profile_repository
        from repositories.hr import dashboard_repository as hr_activity_repository
        conn = connect_db()
        cursor = conn.cursor()
        emp_id = require_employee_id(active_user)
        is_completed = profile_repository.is_profile_completed(cursor, emp_id)
        if is_completed:
            prof_row = profile_repository.get_profile_by_employee_code(cursor, emp_id)
            if prof_row:
                db_linkedin_url = prof_row.get("linkedin_url") or None

        # First-time login: If employee is not in dbo.lms_employee_profiles, log onboarding to HR activity feed
        if not is_completed:
            if not hr_activity_repository.has_employee_onboard_logged(cursor, emp_id):
                emp_name = active_user.get("name") or active_user.get("full_name") or emp_id
                hr_activity_repository.insert_hr_activity(
                    cursor,
                    activity_type="EMPLOYEE_ONBOARDED",
                    message=f"New Employee Onboarded - {emp_name}",
                    created_by=emp_id
                )
                conn.commit()

        # Record session login (reuses active session if within 30 min to prevent duplicate rows on page reloads)
        try:
            from repositories.common import employee_log_repository
            employee_log_repository.record_login(cursor, emp_id, min_gap_minutes=30)
            conn.commit()
        except Exception as log_err:
            print(f"[AuthRouter] Warning logging session in /me: {log_err}")

        conn.close()
    except Exception as e:
        print(f"[AuthRouter] Notice checking profile completion on session verify: {e}")

    access_profile = employee_service.get_access_profile(active_user)
    user_dto = format_user_dto(active_user)
    user_dto["linkedin_url"] = db_linkedin_url
    user_dto["is_profile_completed"] = is_completed

    return {
        "authenticated": True,
        "user": user_dto,
        "is_profile_completed": is_completed,
        "access": access_profile
    }

@router.get("/team-members")
def get_my_team_members(
    manager_id: Optional[str] = None,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Returns direct reports assigned to the specified manager or currently authenticated reporting manager.
    Fetches real-time manager-employee relationships from Microsoft Entra ID.
    """
    target_id = manager_id or user.get("employee_id") or user.get("microsoft_object_id") or ""
    members = employee_service.get_team_members(target_id)
    if not members and not manager_id:
        mgr_name = user.get("name") or user.get("full_name") or ""
        members = employee_service.get_team_members(mgr_name)
    return {"members": [format_user_dto(m) for m in members]}

@router.get("/employees")
def get_all_employees(user: Dict[str, Any] = Depends(get_current_user)):
    """
    Returns all enterprise employees directly from Microsoft Entra ID,
    enriched with live LMS learning status, enrolled courses (in progress + completed),
    and total certifications count.
    Accessible to authenticated users.
    """
    employees = employee_service.get_all_employees()
    metrics_map = employee_service.get_all_employees_learning_metrics()

    latest_logs_map = {}
    try:
        from database.connection import connect_db
        from repositories.common import employee_log_repository
        conn = connect_db()
        cur = conn.cursor()
        try:
            latest_logs_map = employee_log_repository.get_latest_logs_for_all_employees(cur)
        finally:
            cur.close()
            conn.close()
    except Exception as err:
        print(f"[Auth] Warning: Could not fetch employee logs: {err}")

    formatted_list = []
    for e in employees:
        dto = format_user_dto(e)
        emp_code = str(dto.get("employee_id") or "").strip().lower()
        m = metrics_map.get(emp_code, {
            "in_progress": 0, "completed": 0, "certificates": 0,
            "certifications": 0, "avg_progress": 0, "total_hours": 0
        })
        in_prog = m.get("in_progress", 0)
        comp = m.get("completed", 0)
        courses_total = in_prog + comp
        certs_total = m.get("certificates", m.get("certifications", 0))
        avg_prog = m.get("avg_progress", 0)
        total_hours = m.get("total_hours", 0)
        learning_status = "Active" if in_prog >= 1 else "Inactive"

        log_info = latest_logs_map.get(emp_code, {})
        dto["last_logged_in"] = log_info.get("last_logged_in")
        dto["last_logged_out"] = log_info.get("last_logged_out")

        dto["in_progress_courses_count"] = in_prog
        dto["completed_courses_count"] = comp
        dto["courses_count"] = courses_total
        dto["courses"] = courses_total
        dto["learning_status"] = learning_status
        dto["learningStatus"] = learning_status
        dto["certificates"] = certs_total
        dto["certificates_count"] = certs_total
        dto["certifications_count"] = certs_total
        dto["certifications"] = certs_total
        dto["progress"] = avg_prog
        dto["avg_progress"] = avg_prog
        dto["total_learning_hours"] = total_hours
        dto["hours"] = f"{total_hours}h"

        formatted_list.append(dto)

    return {
        "employees": formatted_list,
        "total": len(formatted_list)
    }

@router.post("/dev-login")
def dev_login(data: DevLoginRequest):
    """
    Authenticates a mock session for a specific employee ID.
    Used for seamless developer testing and role switching.
    """
    if not config.ENABLE_DEV_MOCK_AUTH:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Developer authentication is disabled"
        )

    employee = employee_service.get_employee_by_id(data.employee_id)
    if not employee:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your Microsoft account is authenticated, but you are not registered in the LMS."
        )

    if not employee.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access disabled. Contact HR/L&D"
        )

    is_completed = False
    db_linkedin_url = None
    try:
        from database.connection import connect_db
        from repositories.common import profile_repository
        from repositories.hr import dashboard_repository as hr_activity_repository
        conn = connect_db()
        cursor = conn.cursor()
        emp_id = require_employee_id(employee)
        is_completed = profile_repository.is_profile_completed(cursor, emp_id)
        if is_completed:
            prof_row = profile_repository.get_profile_by_employee_code(cursor, emp_id)
            if prof_row:
                db_linkedin_url = prof_row.get("linkedin_url") or None

        # First-time login: If employee is not in dbo.lms_employee_profiles, log onboarding to HR activity feed
        if not is_completed:
            if not hr_activity_repository.has_employee_onboard_logged(cursor, emp_id):
                emp_name = employee.get("name") or employee.get("full_name") or emp_id
                hr_activity_repository.insert_hr_activity(
                    cursor,
                    activity_type="EMPLOYEE_ONBOARDED",
                    message=f"New Employee Onboarded - {emp_name}",
                    created_by=emp_id
                )
                conn.commit()

        # Record new session login in dbo.lms_employee_logs
        try:
            from repositories.common import employee_log_repository
            employee_log_repository.record_login(cursor, emp_id, min_gap_minutes=0)
            conn.commit()
        except Exception as log_err:
            print(f"[AuthRouter] Warning logging session in dev-login: {log_err}")

        conn.close()
    except Exception as e:
        print(f"[AuthRouter] Notice checking profile completion on dev-login: {e}")

    access_profile = employee_service.get_access_profile(employee)
    dev_token = f"dev-token-{employee['employee_id']}"
    user_dto = format_user_dto(employee)
    user_dto["linkedin_url"] = db_linkedin_url
    user_dto["is_profile_completed"] = is_completed

    return {
        "authenticated": True,
        "token": dev_token,
        "user": user_dto,
        "is_profile_completed": is_completed,
        "access": access_profile
    }

@router.post("/switch-role")
def switch_role(data: RoleUpdateRequest, user: Dict[str, Any] = Depends(get_current_user)):
    """Switches the active test user's role for role-based interface testing."""
    if not config.ENABLE_DEV_MOCK_AUTH:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Role switching is disabled in production"
        )

    if data.role not in ALLOWED_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: {', '.join(ALLOWED_ROLES)}"
        )

    updated = employee_service.update_employee_role(user["employee_id"], data.role)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update role"
        )

    access_profile = employee_service.get_access_profile(updated)
    return {
        "success": True,
        "message": f"Role switched to '{data.role}' for {user.get('name', 'User')}",
        "user": format_user_dto(updated),
        "access": access_profile
    }

@router.post("/logout", summary="Log Out & Record Session End")
def logout_user(
    data: Optional[LogoutRequest] = None,
    request: Request = None,
):
    """
    Closes the active employee login session in dbo.lms_employee_logs by setting last_logged_out = GETDATE().
    """
    emp_id = None
    if data and data.employee_id:
        emp_id = str(data.employee_id).strip().upper()
    elif request:
        auth_header = request.headers.get("Authorization") or ""
        if "dev-token-" in auth_header:
            emp_id = auth_header.split("dev-token-")[-1].strip().upper()

    if not emp_id:
        return {"success": True, "message": "Logged out (no employee specified)"}

    from database.connection import connect_db
    from repositories.common import employee_log_repository
    conn = connect_db()
    cursor = conn.cursor()
    try:
        employee_log_repository.record_logout(cursor, emp_id)
        conn.commit()
    except Exception as e:
        print(f"[AuthRouter] Notice during logout recording for {emp_id}: {e}")
    finally:
        conn.close()

    return {"success": True, "message": f"Session logged out for {emp_id}"}

@router.get("/employee-logs/{employee_id}", summary="Get Daily Login/Logout Attendance for Individual Employee")
def get_employee_daily_logs(
    employee_id: str,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Returns day-by-day attendance history (first login, last logout, hours active)
    and detailed recent sessions for an individual employee from dbo.lms_employee_logs.
    """
    from database.connection import connect_db
    from repositories.common import employee_log_repository
    conn = connect_db()
    cursor = conn.cursor()
    try:
        daily_logs = employee_log_repository.get_daily_logs_for_employee(
            cursor, employee_id, date_from=date_from, date_to=date_to
        )
        sessions = employee_log_repository.get_all_sessions_for_employee(
            cursor, employee_id, limit=30
        )
        return {
            "employee_id": employee_id,
            "daily_logs": daily_logs,
            "recent_sessions": sessions,
            "total_days_logged": len(daily_logs)
        }
    finally:
        conn.close()

@router.get("/outlook/login", summary="Initiate Outlook OAuth Sign-in")
def outlook_oauth_login():
    """
    Initiates Microsoft OAuth 2.0 authorization code flow for personal or corporate Outlook accounts.
    Redirects user to Microsoft sign-in consent screen.
    """
    client_id = getattr(config, "OUTLOOK_CLIENT_ID", "91a87758-fad3-4d70-a8db-b1a486a7b9df")
    redirect_uri = getattr(config, "OUTLOOK_REDIRECT_URI", "http://localhost:5000/api/auth/callback")
    tenant = getattr(config, "OUTLOOK_TENANT_ID", "common")

    query = urllib.parse.urlencode({
        "client_id": client_id,
        "response_type": "code",
        "redirect_uri": redirect_uri,
        "response_mode": "query",
        "scope": "offline_access User.Read Mail.Read",
        "prompt": "select_account",
        "state": "outlook_auth"
    })
    auth_url = f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize?{query}"
    return RedirectResponse(url=auth_url, status_code=307)


@router.get("/callback", response_class=HTMLResponse, summary="Outlook OAuth Callback")
@router.get("/outlook/callback", response_class=HTMLResponse, summary="Outlook OAuth Callback Alias")
def outlook_oauth_callback(
    code: Optional[str] = None,
    error: Optional[str] = None,
    error_description: Optional[str] = None,
    state: Optional[str] = None
):
    """
    Handles OAuth 2.0 callback from Microsoft identity platform.
    Exchanges authorization code for access and refresh tokens, storing them securely for automated OTP reading.
    """
    if error:
        return HTMLResponse(content=f"""
        <!DOCTYPE html>
        <html>
            <head><title>Authentication Failed - Emergere LMS</title><meta charset="utf-8"></head>
            <body style="font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
                <div style="background: #1e293b; padding: 40px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); max-width: 500px; text-align: center; border: 1px solid #ef4444;">
                    <h2 style="color: #ef4444; margin-top: 0;">❌ Authentication Error</h2>
                    <p style="color: #94a3b8; font-size: 14px;">Microsoft returned an error during sign-in:</p>
                    <p style="background: #0f172a; padding: 12px; border-radius: 6px; font-family: monospace; color: #fca5a5; word-break: break-all;">{error}: {error_description}</p>
                    <a href="/api/auth/outlook/login" style="display: inline-block; margin-top: 16px; padding: 10px 20px; background: #6366f1; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">Try Again</a>
                </div>
            </body>
        </html>
        """, status_code=400)

    if not code:
        return HTMLResponse(content="<h3>Error: Missing authorization code from Microsoft.</h3>", status_code=400)

    try:
        from services.common.ms_graph_service import ms_graph_service
        token_data, user_profile = ms_graph_service.exchange_auth_code_for_token(code)
        account_name = user_profile.get("displayName", "User")
        account_email = user_profile.get("mail") or user_profile.get("userPrincipalName") or config.TEST_MICROSOFT_ACCOUNT_EMAIL

        return HTMLResponse(content=f"""
        <!DOCTYPE html>
        <html>
            <head>
                <title>Outlook Connected - Emergere LMS</title>
                <meta charset="utf-8">
            </head>
            <body style="font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
                <div style="background: #1e293b; padding: 40px; border-radius: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); max-width: 480px; text-align: center; border: 1px solid #22c55e;">
                    <div style="width: 64px; height: 64px; background: rgba(34, 197, 94, 0.15); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 32px; color: #22c55e;">
                        ✓
                    </div>
                    <h2 style="color: #22c55e; margin: 0 0 10px; font-size: 24px;">Outlook Connected!</h2>
                    <p style="color: #94a3b8; font-size: 15px; margin-bottom: 24px;">
                        Microsoft Account <strong style="color: #38bdf8;">{account_email}</strong> ({account_name}) is now securely connected to Emergere LMS.
                    </p>
                    <div style="background: #0f172a; padding: 16px; border-radius: 8px; text-align: left; font-size: 13px; color: #cbd5e1; margin-bottom: 24px;">
                        <div>⚡ <strong>Delegated Permission:</strong> Mail.Read active</div>
                        <div style="margin-top: 6px;">🔒 <strong>Token Status:</strong> Securely saved in backend</div>
                        <div style="margin-top: 6px;">🚀 <strong>LMS Extension:</strong> Automated OTP fetching enabled</div>
                    </div>
                    <p style="color: #64748b; font-size: 13px; margin-bottom: 20px;">You can now close this tab and return to Udemy / LMS.</p>
                    <button onclick="window.close()" style="background: #3b82f6; color: white; border: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;">Close Window</button>
                </div>
            </body>
        </html>
        """)
    except Exception as e:
        return HTMLResponse(content=f"""
        <!DOCTYPE html>
        <html>
            <head><title>Connection Error - Emergere LMS</title><meta charset="utf-8"></head>
            <body style="font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 40px;">
                <h2 style="color: #ef4444;">Failed to exchange authorization token</h2>
                <pre style="background: #1e293b; padding: 16px; border-radius: 8px; color: #fca5a5;">{str(e)}</pre>
                <a href="/api/auth/outlook/login" style="color: #38bdf8;">Click here to retry authentication</a>
            </body>
        </html>
        """, status_code=500)

