"""
Employee service business logic layer.
Fetches employee records, roles, departments, and reporting relationships
directly from Microsoft Entra ID (Azure AD) via Microsoft Graph API.
No employee table in the local database is required.
"""

import threading
import time
import requests
from typing import Optional, Dict, Any, List
from config import config

# Allowed standard LMS Roles
ALLOWED_ROLES = ["Employee", "Reporting Manager", "L&D Team", "HR Team", "CEO"]

# Role normalization mapping (handles aliases from Entra ID jobTitle)
ROLE_ALIASES = {
    "ceo": "CEO",
    "executive": "CEO",
    "chief executive officer": "CEO",
    "reporting manager": "Reporting Manager",
    "manager": "Reporting Manager",
    "lead": "Reporting Manager",
    "l&d": "L&D Team",
    "l&d team": "L&D Team",
    "learning & development": "L&D Team",
    "learning and development": "L&D Team",
    "hr": "HR Team",
    "hr team": "HR Team",
    "human resources": "HR Team",
    "employee": "Employee",
}

# Mapping primary roles to portal navigation paths
PRIMARY_PORTALS = {
    "Employee": "employee",
    "Reporting Manager": "reporting-manager",
    "L&D Team": "ld",
    "HR Team": "hr",
    "CEO": "ceo",
}

class EmployeeService:
    def __init__(self):
        self._graph_token: Optional[str] = None
        self._graph_token_expires_at: float = 0
        self._cached_employees: List[Dict[str, Any]] = []
        self._id_index: Dict[str, Dict[str, Any]] = {}
        self._cache_updated_at: float = 0
        self._cache_ttl_seconds: float = 900  # Cache directory for 15 minutes
        self._graph_lock = threading.Lock()

    def _rebuild_index(self) -> None:
        idx: Dict[str, Dict[str, Any]] = {}
        for emp in self._cached_employees:
            eid = emp.get("employee_id")
            if eid:
                idx[eid.strip().lower()] = emp
            oid = emp.get("microsoft_object_id")
            if oid:
                idx[oid.strip().lower()] = emp
            email = emp.get("email")
            if email:
                idx[email.strip().lower()] = emp
            upn = emp.get("work_email")
            if upn:
                idx[upn.strip().lower()] = emp
        self._id_index = idx

    def _normalize_role(self, raw_title: Optional[str]) -> str:
        if not raw_title or not isinstance(raw_title, str):
            return "Employee"
        clean = raw_title.strip().lower()
        return ROLE_ALIASES.get(clean, "Employee")

    def _get_graph_token(self) -> Optional[str]:
        """Acquires and caches an application token for Microsoft Graph API."""
        now = time.time()
        if self._graph_token and (now < self._graph_token_expires_at - 60):
            return self._graph_token

        token_url = f"https://login.microsoftonline.com/{config.MICROSOFT_TENANT_ID}/oauth2/v2.0/token"
        payload = {
            "client_id": config.MICROSOFT_CLIENT_ID,
            "client_secret": getattr(config, "MICROSOFT_CLIENT_SECRET", ""),
            "scope": "https://graph.microsoft.com/.default",
            "grant_type": "client_credentials",
        }

        try:
            res = requests.post(token_url, data=payload, timeout=2.0)
            if res.status_code == 200:
                data = res.json()
                self._graph_token = data.get("access_token")
                expires_in = data.get("expires_in", 3600)
                self._graph_token_expires_at = now + expires_in
                return self._graph_token
            else:
                print(f"[EmployeeService] Failed to get Graph token: {res.status_code} {res.text}")
        except Exception as e:
            print(f"[EmployeeService] Notice requesting Graph token (offline/mock): {e}")

        self._graph_token_expires_at = now + 60
        return None

    def _format_user_record(self, user: Dict[str, Any], index: int = 0) -> Dict[str, Any]:
        """Formats a Microsoft Graph user dictionary into a standardized LMS employee profile."""
        raw_role = user.get("jobTitle")
        role = self._normalize_role(raw_role)
        emp_id = user.get("employeeId")
        if not emp_id:
            # Fallback deterministic ID from index or object ID
            emp_id = f"EMP{index+1:03d}" if index > 0 else f"EMP-{user.get('id', '')[:6].upper()}"

        dept = user.get("department") or "Engineering"

        # Determine reporting manager directly from live Azure AD manager relationship
        mgr = user.get("manager")
        if mgr:
            manager_oid = mgr.get("id")
            manager_id = mgr.get("employeeId") or (f"EMP-{manager_oid[:6].upper()}" if manager_oid else "MGR")
            manager_name = mgr.get("displayName") or "Manager"
        elif role == "CEO":
            manager_oid = None
            manager_id = None
            manager_name = "Board of Directors"
        else:
            manager_oid = None
            manager_id = None
            manager_name = "Not Assigned"

        # Full Name
        raw_name = user.get("displayName", "User")
        clean_name = raw_name.split("(")[0].strip()
        linkedin_url = None

        # Date of Joining from live Azure AD employeeHireDate
        hire_date = user.get("employeeHireDate")
        if hire_date:
            try:
                # Format '2024-06-01T00:00:00Z' -> '01/06/2024'
                parts = hire_date[:10].split("-")
                date_of_joining = f"{parts[2]}/{parts[1]}/{parts[0]}"
            except Exception:
                date_of_joining = hire_date[:10]
        else:
            date_of_joining = "01/06/2024"

        # Job Location from live Azure AD officeLocation
        job_location = user.get("officeLocation") or "Coimbatore, India"

        # Mobile Number from live Azure AD mobilePhone
        mobile_number = user.get("mobilePhone") or f"+91 98765 423{index+1:02d}"

        # Work Email from live Azure AD userPrincipalName
        work_email = user.get("userPrincipalName") or user.get("mail") or ""
        clean_email = (work_email or "").strip().lower()

        # Dynamic L&D role assignment based on LD_TEAM_EMAILS in .env
        if clean_email and clean_email in config.LD_TEAM_EMAILS:
            role = "L&D Team"
            job_title = raw_role or "L&D Manager"
        else:
            job_title = raw_role or role

        return {
            "employee_id": emp_id,
            "microsoft_object_id": user.get("id"),
            "name": clean_name,
            "full_name": clean_name,
            "display_name": raw_name,
            "email": work_email,
            "work_email": work_email,
            "role": role,
            "job_title": job_title,
            "department": dept,
            "job_location": job_location,
            "mobile_number": mobile_number,
            "reporting_manager": manager_name,
            "reporting_manager_id": manager_id,
            "reporting_manager_oid": manager_oid,
            "date_of_joining": date_of_joining,
            "linkedin_url": linkedin_url,
            "is_active": user.get("accountEnabled", True),
        }

    def _fetch_from_graph(self) -> List[Dict[str, Any]]:
        """Fetches all users directly from Microsoft Entra ID via Graph API with live manager relationship."""
        now = time.time()
        if self._cached_employees and (now - self._cache_updated_at < self._cache_ttl_seconds):
            return self._cached_employees

        with self._graph_lock:
            now = time.time()
            if self._cached_employees and (now - self._cache_updated_at < self._cache_ttl_seconds):
                return self._cached_employees

            token = self._get_graph_token()
            if not token:
                return self._cached_employees

            url = "https://graph.microsoft.com/v1.0/users?$select=id,displayName,userPrincipalName,mail,jobTitle,department,employeeId,officeLocation,mobilePhone,employeeHireDate,accountEnabled&$expand=manager($select=id,displayName,userPrincipalName,mail,employeeId,jobTitle)&$top=999"
            headers = {"Authorization": f"Bearer {token}"}

            try:
                res = requests.get(url, headers=headers, timeout=2.0)
                if res.status_code == 200:
                    data = res.json()
                    raw_users = data.get("value", [])
                    employees = []
                    for idx, u in enumerate(raw_users):
                        upn = u.get("userPrincipalName", "")
                        if "#EXT#" in upn:
                            continue
                        employees.append(self._format_user_record(u, idx))

                    employees.sort(key=lambda e: e["employee_id"])
                    self._cached_employees = employees
                    self._rebuild_index()
                    self._cache_updated_at = time.time()
                    return self._cached_employees
                else:
                    print(f"[EmployeeService] Graph API error {res.status_code}: {res.text}")
            except Exception as e:
                print(f"[EmployeeService] Notice fetching users from Graph (offline/mock): {e}")

            if self._cached_employees:
                self._cache_updated_at = time.time()
            return self._cached_employees

    def find_employee_by_claims(self, claims: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Locates the employee record in Microsoft Entra ID using claims extracted
        from the validated Microsoft SSO JWT token.
        """
        employees = self._fetch_from_graph()
        oid = claims.get("oid") or claims.get("sub")

        # 1. Match by Microsoft Object ID
        if oid:
            for emp in employees:
                if emp.get("microsoft_object_id") == oid:
                    return dict(emp)

        # 2. Match by email / UPN
        email_candidates = [
            claims.get("preferred_username"),
            claims.get("email"),
            claims.get("upn"),
            claims.get("unique_name"),
        ]

        for candidate in email_candidates:
            if candidate and isinstance(candidate, str):
                target = candidate.strip().lower()
                for emp in employees:
                    emp_email = (emp.get("email") or "").strip().lower()
                    if emp_email == target:
                        return dict(emp)

        # 3. Dev / Mock token support
        if claims.get("dev_mode") or claims.get("employee_id"):
            emp_id = claims.get("employee_id")
            if emp_id:
                return self.get_employee_by_id(emp_id)

        return None

    def get_employee_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Finds an employee by email address or User Principal Name (UPN)."""
        if not email:
            return None
        target = email.strip().lower()
        self._fetch_from_graph()
        if target in self._id_index:
            return dict(self._id_index[target])
        for emp in self._cached_employees:
            emp_email = (emp.get("email") or "").strip().lower()
            emp_upn = (emp.get("user_principal_name") or "").strip().lower()
            if emp_email == target or emp_upn == target:
                return dict(emp)
        return None

    def get_employee_by_id(self, employee_id: str) -> Optional[Dict[str, Any]]:
        """Finds an employee by employee_id (e.g. EMP001) or Microsoft Object ID."""
        if not employee_id:
            return None
        target = employee_id.strip().lower()
        self._fetch_from_graph()
        if target in self._id_index:
            return dict(self._id_index[target])

        for emp in self._cached_employees:
            if (emp.get("employee_id", "").lower() == target or
                (emp.get("microsoft_object_id") and emp["microsoft_object_id"].lower() == target)):
                return dict(emp)

        return None

    def get_all_employees(self) -> List[Dict[str, Any]]:
        """Returns all employees directly from Microsoft Entra ID."""
        return [dict(e) for e in self._fetch_from_graph()]

    def get_employee_ids_by_role(self, *roles: str) -> List[str]:
        """Dynamically resolves employee_ids matching any normalized LMS role from the live directory."""
        targets = set()
        for r in roles:
            if not r:
                continue
            norm = ROLE_ALIASES.get(str(r).strip().lower(), str(r).strip())
            targets.add(norm.lower())
        if not targets:
            return []

        ids: List[str] = []
        seen = set()
        for emp in self._fetch_from_graph():
            emp_role = str(emp.get("role") or "").strip().lower()
            raw_job = str(emp.get("job_title") or "").strip().lower()
            norm_job = ROLE_ALIASES.get(raw_job, raw_job).lower()
            if emp_role in targets or norm_job in targets:
                eid = str(emp.get("employee_id") or "").strip()[:7]
                if eid and eid.upper() not in seen:
                    seen.add(eid.upper())
                    ids.append(eid)
        return ids

    def get_reporting_manager_id(self, employee_id: str) -> Optional[str]:
        """Resolves an employee's reporting manager employee_id from the live directory, or None if unassigned."""
        if not employee_id:
            return None
        emp = self.get_employee_by_id(employee_id)
        if not emp:
            return None
        rm_id = (emp.get("reporting_manager_id") or "").strip()
        if rm_id and rm_id.upper() != str(emp.get("employee_id") or "").strip().upper():
            return rm_id[:7]

        rm_name = (emp.get("reporting_manager") or "").strip().lower()
        if rm_name:
            for candidate in self._fetch_from_graph():
                c_id = (candidate.get("employee_id") or "").strip()
                c_name = (candidate.get("name") or "").strip().lower()
                if c_id and c_id.upper() != str(emp.get("employee_id") or "").strip().upper():
                    if c_name and (rm_name == c_name or rm_name in c_name or c_name in rm_name):
                        return c_id[:7]
        return None

    def get_team_members(self, manager_employee_id: str) -> List[Dict[str, Any]]:
        """Returns direct reports for a given manager."""
        if not manager_employee_id:
            return []
        employees = self._fetch_from_graph()
        target = manager_employee_id.strip().lower()

        return [
            dict(e) for e in employees
            if (e.get("reporting_manager_id") and e["reporting_manager_id"].lower() == target)
            or (e.get("reporting_manager_oid") and e["reporting_manager_oid"].lower() == target)
            or (e.get("reporting_manager") and target in e["reporting_manager"].lower())
        ]

    def update_employee_role(self, employee_id: str, new_role: str) -> Optional[Dict[str, Any]]:
        """In-memory role override for active session testing."""
        if new_role not in ALLOWED_ROLES:
            raise ValueError(f"Invalid role '{new_role}'")
        emp = self.get_employee_by_id(employee_id)
        if emp:
            emp["role"] = new_role
            for cached in self._cached_employees:
                if cached["employee_id"] == emp["employee_id"]:
                    cached["role"] = new_role
            return dict(emp)
        return None

    def get_access_profile(self, employee: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculates access metadata according to business rules:
        - Non-Employee roles have dual mode: primary portal + employee_mode: true
        - Employee role only has employee portal with employee_mode: false (no switcher)
        """
        role = employee.get("role", "Employee")
        is_employee = (role == "Employee")
        primary_portal = PRIMARY_PORTALS.get(role, "employee")

        return {
            "primary_portal": primary_portal,
            "employee_mode": not is_employee,
        }

    def get_all_employees_learning_metrics(self) -> Dict[str, Dict[str, Any]]:
        """
        Aggregates live LMS course enrollments, course completion certificates,
        average progress percentage, and total learning hours for all employees.
        Returns mapping: { lower_emp_id: { in_progress, completed, certificates, certifications, avg_progress, total_hours } }
        """
        from database.connection import connect_db, is_sql_server
        conn = connect_db()
        cursor = conn.cursor()
        try:
            tbl = "dbo." if is_sql_server() else ""

            # 1. Enrollments aggregation: in_progress, completed, average progress %
            cursor.execute(f"""
                SELECT 
                    LOWER(employee_id) AS emp_id,
                    SUM(CASE WHEN LOWER(status) IN ('in progress', 'active') THEN 1 ELSE 0 END) AS in_prog,
                    SUM(CASE WHEN LOWER(status) = 'completed' THEN 1 ELSE 0 END) AS comp,
                    AVG(CAST(COALESCE(progress_percentage, 0) AS FLOAT)) AS avg_prog
                FROM {tbl}lms_course_enrollments
                GROUP BY LOWER(employee_id)
            """)
            stats: Dict[str, Dict[str, Any]] = {}
            for row in cursor.fetchall():
                emp_id = str(row[0]).strip().lower()
                stats[emp_id] = {
                    "in_progress": int(row[1] or 0),
                    "completed": int(row[2] or 0),
                    "certificates": 0,
                    "certifications": 0,
                    "avg_progress": round(float(row[3] or 0)),
                    "total_hours": 0
                }

            # 2. Total certifications aggregation (only certifications, excluding course completion certificates)
            cursor.execute(f"""
                SELECT 
                    LOWER(employee_id) AS emp_id,
                    COUNT(*) AS cert_count
                FROM {tbl}lms_employee_certificates
                WHERE LOWER(COALESCE(certificate_type, '')) NOT LIKE '%course completion%'
                  AND LOWER(COALESCE(certificate_type, '')) NOT LIKE '%course certificate%'
                GROUP BY LOWER(employee_id)
            """)
            for row in cursor.fetchall():
                emp_id = str(row[0]).strip().lower()
                if emp_id not in stats:
                    stats[emp_id] = {
                        "in_progress": 0, "completed": 0, "certificates": 0,
                        "certifications": 0, "avg_progress": 0, "total_hours": 0
                    }
                cnt = int(row[1] or 0)
                stats[emp_id]["certificates"] = cnt
                stats[emp_id]["certifications"] = cnt

            # 3. Learning logs aggregation: total hours
            cursor.execute(f"""
                SELECT 
                    LOWER(employee_id) AS emp_id,
                    ROUND(SUM(CAST(COALESCE(video_duration_minutes, 0) + COALESCE(practice_duration_minutes, 0) AS FLOAT)) / 60.0, 0) AS total_hrs
                FROM {tbl}lms_learning_logs
                GROUP BY LOWER(employee_id)
            """)
            for row in cursor.fetchall():
                emp_id = str(row[0]).strip().lower()
                if emp_id not in stats:
                    stats[emp_id] = {
                        "in_progress": 0, "completed": 0, "certificates": 0,
                        "certifications": 0, "avg_progress": 0, "total_hours": 0
                    }
                stats[emp_id]["total_hours"] = int(row[1] or 0)

            return stats
        except Exception as ex:
            print(f"[EmployeeService] Warning: get_all_employees_learning_metrics failed: {ex}")
            return {}
        finally:
            conn.close()

employee_service = EmployeeService()

auth_service = employee_service
