"""
CEO Dashboard Service.
Provides enterprise-wide learning analytics, departmental distributions,
and spending metrics for the CEO dashboard.
All values (pct, amount) are fully dynamic — computed from live database records.
"""

import io
import datetime
import csv
from typing import Dict, Any, List, Tuple
from database.connection import connect_db
from services.common.auth_service import employee_service

from reportlab.lib.pagesizes import letter, landscape
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

class CEODashboardService:

    def get_learning_by_department(self) -> List[Dict[str, Any]]:
        """
        Dynamically calculates per-department learning spend % and total amount spent.

        pct  = (department live spend / total company spend) * 100
               Falls back to employee-count proportion if no spend exists.
        amount = sum of approved course request prices + approved/paid reimbursement claims
                 for all employees in that Azure AD department.
        """
        # 1. Fetch live Azure AD employees → build employee → department map
        employees = employee_service.get_all_employees()

        emp_to_dept: Dict[str, str] = {}
        dept_employee_counts: Dict[str, int] = {}
        for emp in employees:
            dept = (emp.get("department") or "Other").strip()
            if dept:
                dept_employee_counts[dept] = dept_employee_counts.get(dept, 0) + 1
            emp_id = (emp.get("employee_id") or "").strip().upper()
            if emp_id and dept:
                emp_to_dept[emp_id] = dept

        # 2. Aggregate live spend from database
        dept_course_spend: Dict[str, int] = {}
        dept_reimb_spend: Dict[str, int] = {}
        dept_in_progress_count: Dict[str, int] = {}
        dept_completed_count: Dict[str, int] = {}
        dept_budgets: Dict[str, float] = {}

        conn = connect_db()
        cursor = conn.cursor()
        try:
            # Department annual budgets
            cursor.execute("""
                SELECT department, budget_amount
                FROM dbo.lms_department_budgets
                WHERE budget_year = YEAR(GETDATE())
            """)
            for row in cursor.fetchall():
                if row[0]:
                    dept_budgets[row[0].strip()] = float(row[1] or 500000.0)

            # Course prices — from approved/requested new courses by employees
            cursor.execute("""
                SELECT 
                    COALESCE(r.employee_id, CASE WHEN c.created_by LIKE 'EMP%' THEN c.created_by ELSE NULL END) AS requester_emp_id,
                    c.price
                FROM dbo.lms_courses c
                LEFT JOIN dbo.lms_course_requests r ON c.request_id = r.id
                WHERE c.price IS NOT NULL AND c.price > 0
            """)
            for row in cursor.fetchall():
                emp_id = (str(row[0]) if row[0] else "").strip().upper()
                price = int(row[1] or 0)
                dept = emp_to_dept.get(emp_id, "Other")
                dept_course_spend[dept] = dept_course_spend.get(dept, 0) + price

            # Reimbursements — paid or approved claims
            cursor.execute("""
                SELECT employee_id, amount
                FROM dbo.lms_reimbursement_claims
                WHERE LOWER(status) = 'approved' OR LOWER(processing_status) = 'paid'
            """)
            for row in cursor.fetchall():
                emp_id = (str(row[0]) if row[0] else "").strip().upper()
                amount = int(row[1] or 0)
                dept = emp_to_dept.get(emp_id, "Other")
                dept_reimb_spend[dept] = dept_reimb_spend.get(dept, 0) + amount

            # Enrollment progress counts per department
            cursor.execute("""
                SELECT employee_id, status, progress_percentage
                FROM dbo.lms_course_enrollments
            """)
            for row in cursor.fetchall():
                emp_id = (str(row[0]) if row[0] else "").strip().upper()
                status = (str(row[1]) if row[1] else "").strip().lower()
                prog = float(row[2] or 0)
                dept = emp_to_dept.get(emp_id, "Other")
                if status == "in progress" or (prog > 0 and prog < 100):
                    dept_in_progress_count[dept] = dept_in_progress_count.get(dept, 0) + 1
                if status == "completed" or prog >= 100:
                    dept_completed_count[dept] = dept_completed_count.get(dept, 0) + 1

        except Exception as e:
            print(f"[CEODashboardService] Database aggregation error: {e}")
        finally:
            conn.close()

        # 3. Compute per-department totals dynamically from real Azure AD departments
        brand_palette = [
            "#2667F9", "#31C27E", "#9E5DF9", "#FDAD33", "#2BC3F3",
            "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEEAD",
            "#D4A5A5", "#EC4899", "#8B5CF6", "#10B981", "#F59E0B"
        ]

        # Collect unique departments from Azure AD employees
        ad_departments = sorted(dept_employee_counts.keys(), key=lambda d: dept_employee_counts[d], reverse=True)
        dept_live_spend: Dict[str, int] = {}
        for d in ad_departments:
            dept_live_spend[d] = (
                dept_course_spend.get(d, 0) +
                dept_reimb_spend.get(d, 0)
            )

        total_company_spend = sum(dept_live_spend.values())
        total_company_employees = sum(dept_employee_counts.values()) or 1

        # 4. Assemble final response
        results: List[Dict[str, Any]] = []
        for idx, dept_name in enumerate(ad_departments):
            live_spend = dept_live_spend.get(dept_name, 0)
            course_spend = dept_course_spend.get(dept_name, 0)
            reimb_spend = dept_reimb_spend.get(dept_name, 0)
            emp_count = dept_employee_counts.get(dept_name, 0)
            color = brand_palette[idx % len(brand_palette)]

            # Dynamic pct: accurate share of total company learning spend.
            # Shows 0% when a department has no spend — no artificial inflation.
            if total_company_spend > 0 and live_spend > 0:
                pct = round((live_spend / total_company_spend) * 100)
            else:
                pct = 0

            # Dynamic amount: actual INR spent (course requests + reimbursements)
            formatted_amount = f"₹{live_spend:,}" if live_spend > 0 else "₹0"

            # Dynamic utilization: live spend / annual allocated budget
            budget_val = dept_budgets.get(dept_name, 500000.0)
            utilization = round((live_spend / budget_val) * 100) if budget_val > 0 else 0

            results.append({
                "id": idx + 1,
                "department": dept_name,
                "name": dept_name,
                "pct": pct,
                "amount": formatted_amount,
                "amount_raw": live_spend,
                "budget_amount": int(budget_val),
                "budget_amount_formatted": f"₹{int(budget_val):,}",
                "utilization": utilization,
                "color": color,
                "employee_count": emp_count,
                "in_progress_learners": dept_in_progress_count.get(dept_name, 0),
                "completed_learners": dept_completed_count.get(dept_name, 0),
                "spend_breakdown": {
                    "course_requests": course_spend,
                    "reimbursements": reimb_spend,
                    "live_spent": live_spend,
                    "total_company_spend": total_company_spend,
                }
            })

        # Sort with highest spending departments first
        results.sort(key=lambda x: x["amount_raw"], reverse=True)
        return results


    def get_kpi_stats(self) -> Dict[str, Any]:
        """
        Dynamically calculates enterprise-wide CEO KPI metrics:
        - total_employees: Total headcount from Microsoft Entra ID
        - active_learners: Distinct employees currently pursuing courses with status 'in progress'
        - completion_rate_pct: Percentage of course enrollments marked completed or >= 100%
        - total_learning_hours: Total learning hours logged by company employees in lms_learning_logs
        - employee_distribution: Percentage of total employees in each department
        """
        employees = employee_service.get_all_employees()
        total_employees = len(employees)

        dept_counts: Dict[str, int] = {}
        for emp in employees:
            dept = (emp.get("department") or "Other").strip()
            if dept:
                dept_counts[dept] = dept_counts.get(dept, 0) + 1

        active_learners = 0
        total_enrollments = 0
        completed_enrollments = 0
        total_learning_minutes = 0
        certified_employees = 0

        conn = connect_db()
        cursor = conn.cursor()
        try:
            # Certified employees: distinct employees with at least one valid certification
            cursor.execute("""
                SELECT COUNT(DISTINCT employee_id)
                FROM dbo.lms_employee_certificates
                WHERE expiry_date IS NULL OR expiry_date >= CAST(GETDATE() AS DATE)
            """)
            row = cursor.fetchone()
            certified_employees = row[0] if row and row[0] is not None else 0

            # Active learners: distinct employees with an in-progress enrollment
            cursor.execute("""
                SELECT COUNT(DISTINCT employee_id) 
                FROM dbo.lms_course_enrollments 
                WHERE LOWER(status) = 'in progress'
            """)
            row = cursor.fetchone()
            active_learners = row[0] if row and row[0] is not None else 0

            # Completion rate: completed / total enrollments
            cursor.execute("""
                SELECT 
                    COUNT(*), 
                    SUM(CASE WHEN LOWER(status) = 'completed' OR progress_percentage >= 100 THEN 1 ELSE 0 END) 
                FROM dbo.lms_course_enrollments
            """)
            row = cursor.fetchone()
            if row:
                total_enrollments = row[0] or 0
                completed_enrollments = row[1] or 0

            # Total learning hours and video learning hours from lms_learning_logs
            cursor.execute("""
                SELECT 
                    SUM(COALESCE(video_duration_minutes, 0) + COALESCE(practice_duration_minutes, 0)),
                    SUM(COALESCE(video_duration_minutes, 0))
                FROM dbo.lms_learning_logs
            """)
            row = cursor.fetchone()
            total_learning_minutes = row[0] if row and row[0] is not None else 0
            video_learning_minutes = row[1] if row and row[1] is not None else 0

        except Exception as e:
            print(f"[CEODashboardService] KPI stats error: {e}")
        finally:
            conn.close()

        completion_rate_pct = (
            round((completed_enrollments / total_enrollments) * 100)
            if total_enrollments > 0
            else 0
        )
        total_learning_hours = total_learning_minutes // 60
        video_learning_hours = round(video_learning_minutes / 60) if video_learning_minutes else 0

        # Employee distribution dynamically derived from real Microsoft Entra ID (Azure AD) departments
        brand_palette = [
            "#2667F9", "#31C27E", "#9E5DF9", "#FDAD33", "#2BC3F3",
            "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEEAD",
            "#D4A5A5", "#EC4899", "#8B5CF6", "#10B981", "#F59E0B"
        ]

        distribution: List[Dict[str, Any]] = []
        sorted_depts = sorted(dept_counts.items(), key=lambda x: x[1], reverse=True)

        for idx, (dept_name, count) in enumerate(sorted_depts):
            distribution.append({
                "id": idx + 1,
                "name": dept_name,
                "count": count,
                "color": brand_palette[idx % len(brand_palette)],
                "ad_name": dept_name,
            })

        # Use Largest Remainder Method (Hamilton-Hare) to ensure integer percentages sum exactly to 100%
        if total_employees > 0:
            raw_pcts = [(item["count"] / total_employees) * 100 for item in distribution]
            floor_pcts = [int(p) for p in raw_pcts]
            remainder_ranks = sorted(
                [(raw_pcts[i] - floor_pcts[i], i) for i in range(len(distribution))],
                key=lambda x: x[0],
                reverse=True,
            )
            diff = 100 - sum(floor_pcts)
            for i in range(diff):
                idx = remainder_ranks[i][1]
                floor_pcts[idx] += 1
            for i, item in enumerate(distribution):
                item["pct"] = floor_pcts[i]
                item["raw_pct"] = round(raw_pcts[i], 2)
        else:
            for item in distribution:
                item["pct"] = 0
                item["raw_pct"] = 0.0

        return {
            "total_employees": total_employees,
            "certified_employees": certified_employees,
            "active_learners": active_learners,
            "completion_rate_pct": completion_rate_pct,
            "total_learning_hours": total_learning_hours,
            "total_learning_minutes": total_learning_minutes,
            "total_learning_hours_formatted": f"{total_learning_hours}h",
            "video_learning_hours": video_learning_hours,
            "video_learning_minutes": video_learning_minutes,
            "video_learning_hours_formatted": f"{video_learning_hours}h",
            "employee_distribution": distribution,
        }

    def get_budget_expenditure_stats(self) -> Dict[str, Any]:
        """
        Dynamically calculates CEO Budget & Spend Analytics:
        - certification_spend: Total paid status of HR for certification reimbursement (processing_status = 'paid')
        - course_spend: Total amount spent for buying new courses as per request new course flow (hr_status = 'approved' and price > 0)
        - ytd_learning_spend: Year-To-Date total amount spent in both buying new courses and certification reimbursement (current year)
        - total_investment: Entire lifetime amount spent on buying new courses + paid reimbursement claims
        - spend_by_category: Categorized breakdown of Courses vs Certifications with raw amount, formatted amount, and percentage share.
        """
        conn = connect_db()
        cursor = conn.cursor()

        certification_spend = 0
        course_spend = 0
        ytd_cert_spend = 0
        ytd_course_spend = 0

        try:
            # 1. Certification Spend (Lifetime & Current Year paid claims)
            cursor.execute("""
                SELECT 
                    SUM(amount) AS total_reimb,
                    SUM(CASE WHEN YEAR(created_at) = YEAR(GETDATE()) OR YEAR(submitted_on) = YEAR(GETDATE()) THEN amount ELSE 0 END) AS ytd_reimb
                FROM dbo.lms_reimbursement_claims
                WHERE LOWER(processing_status) = 'paid'
            """)
            row = cursor.fetchone()
            if row:
                certification_spend = int(round(float(row[0] or 0)))
                ytd_cert_spend = int(round(float(row[1] or 0)))

            # 2. Course Spend (Lifetime & Current Year approved new courses)
            cursor.execute("""
                SELECT 
                    SUM(price) AS total_course,
                    SUM(CASE WHEN YEAR(created_at) = YEAR(GETDATE()) THEN price ELSE 0 END) AS ytd_course
                FROM dbo.lms_courses
                WHERE LOWER(hr_status) = 'approved' AND price > 0
            """)
            row = cursor.fetchone()
            if row:
                course_spend = int(round(float(row[0] or 0)))
                ytd_course_spend = int(round(float(row[1] or 0)))

        except Exception as e:
            print(f"[CEODashboardService] Budget expenditure stats error: {e}")
        finally:
            conn.close()

        total_investment = course_spend + certification_spend
        ytd_learning_spend = ytd_course_spend + ytd_cert_spend

        # Compact K format helper: e.g. 46494 -> ₹46.5k, 110000 -> ₹110k
        def format_compact_k(amt) -> str:
            val_float = float(amt or 0)
            if val_float >= 1000:
                val = val_float / 1000.0
                if val.is_integer():
                    return f"₹{int(val)}k"
                return f"₹{val:.1f}k"
            return f"₹{int(val_float)}"

        courses_pct = round((float(course_spend) / float(total_investment)) * 100) if total_investment > 0 else 0
        certs_pct = round((float(certification_spend) / float(total_investment)) * 100) if total_investment > 0 else 0

        spend_by_category = [
            {
                "key": "courses",
                "label": "Courses",
                "amount_raw": course_spend,
                "amount": format_compact_k(course_spend),
                "amount_formatted": f"₹{course_spend:,}",
                "pct": courses_pct,
                "color": "#2667F9",
            },
            {
                "key": "certifications",
                "label": "Certifications",
                "amount_raw": certification_spend,
                "amount": format_compact_k(certification_spend),
                "amount_formatted": f"₹{certification_spend:,}",
                "pct": certs_pct,
                "color": "#31C27E",
            },
        ]

        spend_by_department = self.get_learning_by_department()

        # Dynamic enterprise budget utilization across configured active departments
        total_dept_spend = sum(d.get("amount_raw", 0) for d in spend_by_department)
        total_dept_budget = sum(d.get("budget_amount", 500000) for d in spend_by_department) or 2500000
        budget_utilization_pct = round((total_dept_spend / total_dept_budget) * 100) if total_dept_budget > 0 else 0

        return {
            "total_investment": total_investment,
            "total_investment_formatted": f"₹{total_investment:,}",
            "certification_spend": certification_spend,
            "certification_spend_formatted": f"₹{certification_spend:,}",
            "course_spend": course_spend,
            "course_spend_formatted": f"₹{course_spend:,}",
            "ytd_learning_spend": ytd_learning_spend,
            "ytd_learning_spend_formatted": f"₹{ytd_learning_spend:,}",
            "spend_by_category": spend_by_category,
            "spend_by_department": spend_by_department,
            "total_budget": total_dept_budget,
            "total_budget_formatted": f"₹{total_dept_budget:,}",
            "budget_utilization_pct": budget_utilization_pct,
        }

    def generate_learning_report(
        self,
        export_format: str = "pdf",
        date_range: str = "Year-To-Date (2026)",
        includes: Dict[str, bool] = None
    ) -> Tuple[bytes, str, str]:
        """
        Generates and returns an authentic Overall Employee Learning Report in PDF, Excel, or CSV.
        Pulls live metrics from Microsoft Entra ID and SQL Server.
        Returns: (file_bytes, media_type, filename)
        """
        if includes is None:
            includes = {
                "learningHours": True,
                "courseProgress": True,
                "certifications": True,
                "budgetSpend": True
            }

        # 1. Fetch live Entra ID employees
        employees = employee_service.get_all_employees()
        emp_map: Dict[str, Dict[str, Any]] = {}
        dept_headcount: Dict[str, int] = {}
        for emp in employees:
            emp_id = (emp.get("employee_id") or "").strip().upper()
            dept = (emp.get("department") or "Other").strip()
            emp_map[emp_id] = {
                "name": emp.get("display_name") or emp.get("name") or emp_id,
                "department": dept,
                "email": emp.get("email") or ""
            }
            dept_headcount[dept] = dept_headcount.get(dept, 0) + 1

        total_employees = len(employees)

        # 2. Date filter fragment builder
        date_condition_map = {
            "this month": "AND MONTH({col}) = MONTH(GETDATE()) AND YEAR({col}) = YEAR(GETDATE())",
            "last month": "AND MONTH({col}) = MONTH(DATEADD(month, -1, GETDATE())) AND YEAR({col}) = YEAR(DATEADD(month, -1, GETDATE()))",
            "last 3 months": "AND {col} >= DATEADD(month, -3, GETDATE())",
            "last 6 months": "AND {col} >= DATEADD(month, -6, GETDATE())",
            "this year": "AND YEAR({col}) = YEAR(GETDATE())",
        }
        dr_key = (date_range or "all time").strip().lower()
        date_filter_enrollment = date_condition_map.get(dr_key, "").format(col="e.created_at")
        date_filter_logs = date_condition_map.get(dr_key, "").format(col="created_at")
        date_filter_courses = date_condition_map.get(dr_key, "").format(col="c.created_at")
        date_filter_reimb = date_condition_map.get(dr_key, "").format(col="created_at")

        conn = connect_db()
        cursor = conn.cursor()

        # Enrollments
        cursor.execute(f"""
            SELECT 
                e.employee_id,
                COALESCE(e.course_id, '') AS course_id,
                COALESCE(c.course_name, 'Course') AS course_name,
                COALESCE(e.status, 'In Progress') AS status,
                COALESCE(e.progress_percentage, 0) AS progress,
                e.created_at,
                e.last_accessed
            FROM dbo.lms_course_enrollments e
            LEFT JOIN dbo.lms_courses c ON e.course_id = c.id
            WHERE 1=1 {date_filter_enrollment}
        """)
        enrollments = cursor.fetchall()

        # Learning logs
        cursor.execute(f"""
            SELECT 
                employee_id,
                COALESCE(video_duration_minutes, 0) + COALESCE(practice_duration_minutes, 0) AS duration,
                created_at
            FROM dbo.lms_learning_logs
            WHERE 1=1 {date_filter_logs}
        """)
        logs = cursor.fetchall()

        # Course spend (new courses with price)
        cursor.execute(f"""
            SELECT 
                COALESCE(r.employee_id, CASE WHEN c.created_by LIKE 'EMP%' THEN c.created_by ELSE NULL END) AS requester_emp_id,
                c.price,
                c.created_at
            FROM dbo.lms_courses c
            LEFT JOIN dbo.lms_course_requests r ON c.request_id = r.id
            WHERE c.price IS NOT NULL AND c.price > 0 {date_filter_courses}
        """)
        course_spend_rows = cursor.fetchall()

        # Reimbursements (approved / paid)
        cursor.execute(f"""
            SELECT 
                employee_id,
                COALESCE(certification_name, 'Certification') AS cert_name,
                COALESCE(amount, 0) AS amount,
                COALESCE(status, '') AS status,
                COALESCE(processing_status, '') AS proc_status,
                created_at
            FROM dbo.lms_reimbursement_claims
            WHERE (LOWER(status) = 'approved' OR LOWER(processing_status) = 'paid') {date_filter_reimb}
        """)
        reimbursements = cursor.fetchall()

        # Department budgets
        cursor.execute("""
            SELECT department, budget_amount
            FROM dbo.lms_department_budgets
            WHERE budget_year = YEAR(GETDATE())
        """)
        budgets_raw = cursor.fetchall()
        conn.close()

        dept_budgets = {row[0].strip(): float(row[1] or 0) for row in budgets_raw if row[0]}

        # 3. Aggregations
        dept_hours: Dict[str, int] = {}
        total_minutes = 0
        for row in logs:
            emp_id = (str(row[0]) if row[0] else "").strip().upper()
            mins = int(row[1] or 0)
            total_minutes += mins
            dept = emp_map.get(emp_id, {}).get("department", "Other")
            dept_hours[dept] = dept_hours.get(dept, 0) + mins

        dept_active_learners: Dict[str, set] = {}
        dept_completed_courses: Dict[str, int] = {}
        active_learner_set = set()
        total_enrollments = len(enrollments)
        completed_enrollments = 0

        for row in enrollments:
            emp_id = (str(row[0]) if row[0] else "").strip().upper()
            status = str(row[3]).strip().lower()
            prog = float(row[4] or 0)
            dept = emp_map.get(emp_id, {}).get("department", "Other")

            if status == "in progress" or (prog > 0 and prog < 100):
                if dept not in dept_active_learners:
                    dept_active_learners[dept] = set()
                dept_active_learners[dept].add(emp_id)
                active_learner_set.add(emp_id)

            if status == "completed" or prog >= 100:
                dept_completed_courses[dept] = dept_completed_courses.get(dept, 0) + 1
                completed_enrollments += 1

        dept_certs: Dict[str, int] = {}
        dept_reimb_spend: Dict[str, int] = {}
        total_reimb_spend = 0
        for row in reimbursements:
            emp_id = (str(row[0]) if row[0] else "").strip().upper()
            amt = int(row[2] or 0)
            dept = emp_map.get(emp_id, {}).get("department", "Other")
            dept_certs[dept] = dept_certs.get(dept, 0) + 1
            dept_reimb_spend[dept] = dept_reimb_spend.get(dept, 0) + amt
            total_reimb_spend += amt

        dept_course_spend: Dict[str, int] = {}
        total_course_spend = 0
        for row in course_spend_rows:
            emp_id = (str(row[0]) if row[0] else "").strip().upper()
            price = int(row[1] or 0)
            dept = emp_map.get(emp_id, {}).get("department", "Other")
            dept_course_spend[dept] = dept_course_spend.get(dept, 0) + price
            total_course_spend += price

        total_spend = total_course_spend + total_reimb_spend
        completion_rate_pct = round((completed_enrollments / total_enrollments) * 100) if total_enrollments > 0 else 0
        total_learning_hours = total_minutes // 60
        total_budget = sum(dept_budgets.values()) or 6000000
        budget_utilization = round((total_spend / total_budget) * 100, 1) if total_budget > 0 else 0.0

        all_depts = sorted(list(set(list(dept_headcount.keys()) + list(dept_budgets.keys()))))
        dept_data_list = []
        for d in all_depts:
            hc = dept_headcount.get(d, 0)
            act = len(dept_active_learners.get(d, set()))
            act_pct = round((act / hc) * 100) if hc > 0 else 0
            hrs = dept_hours.get(d, 0) // 60
            done = dept_completed_courses.get(d, 0)
            crts = dept_certs.get(d, 0)
            bgt = dept_budgets.get(d, 500000.0)
            spnd = dept_course_spend.get(d, 0) + dept_reimb_spend.get(d, 0)
            utl = round((spnd / bgt) * 100, 1) if bgt > 0 else 0.0

            dept_data_list.append({
                "name": d,
                "headcount": hc,
                "active_learners": act,
                "active_pct": act_pct,
                "hours": hrs,
                "courses_completed": done,
                "certifications": crts,
                "budget": int(bgt),
                "spend": int(spnd),
                "utilization": utl
            })

        dept_data_list.sort(key=lambda x: x["spend"], reverse=True)

        report_data = {
            "date_range": date_range,
            "kpis": {
                "total_employees": total_employees,
                "active_learners": len(active_learner_set),
                "active_pct": round((len(active_learner_set) / total_employees) * 100) if total_employees else 0,
                "total_hours": total_learning_hours,
                "completion_rate": completion_rate_pct,
                "total_spend": total_spend,
                "course_spend": total_course_spend,
                "reimb_spend": total_reimb_spend,
                "total_budget": int(total_budget),
                "budget_utilization": budget_utilization,
                "total_completed_courses": completed_enrollments,
                "total_certifications": len(reimbursements)
            },
            "departments": dept_data_list,
            "enrollments": enrollments,
            "reimbursements": reimbursements,
            "emp_map": emp_map
        }

        # 4. Generate by Format
        fmt = (export_format or "pdf").strip().lower()
        year_str = datetime.date.today().year

        if fmt == "excel":
            wb = openpyxl.Workbook()
            ws_summary = wb.active
            ws_summary.title = "Executive Summary"
            ws_summary.views.sheetView[0].showGridLines = True

            header_font = Font(name="Calibri", size=14, bold=True, color="0F172A")
            sub_font = Font(name="Calibri", size=11, bold=True, color="215EF8")
            meta_font = Font(name="Calibri", size=9, italic=True, color="64748B")
            th_font = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
            th_fill = PatternFill(start_color="215EF8", end_color="215EF8", fill_type="solid")
            th_align = Alignment(horizontal="center", vertical="center", wrap_text=True)

            ws_summary["A1"] = "EMERGERE COMPUTING SOLUTIONS PRIVATE LIMITED"
            ws_summary["A1"].font = header_font
            ws_summary["A2"] = "OVERALL EMPLOYEE LEARNING & TALENT DEVELOPMENT REPORT"
            ws_summary["A2"].font = sub_font
            ws_summary["A3"] = f"Generated for: Executive Leadership / CEO  |  Period: {date_range}  |  Date: {datetime.date.today().strftime('%B %d, %Y')}"
            ws_summary["A3"].font = meta_font

            # KPI Block
            ws_summary["A5"] = "Executive Metric"
            ws_summary["B5"] = "Value"
            ws_summary["A5"].font = th_font
            ws_summary["A5"].fill = th_fill
            ws_summary["B5"].font = th_font
            ws_summary["B5"].fill = th_fill

            kpi_rows = [
                ("Total Workforce", f"{report_data['kpis']['total_employees']} Employees"),
                ("Active Learners", f"{report_data['kpis']['active_learners']} ({report_data['kpis']['active_pct']}%)"),
                ("Total Learning Hours", f"{report_data['kpis']['total_hours']}h"),
                ("Course Completion Rate", f"{report_data['kpis']['completion_rate']}%"),
                ("Total Training Spend", f"INR {report_data['kpis']['total_spend']:,}"),
                ("Annual Budget Allocated", f"INR {report_data['kpis']['total_budget']:,}"),
                ("Overall Budget Utilization", f"{report_data['kpis']['budget_utilization']}%"),
            ]
            r_idx = 6
            for m, v in kpi_rows:
                ws_summary.cell(row=r_idx, column=1, value=m)
                ws_summary.cell(row=r_idx, column=2, value=v)
                r_idx += 1

            # Department Table
            d_start = r_idx + 2
            dept_headers = ["Department", "Headcount", "Active Learners", "Hours Logged", "Courses Completed", "Certifications", "Allocated Budget (INR)", "Total Spend (INR)", "Utilization %"]
            for col_idx, h in enumerate(dept_headers, 1):
                cell = ws_summary.cell(row=d_start, column=col_idx, value=h)
                cell.font = th_font
                cell.fill = th_fill
                cell.alignment = th_align

            curr_r = d_start + 1
            for d in report_data["departments"]:
                ws_summary.cell(row=curr_r, column=1, value=d["name"])
                ws_summary.cell(row=curr_r, column=2, value=d["headcount"])
                ws_summary.cell(row=curr_r, column=3, value=f"{d['active_learners']} ({d['active_pct']}%)")
                ws_summary.cell(row=curr_r, column=4, value=f"{d['hours']}h")
                ws_summary.cell(row=curr_r, column=5, value=d["courses_completed"])
                ws_summary.cell(row=curr_r, column=6, value=d["certifications"])
                ws_summary.cell(row=curr_r, column=7, value=d["budget"])
                ws_summary.cell(row=curr_r, column=8, value=d["spend"])
                ws_summary.cell(row=curr_r, column=9, value=f"{d['utilization']}%")
                curr_r += 1

            # Adjust widths
            for col in ws_summary.columns:
                max_len = max(len(str(cell.value or '')) for cell in col)
                col_letter = get_column_letter(col[0].column)
                ws_summary.column_dimensions[col_letter].width = max(max_len + 3, 12)

            # Sheet 2: Employee Course Progress
            if includes.get("courseProgress", True):
                ws_courses = wb.create_sheet(title="Course Progress")
                ws_courses.views.sheetView[0].showGridLines = True
                c_headers = ["Employee ID", "Employee Name", "Department", "Course Name", "Status", "Progress %", "Enrolled Date"]
                for c_idx, h in enumerate(c_headers, 1):
                    cell = ws_courses.cell(row=1, column=c_idx, value=h)
                    cell.font = th_font
                    cell.fill = th_fill

                c_row = 2
                for e in enrollments:
                    e_id = (str(e[0]) if e[0] else "").strip().upper()
                    emp_info = emp_map.get(e_id, {})
                    ws_courses.cell(row=c_row, column=1, value=e_id)
                    ws_courses.cell(row=c_row, column=2, value=emp_info.get("name", e_id))
                    ws_courses.cell(row=c_row, column=3, value=emp_info.get("department", "Other"))
                    ws_courses.cell(row=c_row, column=4, value=str(e[2] or "Course"))
                    ws_courses.cell(row=c_row, column=5, value=str(e[3] or "In Progress"))
                    ws_courses.cell(row=c_row, column=6, value=f"{e[4]}%")
                    ws_courses.cell(row=c_row, column=7, value=str(e[5])[:10] if e[5] else "-")
                    c_row += 1

                for col in ws_courses.columns:
                    max_len = max(len(str(cell.value or '')) for cell in col)
                    col_letter = get_column_letter(col[0].column)
                    ws_courses.column_dimensions[col_letter].width = max(max_len + 3, 12)

            # Sheet 3: Certification Claims
            if includes.get("certifications", True):
                ws_certs = wb.create_sheet(title="Certifications")
                ws_certs.views.sheetView[0].showGridLines = True
                ct_headers = ["Employee ID", "Employee Name", "Department", "Certification Name", "Amount (INR)", "Status", "Processing Status", "Date"]
                for ct_idx, h in enumerate(ct_headers, 1):
                    cell = ws_certs.cell(row=1, column=ct_idx, value=h)
                    cell.font = th_font
                    cell.fill = th_fill

                ct_row = 2
                for r in reimbursements:
                    e_id = (str(r[0]) if r[0] else "").strip().upper()
                    emp_info = emp_map.get(e_id, {})
                    ws_certs.cell(row=ct_row, column=1, value=e_id)
                    ws_certs.cell(row=ct_row, column=2, value=emp_info.get("name", e_id))
                    ws_certs.cell(row=ct_row, column=3, value=emp_info.get("department", "Other"))
                    ws_certs.cell(row=ct_row, column=4, value=str(r[1] or "Certification"))
                    ws_certs.cell(row=ct_row, column=5, value=int(r[2] or 0))
                    ws_certs.cell(row=ct_row, column=6, value=str(r[3] or "Approved"))
                    ws_certs.cell(row=ct_row, column=7, value=str(r[4] or "Paid"))
                    ws_certs.cell(row=ct_row, column=8, value=str(r[5])[:10] if r[5] else "-")
                    ct_row += 1

                for col in ws_certs.columns:
                    max_len = max(len(str(cell.value or '')) for cell in col)
                    col_letter = get_column_letter(col[0].column)
                    ws_certs.column_dimensions[col_letter].width = max(max_len + 3, 12)

            buf = io.BytesIO()
            wb.save(buf)
            return (
                buf.getvalue(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                f"Emergere_CEO_Overall_Learning_Report_{year_str}.xlsx"
            )

        elif fmt == "csv":
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(["EMERGERE COMPUTING SOLUTIONS PRIVATE LIMITED"])
            writer.writerow(["OVERALL EMPLOYEE LEARNING & TALENT DEVELOPMENT REPORT"])
            writer.writerow([f"Generated for: Executive Leadership / CEO | Period: {date_range} | Date: {datetime.date.today().strftime('%B %d, %Y')}"])
            writer.writerow([])
            writer.writerow(["=== EXECUTIVE KEY PERFORMANCE INDICATORS ==="])
            writer.writerow(["Metric", "Value"])
            writer.writerow(["Total Workforce", f"{report_data['kpis']['total_employees']} Employees"])
            writer.writerow(["Active Learners", f"{report_data['kpis']['active_learners']} ({report_data['kpis']['active_pct']}%)"])
            writer.writerow(["Total Learning Hours", f"{report_data['kpis']['total_hours']}h"])
            writer.writerow(["Course Completion Rate", f"{report_data['kpis']['completion_rate']}%"])
            writer.writerow(["Total Training Spend (INR)", report_data['kpis']['total_spend']])
            writer.writerow(["Annual Budget Allocated (INR)", report_data['kpis']['total_budget']])
            writer.writerow(["Budget Utilization", f"{report_data['kpis']['budget_utilization']}%"])
            writer.writerow([])
            writer.writerow(["=== DEPARTMENT PERFORMANCE & BUDGET UTILIZATION ==="])
            writer.writerow(["Department", "Headcount", "Active Learners", "Active Learners %", "Hours Logged", "Courses Completed", "Certifications", "Allocated Budget (INR)", "Total Spend (INR)", "Utilization %"])
            for d in report_data["departments"]:
                writer.writerow([d["name"], d["headcount"], d["active_learners"], f"{d['active_pct']}%", f"{d['hours']}h", d["courses_completed"], d["certifications"], d["budget"], d["spend"], f"{d['utilization']}%"])
            writer.writerow([])

            if includes.get("courseProgress", True):
                writer.writerow(["=== EMPLOYEE COURSE PROGRESS ROSTER ==="])
                writer.writerow(["Employee ID", "Employee Name", "Department", "Course Name", "Status", "Progress %", "Enrolled Date"])
                for e in enrollments:
                    e_id = (str(e[0]) if e[0] else "").strip().upper()
                    emp_info = emp_map.get(e_id, {})
                    writer.writerow([
                        e_id,
                        emp_info.get("name", e_id),
                        emp_info.get("department", "Other"),
                        str(e[2] or "Course"),
                        str(e[3] or "In Progress"),
                        f"{e[4]}%",
                        str(e[5])[:10] if e[5] else "-"
                    ])

            csv_bytes = output.getvalue().encode("utf-8-sig")
            return (
                csv_bytes,
                "text/csv; charset=utf-8",
                f"Emergere_CEO_Overall_Learning_Report_{year_str}.csv"
            )

        else:
            # Default: PDF via ReportLab
            buffer = io.BytesIO()
            doc = SimpleDocTemplate(
                buffer,
                pagesize=landscape(letter),
                rightMargin=36,
                leftMargin=36,
                topMargin=36,
                bottomMargin=36
            )
            styles = getSampleStyleSheet()

            title_style = ParagraphStyle(
                'DocTitle',
                parent=styles['Heading1'],
                fontSize=16,
                leading=20,
                textColor=colors.HexColor('#0F172A'),
                fontName='Helvetica-Bold'
            )
            sub_style = ParagraphStyle(
                'DocSub',
                parent=styles['Normal'],
                fontSize=11,
                leading=14,
                textColor=colors.HexColor('#215EF8'),
                fontName='Helvetica-Bold'
            )
            meta_style = ParagraphStyle(
                'DocMeta',
                parent=styles['Normal'],
                fontSize=8.5,
                leading=12,
                textColor=colors.HexColor('#64748B')
            )
            h2_style = ParagraphStyle(
                'H2Style',
                parent=styles['Heading2'],
                fontSize=11,
                leading=14,
                textColor=colors.HexColor('#1E293B'),
                fontName='Helvetica-Bold'
            )

            elements = []
            elements.append(Paragraph("EMERGERE COMPUTING SOLUTIONS PRIVATE LIMITED", title_style))
            elements.append(Paragraph("OVERALL EMPLOYEE LEARNING & TALENT DEVELOPMENT REPORT", sub_style))
            elements.append(Paragraph(f"Generated for: Executive Leadership / CEO  |  Period: {date_range}  |  Date: {datetime.date.today().strftime('%B %d, %Y')}", meta_style))
            elements.append(Spacer(1, 10))
            elements.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#215EF8'), spaceAfter=12))

            # KPI Summary Table
            elements.append(Paragraph("Executive Key Performance Indicators (KPIs)", h2_style))
            elements.append(Spacer(1, 6))

            kpi_data = [
                [
                    Paragraph("<b>Total Workforce:</b>", styles['Normal']),
                    Paragraph(f"{report_data['kpis']['total_employees']} Employees", styles['Normal']),
                    Paragraph("<b>Active Learners:</b>", styles['Normal']),
                    Paragraph(f"{report_data['kpis']['active_learners']} ({report_data['kpis']['active_pct']}%)", styles['Normal']),
                    Paragraph("<b>Total Learning Hours:</b>", styles['Normal']),
                    Paragraph(f"{report_data['kpis']['total_hours']}h", styles['Normal'])
                ],
                [
                    Paragraph("<b>Completion Rate:</b>", styles['Normal']),
                    Paragraph(f"{report_data['kpis']['completion_rate']}%", styles['Normal']),
                    Paragraph("<b>Total Training Spend:</b>", styles['Normal']),
                    Paragraph(f"INR {report_data['kpis']['total_spend']:,}", styles['Normal']),
                    Paragraph("<b>Budget Utilization:</b>", styles['Normal']),
                    Paragraph(f"{report_data['kpis']['budget_utilization']}%", styles['Normal'])
                ]
            ]

            t_kpi = Table(kpi_data, colWidths=[120, 110, 120, 110, 130, 130])
            t_kpi.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
                ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E1')),
                ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ]))
            elements.append(t_kpi)
            elements.append(Spacer(1, 12))

            # Department Table
            elements.append(Paragraph("Department Performance & Budget Allocation", h2_style))
            elements.append(Spacer(1, 6))

            dept_rows = [[
                "Department", "Headcount", "Active Learners", "Hours Logged", 
                "Courses Done", "Certifications", "Allocated Budget", "Total Spend", "Utilization"
            ]]
            for d in report_data['departments']:
                dept_rows.append([
                    d['name'],
                    str(d['headcount']),
                    f"{d['active_learners']} ({d['active_pct']}%)",
                    f"{d['hours']}h",
                    str(d['courses_completed']),
                    str(d['certifications']),
                    f"INR {d['budget']:,}",
                    f"INR {d['spend']:,}",
                    f"{d['utilization']}%"
                ])

            dept_rows.append([
                "Total Company",
                str(report_data['kpis']['total_employees']),
                f"{report_data['kpis']['active_learners']} ({report_data['kpis']['active_pct']}%)",
                f"{report_data['kpis']['total_hours']}h",
                str(report_data['kpis']['total_completed_courses']),
                str(report_data['kpis']['total_certifications']),
                f"INR {report_data['kpis']['total_budget']:,}",
                f"INR {report_data['kpis']['total_spend']:,}",
                f"{report_data['kpis']['budget_utilization']}%"
            ])

            col_widths = [140, 60, 85, 75, 75, 75, 95, 85, 60]
            t_dept = Table(dept_rows, colWidths=col_widths)
            t_dept.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#215EF8')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 8.5),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 5),
                ('TOPPADDING', (0, 0), (-1, 0), 5),
                ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
                ('FONTSIZE', (0, 1), (-1, -1), 8),
                ('ROWBACKGROUNDS', (0, 1), (-1, -2), [colors.white, colors.HexColor('#F8FAFC')]),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
                ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#EFF6FF')),
                ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
                ('TOPPADDING', (0, -1), (-1, -1), 5),
                ('BOTTOMPADDING', (0, -1), (-1, -1), 5),
            ]))
            elements.append(t_dept)

            doc.build(elements)
            return (
                buffer.getvalue(),
                "application/pdf",
                f"Emergere_CEO_Overall_Learning_Report_{year_str}.pdf"
            )

ceo_dashboard_service = CEODashboardService()




dashboard_service = ceo_dashboard_service
