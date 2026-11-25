"""
Reports & Analytics Export Router.
Endpoints for downloading custom learning reports in CSV, Excel (.xlsx), and PDF formats.
"""

import io
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, Query, Body, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from services.reporting_manager.learning_report_service import learning_report_service
from services.reporting_manager.employee_report_service import employee_report_service
from utils.auth import get_current_user

router = APIRouter(prefix="/reports", tags=["Reports & Analytics"])

class DownloadReportRequest(BaseModel):
    dateRange: Optional[str] = "This Month"
    exportFormat: Optional[str] = "PDF"
    includes: Optional[Dict[str, Any]] = None

class EmployeeReportRequest(BaseModel):
    dateRange: Optional[str] = "All Time"
    exportFormat: Optional[str] = "PDF"
    includes: Optional[Dict[str, Any]] = None

@router.post(
    "/learning-report/data",
    summary="Get structured team learning report JSON data"
)
def get_learning_report_data(
    payload: DownloadReportRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Returns structured team learning report data for Reporting Managers in JSON format.
    """
    try:
        data = learning_report_service.collect_report_data(
            current_user=current_user,
            date_range=payload.dateRange or "This Month",
            includes=payload.includes or {}
        )
        return data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch learning report data: {str(e)}"
        )

@router.post(
    "/learning-report/download",
    summary="Download custom team learning report in PDF, Excel, or CSV"
)
def download_learning_report(
    payload: DownloadReportRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Generates and streams a custom team learning report in the requested format
    (PDF, Excel, or CSV) with selected sections (Learning Hours, Course Progress,
    Certifications, and Leaderboard Rankings).
    """
    try:
        file_bytes, filename, media_type = learning_report_service.build_report_file(
            current_user=current_user,
            date_range=payload.dateRange or "This Month",
            export_format=payload.exportFormat or "PDF",
            includes=payload.includes or {}
        )

        return StreamingResponse(
            io.BytesIO(file_bytes),
            media_type=media_type,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate learning report: {str(e)}"
        )

@router.post(
    "/employee-learning-report/download",
    summary="Download individual employee learning report in PDF, Excel, or CSV"
)
def download_employee_learning_report(
    payload: EmployeeReportRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Generates and streams a custom self-service employee learning report in the requested format
    (PDF, Excel, or CSV) with selected sections: Profile Summary, Course Enrollments,
    Certifications, Reimbursement Claims, Daily Learning Log, and Leaderboard Rankings.
    """
    try:
        file_bytes, filename, media_type = employee_report_service.build_report_file(
            current_user=current_user,
            date_range=payload.dateRange or "All Time",
            export_format=payload.exportFormat or "PDF",
            includes=payload.includes or {}
        )

        return StreamingResponse(
            io.BytesIO(file_bytes),
            media_type=media_type,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate employee learning report: {str(e)}"
        )

