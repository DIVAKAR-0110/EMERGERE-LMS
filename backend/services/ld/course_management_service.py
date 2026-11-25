"""
Course Management Service.
Unified business logic layer for L&D Course Management page (frontend/src/pages/L&D/CourseManagement.jsx).
Aggregates course catalog operations, AI study material generation, course assignments, and employee enrollments.
"""

from services.ld.course_service import course_service, CourseService
from services.ld.study_material_service import study_material_service, StudyMaterialService
from services.ld.assign_course_service import assign_course_service, AssignCourseService
from services.ld.course_enrollment_service import course_enrollment_service, CourseEnrollmentService

__all__ = [
    "course_service",
    "CourseService",
    "study_material_service",
    "StudyMaterialService",
    "assign_course_service",
    "AssignCourseService",
    "course_enrollment_service",
    "CourseEnrollmentService",
]

