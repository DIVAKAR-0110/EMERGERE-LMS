"""
Employee Course Library Repository.
Data access layer for Employee Course Library page (frontend/src/pages/employee/CourseLibrary.jsx).
Exposes course catalog queries and employee request tracking queries.
"""

from typing import List, Dict, Any, Optional
from repositories.ld.course_repository import get_all_courses, get_course_by_id
from repositories.ld.study_material_repository import get_all_materials, get_material_by_id
from repositories.ld.course_request_repository import get_all_requests, insert_course_request

__all__ = [
    "get_all_courses",
    "get_course_by_id",
    "get_all_materials",
    "get_material_by_id",
    "get_all_requests",
    "insert_course_request",
]
