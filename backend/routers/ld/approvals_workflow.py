"""
L&D Approvals Workflow Router.
Page-centric presentation router for frontend/src/pages/L&D/ApprovalsWorkflow.jsx.
Unites Certification Requests, Course Requests, and Reimbursement Claims.
"""

from fastapi import APIRouter
from routers.ld.certification_requests import router as cert_requests_router
from routers.ld.course_requests import router as course_requests_router
from routers.ld.reimbursement_claims import router as reimbursement_claims_router

router = APIRouter()
router.include_router(cert_requests_router)
router.include_router(course_requests_router)
router.include_router(reimbursement_claims_router)

__all__ = [
    "router",
    "cert_requests_router",
    "course_requests_router",
    "reimbursement_claims_router",
]

