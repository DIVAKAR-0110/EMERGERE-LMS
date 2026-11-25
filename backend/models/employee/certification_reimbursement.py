"""
Pydantic schemas for Employee Certification & Reimbursement Page.
Matches frontend/src/pages/employee/CertificationReimb.jsx,
RequestCertificationModal.jsx, and NewReimbursementClaimModal.jsx.
"""

from typing import Optional, Any, List, Dict
import re
from pydantic import BaseModel, Field, field_validator


# ==============================================================================
# 1. Certification Request Form Schemas (Request Certification Modal)
# ==============================================================================

class CertificationRequestCreate(BaseModel):
    employee_id: Optional[Any] = Field(default=None, description="ID of the requesting employee (max 7 chars)")
    certification_name: str = Field(..., min_length=2, max_length=150, description="Name of the certification")
    provider_name: Optional[str] = Field(None, max_length=150, description="Custom or selected provider name")
    provider_id: Optional[int] = Field(None, description="FK to CourseProviders(ProviderId)")
    category_name: Optional[str] = Field(None, max_length=100, description="Custom or selected category name")
    category_id: Optional[int] = Field(None, description="FK to CourseCategories(CategoryId)")
    domain_id: Optional[int] = Field(None, description="FK to lms_certification_domains(domain_id)")
    scheduled_exam_date: Optional[str] = Field(None, description="Exam date in YYYY-MM-DD format (4-digit year)")
    estimated_cost_inr: int = Field(..., gt=0, le=100000, description="Estimated certification cost in INR as a whole number (> 0)")
    purpose: str = Field(..., min_length=10, max_length=500, description="Business justification / purpose")
    supporting_document: Optional[str] = Field(None, max_length=500)
    supporting_document_name: Optional[str] = Field(None, max_length=255)
    supporting_document_size: Optional[int] = Field(None, le=10485760, description="Max 5MB")
    created_by: Optional[str] = Field(None, max_length=7, description="Creator employee ID")
    updated_by: Optional[str] = Field(None, max_length=7, description="Updater ID")

    @field_validator("employee_id")
    @classmethod
    def validate_employee_id(cls, v: Any) -> Optional[str]:
        if v is None:
            return None
        s = str(v).strip()
        if not s:
            return None
        if len(s) > 7:
            raise ValueError(f"Employee ID cannot exceed 7 characters (got {s})")
        return s

    @field_validator("certification_name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Certification Name cannot be empty")
        return trimmed

    @field_validator("scheduled_exam_date")
    @classmethod
    def validate_exam_date(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        trimmed = v.strip()
        if not re.match(r"^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$", trimmed):
            raise ValueError("Scheduled exam date must be in YYYY-MM-DD format with a 4-digit year")
        year = int(trimmed.split("-")[0])
        if year < 1900 or year > 2099:
            raise ValueError("Year must be a valid 4-digit year (up to 2099)")
        return trimmed

    @field_validator("estimated_cost_inr", mode="before")
    @classmethod
    def validate_whole_number_cost(cls, v: Any) -> int:
        if v is None:
            raise ValueError("Estimated Cost is required")
        if isinstance(v, float) and not v.is_integer():
            raise ValueError("Estimated cost must be a whole number (no decimals allowed)")
        if isinstance(v, str):
            if "." in v:
                raise ValueError("Estimated cost must be a whole number (no decimals allowed)")
            try:
                v = int(v)
            except ValueError:
                raise ValueError("Estimated cost must be a valid whole number")
        return int(v)

    @field_validator("purpose")
    @classmethod
    def clean_purpose(cls, v: str) -> str:
        trimmed = v.strip()
        if len(trimmed) < 10:
            raise ValueError("Purpose must be at least 10 characters")
        return trimmed


class CertificationStageItem(BaseModel):
    id: Optional[int] = None
    request_id: Optional[int] = None
    stage_name: str
    stage_status: str
    stage_date: Optional[str] = None
    updated_at: Optional[str] = None
    updated_by: Optional[str] = None


class CertificationRequestResponse(BaseModel):
    id: int
    request_code: str
    employee_id: Any
    certification_name: str
    provider_name: Optional[str] = None
    provider_id: Optional[int] = None
    category_name: Optional[str] = None
    category_id: Optional[int] = None
    scheduled_exam_date: Optional[str] = None
    estimated_cost_inr: int
    purpose: str
    supporting_document_path: Optional[str] = None
    supporting_document_name: Optional[str] = None
    supporting_document_size: Optional[int] = None
    status: str
    created_at: Optional[str] = None
    employee_name: Optional[str] = None
    department: Optional[str] = None
    employee_role: Optional[str] = None
    ld_status: Optional[str] = None
    ld_status_date: Optional[str] = None
    ceo_status: Optional[str] = None
    ceo_status_date: Optional[str] = None
    is_ceo_bypassed: Optional[bool] = False
    reopen_reason: Optional[str] = None
    stages: Optional[List[Dict[str, Any]]] = None

    class Config:
        extra = "allow"


# ==============================================================================
# 2. Reimbursement Claim Form Schemas (New Reimbursement Claim Modal)
# ==============================================================================

class ReimbursementClaimCreate(BaseModel):
    employee_id: Optional[Any] = Field(default=None, description="Employee ID (max 7 chars)")
    certification_name: str = Field(..., min_length=2, max_length=150, description="Name of the earned certification")
    provider_name: Optional[str] = Field(None, max_length=150, description="Selected or custom provider name")
    provider_id: Optional[int] = Field(None, description="FK to CourseProviders(ProviderId)")
    category_id: Optional[int] = Field(None, description="FK to CourseCategories(CategoryId)")
    category_name: Optional[str] = Field(None, max_length=100, description="Selected or custom category name")
    amount: int = Field(..., description="Reimbursement amount in INR")
    purchase_date: str = Field(..., description="Date course/exam was purchased (YYYY-MM-DD)")
    completion_exam_date: Optional[str] = Field(None, description="Date exam was cleared or course completed (YYYY-MM-DD)")
    validity_from: Optional[str] = Field(None, description="Validity start date (YYYY-MM-DD)")
    validity_to: Optional[str] = Field(None, description="Validity expiration date (YYYY-MM-DD)")
    supporting_document_path: Optional[str] = Field(None, max_length=500, description="Document path or filename")
    supporting_document_name: Optional[str] = Field(None, max_length=255, description="Original uploaded filename")
    supporting_document_size: Optional[int] = Field(None, description="File size in bytes")
    claim_type: Optional[str] = Field("Certification", max_length=20, description="Claim category")

    @field_validator("employee_id")
    @classmethod
    def validate_employee_id(cls, v: Any) -> Optional[str]:
        if v is None:
            return None
        s = str(v).strip()
        if not s:
            return None
        if len(s) > 7:
            raise ValueError(f"Employee ID cannot exceed 7 characters (got {s})")
        return s

    @field_validator("certification_name")
    @classmethod
    def clean_cert_name(cls, v: str) -> str:
        trimmed = (v or "").strip()
        if not trimmed:
            raise ValueError("Certification Name cannot be empty")
        return trimmed

    @field_validator("amount", mode="before")
    @classmethod
    def validate_amount(cls, v: Any) -> int:
        if v is None:
            raise ValueError("Amount is required")
        if isinstance(v, float):
            if not v.is_integer():
                raise ValueError("Amount must be a whole number (no decimals allowed)")
            v = int(v)
        elif isinstance(v, str):
            trimmed = v.strip()
            if "." in trimmed or not trimmed.isdigit():
                raise ValueError("Amount must be a whole number (no decimals allowed)")
            v = int(trimmed)
        elif not isinstance(v, int):
            try:
                v = int(v)
            except Exception:
                raise ValueError("Amount must be a whole number (no decimals allowed)")
        if v < 1:
            raise ValueError("Amount must be at least ₹1")
        if v > 100000:
            raise ValueError("Amount cannot exceed ₹1,00,000")
        return v

    @field_validator("validity_from", "validity_to")
    @classmethod
    def validate_validity_dates(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return v
        parts = v.split("-")
        if len(parts) >= 1:
            year_str = parts[0]
            if len(year_str) != 4 or not year_str.isdigit():
                raise ValueError("Year must be a 4-digit year")
            year_int = int(year_str)
            if year_int < 2010 or year_int > 2099:
                raise ValueError("Validity year must be between 2010 and 2099")
        return v

    @field_validator("purchase_date", "completion_exam_date")
    @classmethod
    def validate_exam_dates(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return v
        parts = v.split("-")
        if len(parts) >= 1:
            year_str = parts[0]
            if len(year_str) != 4 or not year_str.isdigit():
                raise ValueError("Year must be a 4-digit year")
            year_int = int(year_str)
            if year_int < 1900 or year_int > 2099:
                raise ValueError("Year must be between 1900 and 2099")
        return v


class ReimbursementClaimStageResponse(BaseModel):
    id: Optional[int] = None
    request_code: Optional[str] = None
    claim_id: Optional[Any] = None
    stage_name: str
    stage_status: str
    stage_date: Optional[str] = None

    class Config:
        extra = "allow"


class ReimbursementClaimResponse(BaseModel):
    id: int
    claim_code: str
    employee_id: str
    claim_type: Optional[str] = "Certification"
    certification_name: str
    provider_name: Optional[str] = None
    provider_id: Optional[int] = None
    category_name: Optional[str] = None
    category_id: Optional[int] = None
    amount: int
    purchase_date: Optional[str] = None
    completion_exam_date: Optional[str] = None
    validity_from: Optional[str] = None
    validity_to: Optional[str] = None
    supporting_document_path: Optional[str] = None
    status: str
    processing_status: Optional[str] = None
    submitted_on: Optional[str] = None
    created_at: Optional[str] = None
    employee_name: Optional[str] = None
    employee_role: Optional[str] = None
    department: Optional[str] = None
    approved_on: Optional[str] = None
    stages: Optional[List[ReimbursementClaimStageResponse]] = None
    # Payment slip fields (populated after HR processes payment)
    payment_code: Optional[str] = None
    payment_slip_path: Optional[str] = None
    payment_slip_name: Optional[str] = None
    payment_description: Optional[str] = None
    paid_on: Optional[str] = None
    paid_by: Optional[str] = None

    class Config:
        extra = "allow"

