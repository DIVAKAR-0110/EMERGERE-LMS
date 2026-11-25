"""
Router Aggregator.
Combines presentation routers from page-centric modular subfolders into a unified API router mounted under /api.
Modules:
  - Common: auth, profile, notifications, ai_assistant
  - HR: dashboard
  - Employee: daily_learning, leaderboard, certification_reimbursement
  - Reporting Manager: recommend_course, reports_analytics
  - CEO: dashboard
  - L&D: course_management, approvals_workflow, workshops_training, budget
"""

from fastapi import APIRouter

# 1. Common Routers (Shared across all roles)
from routers.common.auth import router as auth_router
from routers.common.profile import router as profiles_router
from routers.common.notifications import router as notifications_router
from routers.common.ai_assistant import router as ai_assistant_router
from routers.common.course_metadata import router as course_metadata_router
from routers.common.certification_domains import router as certification_domains_router
from routers.common.extension_router import router as extension_router
from routers.common.slot_router import router as slot_router

# 2. Employee Routers (Page-Centric)
from routers.employee.daily_learning import router as daily_learning_router
from routers.employee.leaderboard import router as leaderboard_router
from routers.employee.certification_reimbursement import router as employee_certifications_router

# 3. L&D (Learning & Development) Routers (Page-Centric)
from routers.ld.course_management import router as course_management_router
from routers.ld.approvals_workflow import router as approvals_workflow_router
from routers.ld.workshops_training import router as workshops_router
from routers.ld.budget import router as budget_router

# 4. Reporting Manager Routers (Page-Centric)
from routers.reporting_manager.recommend_course import router as recommendations_router
from routers.reporting_manager.reports_analytics import router as reports_router

# 5. HR Routers (Page-Centric)
from routers.hr.dashboard import router as hr_dashboard_router

# 6. CEO Routers (Page-Centric)
from routers.ceo.dashboard import router as ceo_dashboard_router

api_router = APIRouter(prefix="/api")

# Mount Common Routers
api_router.include_router(auth_router)
api_router.include_router(profiles_router)
api_router.include_router(notifications_router)
api_router.include_router(course_metadata_router)
api_router.include_router(certification_domains_router)
api_router.include_router(extension_router)
api_router.include_router(slot_router)
api_router.include_router(ai_assistant_router, prefix="/ai-assistant")
api_router.include_router(ai_assistant_router, prefix="/LMS Copilot")
api_router.include_router(ai_assistant_router)

# Mount Employee Routers
api_router.include_router(daily_learning_router)
api_router.include_router(leaderboard_router)
api_router.include_router(employee_certifications_router)

# Mount L&D Routers (Page-Centric)
api_router.include_router(course_management_router)
api_router.include_router(approvals_workflow_router)
api_router.include_router(workshops_router)
api_router.include_router(budget_router)

# Mount Reporting Manager Routers
api_router.include_router(reports_router)
api_router.include_router(recommendations_router)

# Mount HR Routers
api_router.include_router(hr_dashboard_router)

# Mount CEO Routers
api_router.include_router(ceo_dashboard_router)

# Top-level health check endpoint
@api_router.get("/health", tags=["System Health"])
def health_check():
    return {"status": "ok", "service": "LMS Backend API", "version": "2.0.0"}
