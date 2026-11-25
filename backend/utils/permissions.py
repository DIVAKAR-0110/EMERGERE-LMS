"""
Role-Based Access Control (RBAC) permission guards.
Enforces permissions tailored to the 5 primary roles:
- Employee
- Reporting Manager
- L&D Team
- HR Team
- CEO
"""

from typing import Dict, Any, Callable
from fastapi import Depends, HTTPException, status
from utils.auth import get_current_user
from utils.constants import ROLE_PERMISSIONS

def require_permission(permission_code: str) -> Callable:
    """
    FastAPI dependency factory to enforce permission requirements.
    
    Usage:
        @router.post("/courses")
        def create_course(
            course: CourseCreateSchema,
            user: Dict[str, Any] = Depends(require_permission("lms.course.create"))
        ):
            ...
    """
    def permission_checker(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        role = current_user.get("role", "Employee")
        granted = ROLE_PERMISSIONS.get(role, set())
        
        if permission_code not in granted:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Role '{role}' lacks permission '{permission_code}'"
            )
        return current_user

    return permission_checker
