"""
Pill Service.
Generates role-aware and page-contextual suggested prompt pills for the LMS Copilot.
Enforces strict security: never includes or explores database table names.
"""

from typing import List, Dict, Any

class PillService:
    # Role 1: Employee, RM, HR, CEO (Personal Scope only)
    EMPLOYEE_PAGE_PILLS: Dict[str, List[Dict[str, str]]] = {
        "courses": [
            {"id": "p-emp-c1", "label": "Show my enrolled courses", "query": "Show my currently enrolled courses and completion status.", "type": "book", "className": "pill-recommend"},
            {"id": "p-emp-c2", "label": "What is my course progress?", "query": "What is my overall course progress and completion percentage?", "type": "summary", "className": "pill-summary"},
            {"id": "p-emp-c3", "label": "Recommend next course", "query": "Recommend the best next course to learn based on my skills and goals.", "type": "growth", "className": "pill-recommend"},
            {"id": "p-emp-c4", "label": "How do I log study hours?", "query": "How do I log study hours for my courses in LMS?", "type": "how", "className": "pill-how"},
        ],
        "requests": [
            {"id": "p-emp-r1", "label": "Where is my course request pending?", "query": "Where is my course request currently pending and who is reviewing it?", "type": "doc", "className": "pill-summary"},
            {"id": "p-emp-r2", "label": "How do I request a course?", "query": "How do I submit a new course request in the LMS?", "type": "how", "className": "pill-how"},
            {"id": "p-emp-r3", "label": "Show my request history", "query": "Show all my submitted course and certification requests.", "type": "summary", "className": "pill-summary"},
            {"id": "p-emp-r4", "label": "Check approval stages", "query": "Explain the multi-stage approval workflow for course requests.", "type": "doc", "className": "pill-doc"},
        ],
        "certifications": [
            {"id": "p-emp-ct1", "label": "What certs have I earned?", "query": "What certifications and credentials do I currently have on record?", "type": "cert", "className": "pill-certifications"},
            {"id": "p-emp-ct2", "label": "Recommend certs for my role", "query": "What industry certifications should I pursue for my career advancement?", "type": "growth", "className": "pill-recommend"},
            {"id": "p-emp-ct3", "label": "How to request a certification?", "query": "How do I submit an external certification exam request?", "type": "how", "className": "pill-how"},
            {"id": "p-emp-ct4", "label": "Certification request status", "query": "What is the status of my pending certification requests?", "type": "doc", "className": "pill-summary"},
        ],
        "reimbursements": [
            {"id": "p-emp-rm1", "label": "Show my reimbursement claims", "query": "Show all my reimbursement claims and current payment status.", "type": "doc", "className": "pill-summary"},
            {"id": "p-emp-rm2", "label": "Total reimbursement amount", "query": "What is my total claimed and approved reimbursement amount?", "type": "summary", "className": "pill-summary"},
            {"id": "p-emp-rm3", "label": "How to file a claim?", "query": "How do I claim reimbursement for an exam or course fee?", "type": "how", "className": "pill-how"},
            {"id": "p-emp-rm4", "label": "Reimbursement policy limits", "query": "What are the rules and deadlines for reimbursement submissions?", "type": "doc", "className": "pill-doc"},
        ],
        "default": [
            {"id": "p-emp-d1", "label": "Tell me about my skills", "query": "Tell me about my technical skills and areas of expertise.", "type": "summary", "className": "pill-summary"},
            {"id": "p-emp-d2", "label": "Recommend courses for me", "query": "Recommend courses tailored to my technical skills and learning goals.", "type": "book", "className": "pill-recommend"},
            {"id": "p-emp-d3", "label": "What certifications should I get?", "query": "What certifications should I pursue for advancing in my career?", "type": "cert", "className": "pill-certifications"},
            {"id": "p-emp-d4", "label": "Show my learning summary", "query": "Give me a complete summary of my learning metrics and course progress.", "type": "growth", "className": "pill-summary"},
        ]
    }

    # Role 2: L&D Team (Org-Wide Scope)
    LD_PAGE_PILLS: Dict[str, List[Dict[str, str]]] = {
        "approvals": [
            {"id": "p-ld-a1", "label": "All pending course requests", "query": "Show all pending course approval requests across the company.", "type": "doc", "className": "pill-summary"},
            {"id": "p-ld-a2", "label": "Pending certification requests", "query": "Show all pending certification approval requests awaiting review.", "type": "cert", "className": "pill-certifications"},
            {"id": "p-ld-a3", "label": "Total pending approvals count", "query": "What is the total count of pending approval requests across the organization?", "type": "summary", "className": "pill-summary"},
            {"id": "p-ld-a4", "label": "Approval turnaround overview", "query": "Summarize pending requests by department and review stage.", "type": "growth", "className": "pill-doc"},
        ],
        "assign": [
            {"id": "p-ld-as1", "label": "Top enrolled courses", "query": "What are the most popular and top-enrolled courses across the organization?", "type": "book", "className": "pill-recommend"},
            {"id": "p-ld-as2", "label": "Org enrollment breakdown", "query": "Show organization-wide enrollment counts and completion percentages.", "type": "summary", "className": "pill-summary"},
            {"id": "p-ld-as3", "label": "Departments needing upskilling", "query": "Which departments have the lowest course completion rates?", "type": "growth", "className": "pill-how"},
            {"id": "p-ld-as4", "label": "Recommend org-wide training", "query": "Recommend high-impact training programs for organization-wide skill growth.", "type": "book", "className": "pill-recommend"},
        ],
        "budget": [
            {"id": "p-ld-b1", "label": "Annual training budget status", "query": "What is the overall annual training budget allocation and spend?", "type": "summary", "className": "pill-summary"},
            {"id": "p-ld-b2", "label": "Department budget utilization", "query": "Show budget allocation and spend breakdown by department.", "type": "growth", "className": "pill-doc"},
            {"id": "p-ld-b3", "label": "Total reimbursement spend", "query": "What is the total organization reimbursement claims spend to date?", "type": "summary", "className": "pill-summary"},
            {"id": "p-ld-b4", "label": "Remaining budget overview", "query": "How much training budget remains available for the fiscal year?", "type": "growth", "className": "pill-recommend"},
        ],
        "default": [
            {"id": "p-ld-d1", "label": "Org enrollment summary", "query": "Show the complete organization-wide enrollment summary and metrics.", "type": "summary", "className": "pill-summary"},
            {"id": "p-ld-d2", "label": "Pending approvals count", "query": "Show all pending course and certification requests across the company.", "type": "doc", "className": "pill-doc"},
            {"id": "p-ld-d3", "label": "Department completion rates", "query": "What are the course completion rates across different departments?", "type": "growth", "className": "pill-growth"},
            {"id": "p-ld-d4", "label": "Training budget status", "query": "What is the organization training budget allocation and utilization status?", "type": "summary", "className": "pill-summary"},
            {"id": "p-ld-d5", "label": "Top enrolled courses", "query": "Which courses have the highest enrollment and completion counts?", "type": "book", "className": "pill-recommend"},
            {"id": "p-ld-d6", "label": "Org reimbursement summary", "query": "Show total reimbursement claims and settled amounts across all employees.", "type": "summary", "className": "pill-summary"},
            {"id": "p-ld-d7", "label": "Which teams need support?", "query": "Which teams or departments currently have learners behind schedule?", "type": "growth", "className": "pill-how"},
            {"id": "p-ld-d8", "label": "Recommend org upskilling", "query": "Recommend organization-wide training and skill development initiatives.", "type": "book", "className": "pill-recommend"},
        ]
    }

    def _match_page_key(self, page: str) -> str:
        """Determines the semantic category from active URL path."""
        p = (page or "").lower()
        if any(k in p for k in ["approval", "pending", "request-workflow"]):
            return "approvals" if "ld" in p else "requests"
        if any(k in p for k in ["assign", "catalog", "courses", "my-courses"]):
            return "assign" if "ld" in p else "courses"
        if any(k in p for k in ["budget", "spend", "cost"]):
            return "budget"
        if any(k in p for k in ["cert", "credential", "exam"]):
            return "certifications"
        if any(k in p for k in ["reimb", "claim"]):
            return "reimbursements"
        if any(k in p for k in ["request"]):
            return "requests"
        return "default"

    def get_pills_for_context(self, role: str = "Employee", page: str = "") -> List[Dict[str, str]]:
        """
        Returns contextual suggested prompt pills based on user role and active page.
        """
        r_clean = (role or "employee").lower().replace("_", "").replace("&", "")
        is_ld = "ld" in r_clean or "l_d" in r_clean

        category = self._match_page_key(page)

        if is_ld:
            pool = self.LD_PAGE_PILLS.get(category) or self.LD_PAGE_PILLS["default"]
            return pool
        else:
            pool = self.EMPLOYEE_PAGE_PILLS.get(category) or self.EMPLOYEE_PAGE_PILLS["default"]
            return pool

pill_service = PillService()
