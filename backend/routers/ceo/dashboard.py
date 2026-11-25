"""
CEO Dashboard Router.
Presentation layer exposing RESTful endpoints for CEO analytics:
- Learning by department
- Spend allocations
- Enterprise-wide learner engagement
"""

from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, Query, Response
from services.ceo.dashboard_service import ceo_dashboard_service
from utils.auth import get_current_user

router = APIRouter(prefix="/ceo", tags=["CEO Dashboard"])

@router.get("/department-learning", summary="Get Learning and Spend Analytics by Department")
def get_department_learning(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    """
    Returns department-level learning progress percentages and course/reimbursement spend
    dynamically mapped to Microsoft Entra ID (Azure AD) enterprise departments.
    """
    return ceo_dashboard_service.get_learning_by_department()

@router.get("/kpi-stats", summary="Get CEO Dashboard KPI Statistics")
def get_kpi_stats(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Returns live enterprise-wide KPI stats for the CEO dashboard:
    - total_employees, active_learners, completion_rate_pct, total_learning_hours, employee_distribution
    """
    return ceo_dashboard_service.get_kpi_stats()

@router.get("/budget-expenditure-stats", summary="Get CEO Budget and Spend Analytics Statistics")
def get_budget_expenditure_stats(
    current_user: Dict[str, Any] = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Returns live budget and spend analytics for CEO Budget & Expenditure page:
    - total_investment, certification_spend, course_spend, ytd_learning_spend, spend_by_category
    """
    return ceo_dashboard_service.get_budget_expenditure_stats()

@router.get("/reports/download", summary="Download Overall Employee Learning Report")
def download_learning_report(
    format: str = Query("pdf", description="Export format: pdf, excel, or csv"),
    date_range: str = Query("Year-To-Date (2026)", description="Selected date range filter"),
    include_hours: bool = Query(True),
    include_progress: bool = Query(True),
    include_certs: bool = Query(True),
    include_spend: bool = Query(True),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Generates and streams authentic executive report file in PDF, Excel (.xlsx), or CSV.
    Pulls live data from Azure AD and SQL Server tables.
    """
    includes = {
        "learningHours": include_hours,
        "courseProgress": include_progress,
        "certifications": include_certs,
        "budgetSpend": include_spend
    }
    file_bytes, media_type, filename = ceo_dashboard_service.generate_learning_report(
        export_format=format,
        date_range=date_range,
        includes=includes
    )
    return Response(
        content=file_bytes,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"; filename*=UTF-8\'\'{filename}',
            "Access-Control-Expose-Headers": "Content-Disposition",
        }
    )


