"""
Course Enrollments Router.
Provides RESTful endpoints for Employee enrollment requests and L&D Approval/On-Hold workflows.
"""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, Query, status
from models.ld.course_management import EnrollmentRequestCreate, EnrollmentHoldRequest, EnrollmentResponse, UnenrollRequest
from services.ld.course_enrollment_service import course_enrollment_service
from utils.auth import get_current_user, require_employee_id

router = APIRouter(prefix="/enrollments", tags=["Course Enrollments"])

@router.post(
    "/request",
    status_code=status.HTTP_201_CREATED,
    summary="Employee submits a course enrollment request"
)
def request_course_enrollment(
    data: EnrollmentRequestCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Submits an enrollment request for a course with 'Pending' status.
    Generates request_id with format ENR-YYYY-0001.
    """
    return course_enrollment_service.create_request(data, current_user=current_user)

@router.get(
    "/requests",
    summary="L&D retrieves all enrollment requests"
)
def list_enrollment_requests(
    course_id: Optional[int] = Query(None, description="Filter by course ID"),
    status: Optional[str] = Query(None, description="Filter by action status (Pending, On Hold, Approved)"),
    search: Optional[str] = Query(None, description="Search by employee name or course title")
):
    """
    Retrieves all course enrollment requests formatted for L&D Course Management table,
    including license capacity (activeUsers, e.g. 3/4) and other assigned employees.
    """
    return course_enrollment_service.get_all(course_id=course_id, status=status, search=search)

@router.get(
    "/my-status",
    summary="Get course status map for authenticated employee"
)
def get_my_enrollment_status(
    employee_id: Optional[str] = Query(None, description="Explicit employee ID (fallback)"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Returns a dictionary of { course_id: action_status } for the employee,
    allowing CourseLibrary to mark cards as 'available', 'pending', or 'assigned'.
    """
    target_id = require_employee_id(current_user, employee_id)
    status_map, progress_map, completed_map = course_enrollment_service.get_employee_status_and_progress_maps(target_id)
    return {"statusMap": status_map, "progressMap": progress_map, "completedMap": completed_map}

@router.get(
    "/overall-progress",
    summary="Get overall course completion and top 3 recently learned courses for employee"
)
def get_employee_overall_progress(
    employee_id: Optional[str] = Query(None, description="Employee ID filter"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Returns calculated overall course completion percentage, active course/certification counts,
    and the 1 to 3 most recently learned enrolled courses.
    """
    return course_enrollment_service.get_overall_progress(current_user=current_user, employee_id=employee_id)

@router.get(
    "/team-progress",
    summary="Reporting Manager retrieves live course learning progress for team"
)
def get_team_progress(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Returns course learning progress records for all direct reports of the reporting manager.
    Used by ReportingManager/LearningRecords.jsx Courses table.
    """
    return course_enrollment_service.get_team_progress(current_user)


@router.get(
    "/all-progress",
    summary="L&D retrieves live course learning progress for all employees across enterprise"
)
def get_all_progress():
    """
    Returns course learning progress records for all employees across the organization.
    Used by L&D Learning Records Courses table.
    """
    return course_enrollment_service.get_all_employees_progress()


@router.get(
    "/company-completion-stats",
    summary="Get company-wide learning completion rate and distribution stats"
)
def get_company_completion_stats():
    """
    Returns overall progress %, completed %, in-progress %, not-started %,
    trend vs last month %, and active learners count across all employees in the company.
    """
    return course_enrollment_service.get_company_learning_completion_stats()

@router.get(
    "",
    summary="Get all raw enrollments across company"
)
def get_all_enrollments_list():
    """Returns list of enrollments for KPI counting and active learners."""
    return course_enrollment_service.get_all_raw_enrollments()


@router.get(
    "/team-dashboard-summary",
    summary="Reporting Manager retrieves aggregated learning metrics for team members"
)
def get_team_dashboard_summary(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Returns aggregated stats for direct reports:
    - Employee profile & department
    - Enrolled courses count & average progress %
    - Total learning hours logged
    - Professional certification count
    - Anti-scam performance status
    Used by ReportingManager/Dashboard/TeamMembersCard.jsx.
    """
    return course_enrollment_service.get_team_dashboard_summary(current_user)


@router.get(
    "/top-performing-courses",
    summary="Reporting Manager retrieves top performing courses for direct reports"
)
def get_top_performing_courses(
    limit: int = Query(5, ge=1, le=50),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Returns top performing courses taken exclusively by the manager's direct reports.
    """
    return course_enrollment_service.get_team_top_performing_courses(current_user, limit=limit)


@router.get(
    "/team-learning-progress",
    summary="Reporting Manager retrieves learning progress distribution exclusively for direct reports"
)
def get_team_learning_progress(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Returns overall progress, status distribution (Completed, In Progress, Not Started),
    and monthly trend exclusively for direct reports.
    """
    return course_enrollment_service.get_team_learning_progress_stats(current_user)


@router.get(
    "/team-kpi-stats",
    summary="Reporting Manager retrieves KPI summary stats exclusively for direct reports"
)
def get_team_kpi_stats(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Returns team members count, active learners count, avg hours per week,
    and certificates earned (non-expired) exclusively for direct reports.
    """
    return course_enrollment_service.get_team_kpi_stats(current_user)


@router.get(
    "/team-monthly-learning-trends",
    summary="Reporting Manager retrieves rolling monthly learning hours trends for direct reports"
)
def get_team_monthly_learning_trends(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Returns rolling 6 months learning trends (video vs practice hours)
    ending in current month exclusively for direct reports.
    """
    return course_enrollment_service.get_team_monthly_learning_trends(current_user)


@router.get(
    "/team-certifications-status",
    summary="Reporting Manager retrieves certifications status metrics exclusively for direct reports"
)
def get_team_certifications_status(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Returns certification statistics (Earned, Expiring Soon, Requested, Claimed)
    exclusively for direct reports.
    """
    return course_enrollment_service.get_team_certifications_status(current_user)


@router.get(
    "/team-overview-stats",
    summary="Reporting Manager retrieves Team Overview summary statistics exclusively for direct reports"
)
def get_team_overview_stats(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Returns Team Overview KPIs (members, active learners, learning hours,
    certificates earned, pending claims, approved claims) exclusively for direct reports.
    """
    return course_enrollment_service.get_team_overview_stats(current_user)


@router.get(
    "/team-courses-data",
    summary="Reporting Manager retrieves Courses Data distribution exclusively for direct reports"
)
def get_team_courses_data(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Returns Courses Data (Assigned, Completed, Active, Overdue)
    exclusively for direct reports.
    """
    return course_enrollment_service.get_team_courses_data(current_user)


@router.post(
    "/{request_id}/approve",
    summary="L&D approves an enrollment request"
)
def approve_enrollment_request(
    request_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Approves the course enrollment:
    1. Sets action_status = 'Approved'
    2. Assigns course in lms_employee_course table
    3. Triggers in-app notification to the employee
    """
    return course_enrollment_service.approve_request(request_id, current_user=current_user)

@router.post(
    "/{request_id}/hold",
    summary="L&D places an enrollment request On Hold"
)
def hold_enrollment_request(
    request_id: str,
    data: EnrollmentHoldRequest,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Places request on hold with reason:
    1. Sets action_status = 'On Hold'
    2. Stores on_hold_reason
    3. Triggers in-app notification to the employee with reason
    """
    return course_enrollment_service.hold_request(request_id, reason=data.reason, current_user=current_user)



@router.post(
    "/{course_id}/unenroll",
    summary="Unenroll / drop course by course ID with >50% completion protection"
)
def unenroll_course_by_id(
    course_id: int,
    employee_id: Optional[str] = Query(None, description="Employee ID"),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    ENR-YYYY-021: Unenroll from a course by course ID.
    Enforces corporate training audit policy: unenrollment is blocked if course progress > 50%.
    """
    emp_id = require_employee_id(current_user, employee_id)
    return course_enrollment_service.unenroll_course(employee_id=emp_id, course_id=course_id, current_user=current_user)
