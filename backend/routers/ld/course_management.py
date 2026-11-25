"""
L&D Course Management Router.
Page-centric presentation router for frontend/src/pages/L&D/CourseManagement.jsx.
Unites Course Catalog, Study Materials, Course Assignments, and Course Enrollments.
"""

from fastapi import APIRouter
from routers.ld.courses import router as courses_router
from routers.ld.assign_courses import router as assign_courses_router
from routers.ld.study_materials import router as study_materials_router
from routers.ld.course_enrollments import router as enrollments_router

router = APIRouter()
router.include_router(courses_router)
router.include_router(assign_courses_router)
router.include_router(study_materials_router)
router.include_router(enrollments_router)

__all__ = [
    "router",
    "courses_router",
    "assign_courses_router",
    "study_materials_router",
    "enrollments_router",
]

