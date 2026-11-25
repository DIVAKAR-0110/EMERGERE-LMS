"""
Pydantic models for Department Budgets and Spend Categories.
Strictly aligned with dbo.lms_department_budgets and dbo.lms_spend_category schemas.
"""

from typing import Optional
from decimal import Decimal
from datetime import date, datetime
from pydantic import BaseModel, Field

class DepartmentBudgetCreate(BaseModel):
    department: str = Field(..., min_length=2, max_length=100, description="Department name (max 100 chars)")
    budget_year: int = Field(..., ge=2000, le=2100, description="Fiscal budget year")
    budget_amount: Decimal = Field(..., ge=0, description="Allocated budget amount")
    created_by: Optional[str] = Field(None, max_length=7, description="Creator employee ID (max 7 chars)")

class DepartmentBudgetResponse(BaseModel):
    id: int
    department: str
    budget_year: int
    budget_amount: Decimal
    created_at: Optional[datetime] = None
    created_by: Optional[str] = None

class SpendCategoryCreate(BaseModel):
    spend_category: str = Field(..., min_length=2, max_length=30, description="Spend category classification (max 30 chars)")
    department: str = Field(..., min_length=2, max_length=100, description="Department name (max 100 chars)")
    amount: Decimal = Field(..., ge=0, description="Expenditure amount")
    spend_date: date = Field(..., description="Date of expenditure")
    created_by: Optional[str] = Field(None, max_length=7, description="Creator employee ID (max 7 chars)")

class SpendCategoryResponse(BaseModel):
    id: int
    spend_category: str
    department: str
    amount: Decimal
    spend_date: date
    created_at: Optional[datetime] = None
    created_by: Optional[str] = None
