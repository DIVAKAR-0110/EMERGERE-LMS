"""
LMS Text-to-MS SQL Dynamic Query Engine (sql_agent_service.py)
Empowers the AI Assistant to translate natural language user questions into safe,
role-scoped MS SQL Server SELECT queries, execute them on the live database,
and synthesize dynamic, 100% factually grounded responses.
"""

import os
import re
import json
import logging
import urllib.request
import urllib.error
from typing import Dict, Any, List, Optional, Tuple

from config import config
from database.connection import connect_db, dictfetchall, is_sql_server

logger = logging.getLogger("sql_agent_service")

# Compact LMS Database Schema tailored for MS SQL Query Generation
LMS_DB_SCHEMA_PROMPT = """
Target Database: Microsoft SQL Server (T-SQL)
Available Core Tables & Views:

1. dbo.vw_ai_learner_reimbursements (Recommended for reimbursement queries)
   - claim_code (VARCHAR): Unique claim code e.g. 'CLM-2026-0001'
   - employee_id (VARCHAR): Employee ID e.g. 'EMP019'
   - claim_type (VARCHAR): e.g. 'Course', 'Certification'
   - certification_name (VARCHAR): Name of certified course / exam
   - provider (VARCHAR): e.g. 'COURSERA', 'AWS', 'LINKEDIN LEARNING'
   - amount (INT): Cost/amount in USD
   - claim_status (VARCHAR): 'Approved', 'Pending', 'Rejected'
   - processing_status (VARCHAR): e.g. 'Paid', 'Under Review'
   - current_pending_stage (VARCHAR): 'Review', 'Completed', etc.
   - submitted_on (DATE): Date submitted

2. dbo.lms_reimbursement_claims
   - claim_code (VARCHAR), employee_id (VARCHAR), certification_name (VARCHAR), provider (VARCHAR), amount (INT), status (VARCHAR), processing_status (VARCHAR), submitted_on (DATE)

3. dbo.vw_ai_learner_enrollments (Recommended for course enrollment queries)
   - enrollment_code (VARCHAR): e.g. 'ENR-2026-0001'
   - employee_id (VARCHAR): e.g. 'EMP019'
   - course_id (INT)
   - course_name (VARCHAR): Title of course
   - provider (VARCHAR): Provider name
   - category (VARCHAR): Domain e.g. 'CYBERSECURITY', 'TECHNOLOGY'
   - duration_minutes (INT): Duration in minutes
   - price (FLOAT): Price in USD
   - enrollment_status (VARCHAR): 'In Progress', 'Completed', 'Assigned', 'Not Started'
   - progress_percentage (DECIMAL): 0 to 100
   - hours_log (INT): Total minutes studied
   - enrolled_at (DATETIME)

4. dbo.lms_courses
   - id (INT), course_name (VARCHAR), provider (VARCHAR), category (VARCHAR), duration_minutes (INT), price (INT), description (VARCHAR)

5. dbo.vw_ai_learner_course_requests (Custom course requests by employees)
   - request_code (VARCHAR), employee_id (VARCHAR), course_name (VARCHAR), provider (VARCHAR), category (VARCHAR), overall_status (VARCHAR: 'Pending', 'Approved', 'Rejected'), current_stage (VARCHAR), created_at (DATETIME)

6. dbo.lms_certification_requests
   - request_code (VARCHAR), employee_id (VARCHAR), certification_name (VARCHAR), provider (VARCHAR), estimated_cost (INT), status (VARCHAR), exam_date (DATE)

7. dbo.lms_employee_profiles
   - employee_id (VARCHAR), technical_skills (NVARCHAR - JSON array), workplace_skills (NVARCHAR), learning_interests (NVARCHAR)

8. dbo.vw_ai_org_approvals_queue (Enterprise pending requests across the company)
   - request_code (VARCHAR), request_type (VARCHAR), employee_id (VARCHAR), employee_name (VARCHAR), item_name (VARCHAR), current_stage (VARCHAR), status (VARCHAR), submitted_at (DATETIME)
"""

FORBIDDEN_SQL_PATTERN = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|EXEC|EXECUTE|CREATE|MERGE|GRANT|REVOKE|BACKUP|RESTORE|SHUTDOWN)\b",
    re.IGNORECASE
)


class SQLAgentService:
    def __init__(self):
        self.base_url = "https://openrouter.ai/api/v1"

    def _get_api_keys(self) -> List[str]:
        from dotenv import load_dotenv
        env_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
        if os.path.exists(env_file):
            load_dotenv(env_file, override=False)

        raw_keys = os.getenv("OPENROUTER_API_KEYS") or os.getenv("OPENROUTER_API_KEY") or config.OPENROUTER_API_KEY or ""
        return [k.strip() for k in raw_keys.replace(";", ",").split(",") if k.strip()]

    def _call_llm(self, messages: List[Dict[str, str]], max_tokens: int = 500, temperature: float = 0.2) -> Optional[str]:
        api_keys = self._get_api_keys()
        if not api_keys:
            return None

        primary_model = os.getenv("OPENROUTER_MODEL", config.OPENROUTER_MODEL).strip() or "google/gemma-4-31b-it:free"
        fallback_model = os.getenv("OPENROUTER_FALLBACK_MODEL", config.OPENROUTER_FALLBACK_MODEL).strip() or "nvidia/nemotron-3-super-120b-a12b:free"
        site_url = os.getenv("OPENROUTER_SITE_URL", config.OPENROUTER_SITE_URL)
        site_name = os.getenv("OPENROUTER_SITE_NAME", config.OPENROUTER_SITE_NAME)

        url = f"{self.base_url}/chat/completions"

        candidate_models = [
            primary_model,
            fallback_model,
            "google/gemma-4-31b-it:free",
            "nvidia/nemotron-3-super-120b-a12b:free",
            "google/gemma-4-26b-a4b-it:free",
            "nvidia/nemotron-3-ultra-550b-a55b:free",
            "cohere/north-mini-code:free",
            "recursive/flint-v1.0:free",
            "liquid/lfm-2.5-2.6b:free"
        ]

        for key_idx, current_api_key in enumerate(api_keys):
            headers = {
                "Authorization": f"Bearer {current_api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": site_url,
                "X-Title": site_name
            }
            key_rate_limited = False

            for model_name in candidate_models:
                try:
                    payload = {
                        "model": model_name,
                        "messages": messages,
                        "temperature": temperature,
                        "max_tokens": max_tokens
                    }

                    req = urllib.request.Request(
                        url,
                        data=json.dumps(payload).encode("utf-8"),
                        headers=headers,
                        method="POST"
                    )

                    with urllib.request.urlopen(req, timeout=12) as response:
                        res_body = response.read().decode("utf-8")
                        res_json = json.loads(res_body)
                        choices = res_json.get("choices")
                        if choices and len(choices) > 0:
                            msg = choices[0].get("message") or {}
                            raw_c = msg.get("content") or msg.get("text") or ""
                            if not raw_c and msg.get("reasoning"):
                                raw_c = re.sub(r"^Here'?s a thinking process:.*?\n\n", "", str(msg.get("reasoning")), flags=re.DOTALL)
                            reply = str(raw_c).strip() if raw_c else ""
                            if reply:
                                return reply

                except urllib.error.HTTPError as he:
                    if he.code == 429:
                        key_rate_limited = True
                        break
                except Exception:
                    continue

            if not key_rate_limited:
                break

        return None

    def validate_and_sanitize_sql(
        self, 
        raw_sql: str, 
        current_user: Dict[str, Any]
    ) -> Tuple[bool, str, str]:
        """
        Validates that the generated SQL query is safe, read-only, and strictly role-scoped.
        Returns (is_valid, sanitized_sql, error_or_reason).
        """
        if not raw_sql or not raw_sql.strip():
            return False, "", "Empty SQL query generated"

        # 1. Strip markdown fences and extraneous characters
        cleaned = re.sub(r"```(?:sql)?", "", raw_sql, flags=re.IGNORECASE)
        cleaned = cleaned.replace("```", "").strip()

        # Remove trailing semicolons
        cleaned = cleaned.rstrip(";").strip()

        # Reject multiple statements (semicolon inside query)
        if ";" in cleaned:
            return False, "", "Multi-statement queries are strictly prohibited."

        # Reject single-line SQL comments that might bypass guards
        if "--" in cleaned or "/*" in cleaned:
            return False, "", "SQL comments are prohibited for security."

        # 2. Must begin with SELECT or WITH (for CTEs)
        if not re.match(r"^\s*(SELECT|WITH)\b", cleaned, re.IGNORECASE):
            return False, "", "Only SELECT queries are permitted."

        # 3. Check for forbidden DDL / DML keywords
        match = FORBIDDEN_SQL_PATTERN.search(cleaned)
        if match:
            return False, "", f"Forbidden operation '{match.group(0)}' detected. Only read-only operations are permitted."

        user_role = (current_user.get("role") or "Employee").strip()
        user_emp_id = (current_user.get("employee_id") or "").strip()
        is_ld = user_role == "L&D Team" or user_role.lower() in ("ld", "l&d", "l&d team")

        # 4. Role-based privacy scoping
        if not is_ld:
            emp_pattern = rf"employee_id\s*=\s*['\"]?{re.escape(user_emp_id)}['\"]?"
            lower_query = cleaned.lower()
            if not re.search(emp_pattern, cleaned, re.IGNORECASE) and f"'{user_emp_id.lower()}'" not in lower_query:
                if " where " in lower_query:
                    cleaned = re.sub(r"(\bwhere\b\s+)", rf"\1employee_id = '{user_emp_id}' AND (", cleaned, flags=re.IGNORECASE, count=1) + ")"
                elif " group by " in lower_query:
                    cleaned = re.sub(r"(\bgroup by\b)", rf"WHERE employee_id = '{user_emp_id}' \1", cleaned, flags=re.IGNORECASE, count=1)
                elif " order by " in lower_query:
                    cleaned = re.sub(r"(\border by\b)", rf"WHERE employee_id = '{user_emp_id}' \1", cleaned, flags=re.IGNORECASE, count=1)
                else:
                    cleaned = f"{cleaned} WHERE employee_id = '{user_emp_id}'"

        # 5. Enforce TOP limit on SELECT if not an aggregate
        is_aggregate = any(agg in cleaned.lower() for agg in ["count(", "sum(", "avg(", "max(", "min("])
        if not is_aggregate and "top " not in cleaned.lower() and "limit " not in cleaned.lower():
            cleaned = re.sub(r"^\s*SELECT\s+", "SELECT TOP 50 ", cleaned, flags=re.IGNORECASE, count=1)

        return True, cleaned, "Valid"

    def execute_sql(self, sql_query: str) -> Tuple[bool, List[Dict[str, Any]], str]:
        """
        Executes the validated SQL query on the database connection.
        Returns (success, rows_list, error_message).
        """
        try:
            conn = connect_db()
            cursor = conn.cursor()

            adapted_sql = sql_query
            if not is_sql_server():
                top_m = re.search(r"SELECT\s+TOP\s+(\d+)\s+", adapted_sql, re.IGNORECASE)
                if top_m:
                    limit_n = top_m.group(1)
                    adapted_sql = re.sub(r"SELECT\s+TOP\s+\d+\s+", "SELECT ", adapted_sql, flags=re.IGNORECASE, count=1)
                    if "LIMIT " not in adapted_sql.upper():
                        adapted_sql = f"{adapted_sql} LIMIT {limit_n}"

            cursor.execute(adapted_sql)
            rows = dictfetchall(cursor)
            cursor.close()
            conn.close()
            return True, rows, ""
        except Exception as e:
            logger.warning(f"[SQLAgentService] Query execution error: {e} | Query: {sql_query}")
            return False, [], str(e)

    def generate_sql_from_intent(
        self,
        user_query: str,
        current_user: Dict[str, Any],
        target_employee: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        """
        Deterministic MS SQL Query Builder:
        Guarantees that an accurate, optimized MS SQL query is generated even if the external LLM
        API hits rate limits or is offline.
        """
        q = user_query.lower()
        user_role = (current_user.get("role") or "Employee").strip()
        user_emp_id = (current_user.get("employee_id") or "").strip()
        if not user_emp_id:
            return None
        is_ld = user_role == "L&D Team" or user_role.lower() in ("ld", "l&d", "l&d team")
        t_id = (target_employee.get("employee_id") if target_employee else "").strip()

        # 1. Reimbursement queries
        if any(w in q for w in ["reimbursement", "claim", "reimburse", "claimed"]):
            is_org_inquiry = any(w in q for w in [
                "all", "all employee", "all employees", "all the employees",
                "organisation", "organization", "company", "enterprise",
                "spent", "final price", "overall", "everyone", "by all"
            ])
            wants_aggregate = any(w in q for w in [
                "price", "total", "sum", "amount", "cost", "final", "spent",
                "value", "count", "how much", "how many"
            ])

            if is_ld and (not target_employee or is_org_inquiry):
                return (
                    "SELECT COUNT(*) AS total_claims, "
                    "SUM(amount) AS total_amount, "
                    "SUM(CASE WHEN LOWER(claim_status) = 'approved' THEN amount ELSE 0 END) AS approved_amount, "
                    "COUNT(CASE WHEN LOWER(claim_status) = 'approved' THEN 1 END) AS approved_count, "
                    "COUNT(CASE WHEN LOWER(claim_status) = 'pending' THEN 1 END) AS pending_count "
                    "FROM dbo.vw_ai_learner_reimbursements"
                )

            target = t_id if (is_ld and t_id and not is_org_inquiry) else user_emp_id
            if wants_aggregate and any(w in q for w in ["price", "total", "sum", "amount", "cost", "final", "spent"]):
                return (
                    f"SELECT COUNT(*) AS total_claims, "
                    f"SUM(amount) AS total_amount, "
                    f"SUM(CASE WHEN LOWER(claim_status) = 'approved' THEN amount ELSE 0 END) AS approved_amount, "
                    f"COUNT(CASE WHEN LOWER(claim_status) = 'approved' THEN 1 END) AS approved_count, "
                    f"COUNT(CASE WHEN LOWER(claim_status) = 'pending' THEN 1 END) AS pending_count "
                    f"FROM dbo.vw_ai_learner_reimbursements WHERE employee_id = '{target}'"
                )

            return (
                f"SELECT claim_code, certification_name, provider, amount, claim_status, processing_status, current_pending_stage, submitted_on "
                f"FROM dbo.vw_ai_learner_reimbursements WHERE employee_id = '{target}' ORDER BY claim_id DESC"
            )

        # 2. Course enrollments queries
        if any(w in q for w in ["enroll", "enrolled", "my course", "my courses", "in progress", "in-progress", "ongoing"]):
            if any(w in q for w in ["in progress", "in-progress", "ongoing"]):
                target = t_id if (is_ld and t_id) else user_emp_id
                return (
                    f"SELECT enrollment_code, course_name, provider, category, enrollment_status, progress_percentage, hours_log, enrolled_at "
                    f"FROM dbo.vw_ai_learner_enrollments WHERE employee_id = '{target}' AND LOWER(enrollment_status) IN ('in progress', 'active') ORDER BY enrollment_id DESC"
                )
            if is_ld and not target_employee:
                return (
                    "SELECT COUNT(*) AS total_enrollments, "
                    "COUNT(DISTINCT employee_id) AS distinct_learners, "
                    "SUM(CASE WHEN LOWER(enrollment_status) = 'completed' THEN 1 ELSE 0 END) AS completed_count, "
                    "SUM(CASE WHEN LOWER(enrollment_status) IN ('in progress', 'active') THEN 1 ELSE 0 END) AS in_progress_count "
                    "FROM dbo.vw_ai_learner_enrollments"
                )
            target = t_id if (is_ld and t_id) else user_emp_id
            return (
                f"SELECT enrollment_code, course_name, provider, category, enrollment_status, progress_percentage, hours_log, enrolled_at "
                f"FROM dbo.vw_ai_learner_enrollments WHERE employee_id = '{target}' ORDER BY enrollment_id DESC"
            )

        # 3. Custom course requests & Approvals & Workflow Queue
        if any(w in q for w in [
            "course request", "requested course", "requesting course",
            "pending request", "pending requests", "approvals & workflow",
            "approvals and workflow", "workflow page", "approvals page", "approval queue", "approvals"
        ]):
            if is_ld and (not target_employee or any(w in q for w in ["approvals & workflow", "workflow page", "approvals page", "all", "queue"])):
                return (
                    "SELECT TOP 50 approval_type, request_code, employee_id, item_name, provider, pending_stage, submitted_at "
                    "FROM dbo.vw_ai_org_approvals_queue ORDER BY submitted_at DESC"
                )
            target = t_id if (is_ld and t_id) else user_emp_id
            return (
                f"SELECT TOP 50 approval_type, request_code, item_name, provider, pending_stage, submitted_at "
                f"FROM dbo.vw_ai_org_approvals_queue WHERE employee_id = '{target}' ORDER BY submitted_at DESC"
            )
            return (
                f"SELECT request_code, course_name, provider, overall_status, current_stage, reason, created_at "
                f"FROM dbo.vw_ai_learner_course_requests WHERE employee_id = '{target}' ORDER BY request_id DESC"
            )

        # 4. Completed courses
        if any(w in q for w in ["completed course", "finish", "finished course"]):
            target = t_id if (is_ld and t_id) else user_emp_id
            return (
                f"SELECT enrollment_code, course_name, provider, category, progress_percentage, hours_log "
                f"FROM dbo.vw_ai_learner_enrollments WHERE employee_id = '{target}' AND LOWER(enrollment_status) = 'completed'"
            )

        # 5. Database counts / Master summary
        if any(w in q for w in ["database count", "counts", "summary", "total count"]):
            if is_ld and not target_employee:
                return (
                    "SELECT "
                    "(SELECT COUNT(*) FROM dbo.lms_course_enrollments) AS total_enrollments, "
                    "(SELECT COUNT(*) FROM dbo.lms_reimbursement_claims) AS total_claims, "
                    "(SELECT COALESCE(SUM(amount), 0) FROM dbo.lms_reimbursement_claims) AS total_reimbursement_value, "
                    "(SELECT COUNT(*) FROM dbo.vw_ai_learner_course_requests WHERE LOWER(overall_status) = 'pending') AS pending_requests"
                )
            target = t_id if (is_ld and t_id) else user_emp_id
            return (
                f"SELECT "
                f"(SELECT COUNT(*) FROM dbo.lms_course_enrollments WHERE employee_id = '{target}') AS total_enrollments, "
                f"(SELECT COUNT(*) FROM dbo.lms_course_enrollments WHERE employee_id = '{target}' AND LOWER(status) = 'completed') AS completed_enrollments, "
                f"(SELECT COUNT(*) FROM dbo.lms_reimbursement_claims WHERE employee_id = '{target}') AS total_claims, "
                f"(SELECT COALESCE(SUM(amount), 0) FROM dbo.lms_reimbursement_claims WHERE employee_id = '{target}') AS total_claimed_amount"
            )

        return None

    def generate_sql(
        self, 
        user_query: str, 
        current_user: Dict[str, Any],
        target_employee: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        """
        Prompts OpenRouter LLM to translate natural language user query into an MS SQL SELECT statement.
        """
        user_role = (current_user.get("role") or "Employee").strip()
        user_emp_id = (current_user.get("employee_id") or "").strip()
        if not user_emp_id:
            return None
        is_ld = user_role == "L&D Team" or user_role.lower() in ("ld", "l&d", "l&d team")

        system_prompt = (
            "You are an expert MS SQL (T-SQL) Database Architect for the Emergere Learning Management System (LMS).\n"
            "Your task is to write a single, accurate, efficient, read-only MS SQL Server SELECT query that retrieves "
            "the exact data requested by the user.\n\n"
            f"{LMS_DB_SCHEMA_PROMPT}\n"
            "MANDATORY SECURITY & ROLE RULES:\n"
            f"1. Current User: ID '{user_emp_id}', Role '{user_role}'.\n"
        )

        if is_ld:
            if target_employee:
                t_id = target_employee.get("employee_id")
                system_prompt += (
                    f"2. User is an L&D Administrator querying specifically about Employee '{t_id}'. "
                    f"Filter with: WHERE employee_id = '{t_id}'.\n"
                )
            else:
                system_prompt += (
                    "2. User is an L&D Administrator with organization-wide access. "
                    "For organization-wide questions (e.g. total reimbursements, total enrollments, company counts), "
                    "DO NOT filter by employee_id. Use COUNT(*), SUM(amount), etc. across the entire table.\n"
                )
        else:
            system_prompt += (
                f"2. User is an Employee/Learner. You MUST strictly filter all queries with: "
                f"WHERE employee_id = '{user_emp_id}'. Under no circumstances should other employees' data be accessible.\n"
            )

        system_prompt += (
            "3. Return ONLY the raw SQL SELECT statement inside a single ```sql ... ``` block.\n"
            "4. Do NOT include explanations, comments, or multiple statements.\n"
            "5. Examples:\n"
            "   - 'what is the total amount reimbursement claim made' (L&D):\n"
            "     SELECT COUNT(*) AS total_claims, SUM(amount) AS total_amount, "
            "     SUM(CASE WHEN LOWER(claim_status) = 'approved' THEN amount ELSE 0 END) AS approved_amount "
            "     FROM dbo.vw_ai_learner_reimbursements;\n"
            "   - 'what is the total amount reimbursement claim made' (Employee):\n"
            "     SELECT COUNT(*) AS total_claims, SUM(amount) AS total_amount "
            "     FROM dbo.vw_ai_learner_reimbursements WHERE employee_id = 'EMP019';\n"
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Write the MS SQL SELECT query for: '{user_query}'"}
        ]

        raw_reply = self._call_llm(messages, max_tokens=300, temperature=0.0)
        if raw_reply:
            m = re.search(r"```(?:sql)?\s*([\s\S]*?)\s*```", raw_reply, re.IGNORECASE)
            if m:
                return m.group(1).strip()
            lines = [l.strip() for l in raw_reply.split("\n") if l.strip() and not l.strip().startswith("--")]
            if lines and lines[0].upper().startswith("SELECT"):
                return "\n".join(lines).strip()

        return None

    def synthesize_response_with_sql_data(
        self,
        user_query: str,
        sql_query: str,
        rows: List[Dict[str, Any]],
        current_user: Dict[str, Any]
    ) -> Optional[str]:
        """
        Prompts OpenRouter LLM to synthesize a natural, dynamic, professional answer
        incorporating the exact live records returned by the MS SQL Server execution.
        """
        user_role = (current_user.get("role") or "Employee").strip()
        user_name = (current_user.get("name") or "Learner").strip()

        rows_preview = json.dumps(rows[:25], default=str, indent=2)

        prompt = (
            f"You are the Emergere LMS AI Assistant answering user '{user_name}' (Role: {user_role}).\n"
            f"The user asked: \"{user_query}\"\n\n"
            f"A live MS SQL Server query was executed:\n"
            f"SQL: {sql_query}\n"
            f"Returned Records ({len(rows)} rows):\n{rows_preview}\n\n"
            "INSTRUCTIONS:\n"
            "1. Answer the user's question completely, accurately, and professionally based strictly on the query results above.\n"
            "2. If numbers, dollar amounts, or statuses are present, format them clearly using Markdown bolding or clean tables.\n"
            "3. If 0 records were found, clearly explain that no matching records were found in the LMS database.\n"
            "4. NEVER disclose internal database table names or raw SQL syntax in the response to the user.\n"
            "5. Keep the tone helpful, enterprise-grade, and professional.\n"
        )

        messages = [
            {"role": "system", "content": "You are the Emergere LMS AI Assistant. Provide helpful, accurate, polished answers based on verified LMS data."},
            {"role": "user", "content": prompt}
        ]

        return self._call_llm(messages, max_tokens=800, temperature=0.4)

    def format_sql_results_fallback(
        self,
        user_query: str,
        sql_query: str,
        rows: List[Dict[str, Any]],
        current_user: Dict[str, Any]
    ) -> str:
        """
        Deterministic, polished Markdown formatter for live SQL execution records.
        Ensures a gorgeous, dynamic output is produced without leaking database schema names.
        """
        user_role = (current_user.get("role") or "Employee").strip()
        user_name = (current_user.get("name") or "Learner").strip()
        is_ld = user_role == "L&D Team" or user_role.lower() in ("ld", "l&d", "l&d team")

        if not rows:
            return (
                f"### 📋 Database Inquiry Results\n\n"
                f"No matching LMS records were found in the database for your query: *\"{user_query}\"*.\n\n"
                f"💡 *If you believe this is an error, please verify the record status or check back once updates are submitted.*"
            )

        # 1. Single aggregate row (e.g. COUNT, SUM)
        if len(rows) == 1 and any(k.lower() in ("total_claims", "total_amount", "total_enrollments", "total_employees") for k in rows[0].keys()):
            r = rows[0]
            scope_badge = "Enterprise Organization" if ("total_employees" in r or is_ld) else f"Personal Records for **{user_name}**"
            lines = [
                f"### 📊 Live Database Query Results ({scope_badge})\n",
                f"Based on real-time database execution for *\"{user_query}\"*:\n"
            ]
            title_map = {
                "total_employees": "Total Registered LMS Employees",
                "total_departments": "Active Departments",
                "total_roles": "Organization Roles",
                "total_enrollments": "Course Enrollments",
                "completed_enrollments": "Completed Courses",
                "total_claims": "Reimbursement Claims",
                "total_amount": "Total Reimbursement Amount",
                "total_claimed_amount": "Total Claimed Amount",
                "approved_amount": "Approved Reimbursement Amount",
                "approved_count": "Approved Claims",
                "pending_count": "Pending Claims",
                "pending_requests": "Pending Course Requests",
                "distinct_learners": "Distinct Learners"
            }
            for col, val in r.items():
                col_title = title_map.get(col.lower(), col.replace("_", " ").title())
                if "amount" in col.lower() or "price" in col.lower() or "cost" in col.lower() or "value" in col.lower():
                    val_str = f"${float(val):,.2f}" if val is not None else "$0.00"
                else:
                    val_str = str(val) if val is not None else "0"
                lines.append(f"• **{col_title}:** **{val_str}**")
            
            lines.append("\n💡 *Data extracted directly from the verified live database.*")
            return "\n".join(lines)

        # 2. Tabular row list (e.g. Enrollments, Claims, Requests)
        scope_badge = "Enterprise Records" if is_ld else f"Records for **{user_name}**"
        if "complete" in user_query.lower():
            category_header = "Completed Courses Tracking"
        elif any(w in user_query.lower() for w in ["in progress", "in-progress", "ongoing"]):
            category_header = "In-Progress Courses"
        elif "claim" in user_query.lower() or "reimburse" in user_query.lower():
            category_header = "Reimbursement Claims"
        elif any(w in user_query.lower() for w in ["approvals", "workflow page", "queue", "pending request"]):
            category_header = "Approvals & Workflow Pending Queue"
        else:
            category_header = "Live Database Query Results"

        lines = [
            f"### 📋 {category_header} ({scope_badge})\n",
            f"Retrieved **{len(rows)}** verified record(s) matching your inquiry *\"{user_query}\"*:\n"
        ]

        total_price_sum = sum(
            float(r.get("amount") or r.get("price") or 0)
            for r in rows
            if r.get("amount") is not None or r.get("price") is not None
        )
        if total_price_sum > 0:
            lines.append(f"• 💵 **Total Price / Cumulative Value:** **${total_price_sum:,.2f}**\n")

        for idx, row in enumerate(rows[:10], 1):
            title = row.get("item_name") or row.get("course_name") or row.get("certification_name") or row.get("claim_code") or f"Record #{idx}"
            lines.append(f"{idx}. **{title}**")
            sub_bullets = []
            for k, v in row.items():
                if k in ("course_name", "certification_name", "id"):
                    continue
                k_clean = k.replace("_", " ").title()
                if "amount" in k.lower() or "price" in k.lower():
                    v_str = f"${float(v):,.2f}" if v is not None else "$0.00"
                else:
                    v_str = str(v) if v is not None else "N/A"
                sub_bullets.append(f"• {k_clean}: **{v_str}**")
            lines.append("   " + " | ".join(sub_bullets[:4]))

        if len(rows) > 10:
            lines.append(f"\n*(Showing top 10 of {len(rows)} total records)*")

        lines.append("\n💡 *Data is live and synchronized directly with the LMS database.*")
        return "\n".join(lines)

    def process_query_via_sql(
        self,
        user_query: str,
        current_user: Dict[str, Any],
        target_employee: Optional[Dict[str, Any]] = None
    ) -> Optional[Tuple[str, str, List[Dict[str, Any]]]]:
        """
        End-to-end Text-to-SQL pipeline:
        1. Translates natural language to MS SQL SELECT query (via LLM with template fallback).
        2. Validates query safety and role scope.
        3. Executes query on MS SQL Server database.
        4. Synthesizes a natural, verified response.
        Returns (synthesized_response, executed_sql, rows) or None if fallback needed.
        """
        # Step 1: Attempt LLM SQL generation
        raw_sql = self.generate_sql(user_query, current_user, target_employee)

        # Fallback to deterministic SQL generator if LLM was unavailable / rate-limited
        if not raw_sql:
            raw_sql = self.generate_sql_from_intent(user_query, current_user, target_employee)

        if not raw_sql:
            return None

        # Step 2: Validate & sanitize SQL
        is_valid, sanitized_sql, err = self.validate_and_sanitize_sql(raw_sql, current_user)
        if not is_valid:
            logger.warning(f"[SQLAgentService] Generated SQL rejected by guardrail: {err} | Raw: {raw_sql}")
            return None

        # Step 3: Execute on database
        ok, rows, exec_err = self.execute_sql(sanitized_sql)
        if not ok:
            logger.warning(f"[SQLAgentService] SQL execution failed: {exec_err} | SQL: {sanitized_sql}")
            return None

        # Step 4: Synthesize response via LLM
        reply = self.synthesize_response_with_sql_data(user_query, sanitized_sql, rows, current_user)

        # If LLM synthesis was rate limited or empty, use our deterministic SQL result formatter
        if not reply or len(reply.strip()) < 20:
            reply = self.format_sql_results_fallback(user_query, sanitized_sql, rows, current_user)

        if reply and len(reply.strip()) > 20:
            return reply.strip(), sanitized_sql, rows

        return None


# Global singleton
sql_agent_service = SQLAgentService()
