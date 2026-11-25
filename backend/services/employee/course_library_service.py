"""
Employee Course Library Service.
Business logic layer for Employee Course Library page (frontend/src/pages/employee/CourseLibrary.jsx).
Coordinates course catalog browsing, study material access, and course request submissions.
"""

from typing import List, Dict, Any, Optional
from services.ld.course_service import course_service
from services.ld.study_material_service import study_material_service
from services.ld.course_request_service import course_request_service
from models.employee.course_library import CourseRequestCreate


class CourseLibraryService:
    def get_catalog(self, is_active: bool = True, search: Optional[str] = None) -> List[Dict[str, Any]]:
        """Retrieves active courses for the employee course library."""
        return course_service.get_all(is_active=is_active, search=search)

    def get_study_materials(self, is_active: bool = True) -> List[Dict[str, Any]]:
        """Retrieves active study materials for the employee library."""
        return study_material_service.get_all(is_active=is_active)

    def request_new_course(self, data: CourseRequestCreate, current_user: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Submits an employee course request."""
        if not data.employee_id and isinstance(current_user, dict):
            data.employee_id = current_user.get("employee_id")
        return course_request_service.create_request(data)

    def get_requests_tracker(self, employee_id: str) -> List[Dict[str, Any]]:
        """Retrieves request tracker records for the current employee."""
        return course_request_service.get_tracker_items(employee_id=employee_id)


course_library_service = CourseLibraryService()

__all__ = ["CourseLibraryService", "course_library_service"]
