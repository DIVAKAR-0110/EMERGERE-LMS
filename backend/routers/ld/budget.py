"""
Budget Router.
Presentation layer exposing RESTful endpoints for L&D Spend & Budget Analytics.
"""

from typing import Dict, Any, Optional
from fastapi import APIRouter, Query
from services.ld.budget_service import budget_service

router = APIRouter(prefix="/ld/budget", tags=["L&D Budget"])

@router.get("/course-purchases", summary="Retrieve live Course Purchase History with approval milestones")
def get_course_purchase_history() -> Dict[str, Any]:
    """
    Returns live enterprise course purchase ledger records from database:
    - dbo.lms_course_requests (Master)
    - dbo.lms_courses (Prices & Catalog)
    - dbo.lms_course_request_stages (5-stage approval milestones)
    - Microsoft Entra ID employee directory details
    """
    return budget_service.get_course_purchase_history()

@router.get("/certification-claims", summary="Retrieve live Certification Reimbursement Claims with approval milestones")
def get_certification_claims_history() -> Dict[str, Any]:
    """
    Returns live certification reimbursement claims ledger records from database:
    - dbo.lms_reimbursement_claims (Master)
    - dbo.lms_reimbursement_claim_stages (Approval Milestones)
    - Microsoft Entra ID employee directory details
    """
    return budget_service.get_certification_claims_history()

@router.get("/departments", summary="Retrieve live Spend By Department records with calculated spend percentages")
def get_department_spends(
    period: Optional[str] = Query(None, description="Filter by period e.g. 'This Month', 'Last Quarter', '2026'")
) -> Dict[str, Any]:
    """
    Returns live department spend analytics:
    - Unique departments discovered from Azure AD
    - Course Spent, Reimbursement Spent, Event Spent
    - Total Amount per department
    - Dynamic percentage share of total enterprise spend
    """
    return budget_service.get_department_spends(period=period)

@router.get("/workshops", summary="Retrieve live Workshops & Training events from database")
def get_workshops_history() -> Dict[str, Any]:
    """
    Returns live workshops and college training events ledger records:
    - dbo.lms_workshops_training
    - Formatted dates, participants count, actual expenditure
    """
    return budget_service.get_workshops_history()

@router.get("/stats", summary="Retrieve live dynamic budget horizon KPI stats")
def get_budget_horizon_stats() -> Dict[str, Any]:
    """
    Returns live dynamic budget horizon metrics:
    - This Month Spend (Current Indian month name & rupees)
    - Quarterly Spend (Rolling 3 months)
    - Spent This Year (Current calendar year spend)
    - All-Time LMS Investment (Cumulative enterprise spend)
    - Available Years for dropdown filtering
    """
    return budget_service.get_budget_horizon_stats()

@router.get("/certification-top-providers", summary="Retrieve live dynamic Top 3 Certification Providers")
def get_top_certification_providers(period: Optional[str] = Query(None, description="Fiscal period filter (e.g. 'This Month', 'Last Quarter', '2026')")) -> Dict[str, Any]:
    """
    Returns live Top 3 Certification Providers by spend from database records,
    with proportional percentages and claim counts.
    """
    return budget_service.get_top_certification_providers(period=period)

@router.get("/course-top-providers", summary="Retrieve live dynamic Top 3 Course Providers")
def get_top_course_providers(period: Optional[str] = Query(None, description="Fiscal period filter (e.g. 'This Month', 'Last Quarter', '2026')")) -> Dict[str, Any]:
    """
    Returns live Top 3 Course Providers by enrollment spend from database records,
    with proportional percentages and course counts.
    """
    return budget_service.get_top_course_providers(period=period)




