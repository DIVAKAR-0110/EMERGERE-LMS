"""
Reports & Analytics Service.
Unified business logic layer for Reporting Manager Reports & Analytics page (frontend/src/pages/ReportingManager/ReportsAnalytics.jsx).
Aggregates team learning report generation and individual employee performance export services.
"""

from services.reporting_manager.learning_report_service import (
    learning_report_service,
    LearningReportService,
)
from services.reporting_manager.employee_report_service import (
    employee_report_service,
    EmployeeReportService,
)

__all__ = [
    "learning_report_service",
    "LearningReportService",
    "employee_report_service",
    "EmployeeReportService",
]

