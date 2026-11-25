"""
Profile Models.
Pydantic schemas matching the LMS Profile frontend components:
- Basic Information (Azure AD + LinkedIn/Avatar)
- Skills & Expertise (About Me, Technical Skills, Professional Skills, Area of Expertise)
- Learning & Certifications (Portfolio Certifications, Learning Interests)
"""

import re
from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field, field_validator

class BasicInfoSchema(BaseModel):
    employeeId: Optional[str] = Field(None, max_length=7)
    microsoftObjectId: Optional[str] = Field(None, max_length=100)
    fullName: Optional[str] = Field(None, max_length=100)
    workEmail: Optional[str] = Field(None, max_length=100)
    department: Optional[str] = Field(None, max_length=100)
    jobTitle: Optional[str] = Field(None, max_length=100)
    jobLocation: Optional[str] = Field(None, max_length=100)
    mobileNumber: Optional[str] = Field(None, max_length=20)
    reportingManager: Optional[str] = Field(None, max_length=100)
    reportingManagerId: Optional[str] = Field(None, max_length=7)
    dateOfJoining: Optional[str] = None
    linkedinUrl: Optional[str] = Field(None, max_length=255)
    photoInitials: Optional[str] = Field(None, max_length=10)
    avatarUrl: Optional[str] = Field(None, max_length=500)

class SkillsExpertiseSchema(BaseModel):
    aboutMe: Optional[str] = Field(None, max_length=250)
    technicalSkills: List[str] = Field(default_factory=list)
    professionalSkills: List[str] = Field(default_factory=list)
    areaOfExpertise: List[str] = Field(default_factory=list)

    @field_validator("aboutMe")
    @classmethod
    def validate_about_me(cls, v: Optional[str]) -> Optional[str]:
        if v:
            text = str(v).replace("\r\n", "\n").replace("\r", "\n").replace("\t", " ")
            text = re.sub(r" {2,}", " ", text)
            text = re.sub(r" *\n *", "\n", text)
            text = re.sub(r"\n{2,}", "\n", text).strip()
            if len(text) > 250:
                raise ValueError("Professional summary cannot exceed 250 characters.")
            return text
        return v

class CertificationItemSchema(BaseModel):
    id: Optional[Union[int, str]] = None
    name: str = Field(..., min_length=1)
    credentialId: Optional[str] = Field(None, max_length=50)
    certificate_id: Optional[str] = Field(None, max_length=50)
    issuer: Optional[str] = None
    issueDate: Optional[str] = None
    expiryDate: Optional[str] = None
    certificateUrl: Optional[str] = None
    certificateFileName: Optional[str] = None
    certificateFileSize: Optional[Union[int, str]] = None
    certificateType: Optional[str] = None

class LearningCertificationsSchema(BaseModel):
    certifications: List[CertificationItemSchema] = Field(default_factory=list)
    certification_ids: List[int] = Field(default_factory=list)
    learningInterests: List[str] = Field(default_factory=list)

class ProfileResponse(BaseModel):
    isProfileCompleted: Optional[bool] = False
    basicInfo: BasicInfoSchema
    skillsExpertise: SkillsExpertiseSchema
    learningCertifications: LearningCertificationsSchema

class ProfileUpdateRequest(BaseModel):
    basicInfo: Optional[BasicInfoSchema] = None
    skillsExpertise: Optional[SkillsExpertiseSchema] = None
    learningCertifications: Optional[LearningCertificationsSchema] = None
