"""
AI Assistant Router.
Exposes endpoints for the LMS AI Assistant:
- POST /api/ai-assistant/chat: Main conversation endpoint with LMS guardrails and skills-based recommendations.
- GET /api/ai-assistant/top-courses: Structured top performing courses with provider, price, and materials.
"""

import re
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel
from utils.auth import get_current_user, require_employee_id
from services.common.ai_assistant.openrouter_service import openrouter_service
from services.common.ai_assistant.ai_context_service import ai_context_service
from services.common.ai_assistant.pill_service import pill_service
from services.common.auth_service import employee_service

router = APIRouter(tags=["AI Assistant"])

class ChatRequest(BaseModel):
    query: str
    history: Optional[List[Dict[str, Any]]] = None
    page_context: Optional[str] = ""
    role: Optional[str] = None

class ChatResponse(BaseModel):
    reply: str
    suggestedPills: Optional[List[Dict[str, Any]]] = None
    actions: Optional[List[Dict[str, Any]]] = None
    isLmsOnly: bool = True

def get_ai_user(request: Request) -> Dict[str, Any]:
    """
    User resolver for LMS AI Assistant.
    Validates Microsoft Entra ID Bearer token or X-Employee-Id header; never falls back to a default employee.
    """
    from config import config
    u = None
    try:
        from utils.auth import validate_microsoft_token
        auth_hdr = request.headers.get("authorization")
        if auth_hdr and auth_hdr.startswith("Bearer "):
            t = auth_hdr.replace("Bearer ", "").strip()
            claims = validate_microsoft_token(t)
            u = employee_service.find_employee_by_claims(claims)
            if not u and claims.get("dev_mode") and claims.get("employee_id"):
                u = employee_service.get_employee_by_id(claims.get("employee_id"))
    except Exception:
        pass

    if not u and config.ENABLE_DEV_MOCK_AUTH:
        x_emp = request.headers.get("x-employee-id") or request.headers.get("x-user-id")
        if x_emp:
            u = employee_service.get_employee_by_id(x_emp)

    if not u:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authentication credentials",
        )

    user_dict = dict(u)

    # Respect client role header if provided (e.g. when switched in demo/UI)
    hdr_role = request.headers.get("x-user-role")
    if hdr_role:
        user_dict["role"] = hdr_role

    return user_dict

@router.get("/pills", summary="Get role-based suggested prompt pills")
def get_pills(
    page: str = "",
    role: Optional[str] = None,
    request: Request = None,
    current_user: Dict[str, Any] = Depends(get_ai_user)
):
    """
    Returns contextual suggested prompt pills based on user role and active page.
    Never exposes internal database table names.
    """
    effective_role = role or (request.headers.get("x-user-role") if request else None) or current_user.get("role") or "Employee"
    pills = pill_service.get_pills_for_context(role=effective_role, page=page)
    return {"pills": pills}

@router.post("/chat", response_model=ChatResponse, summary="Send message to LMS AI Assistant")
def chat_with_ai(
    req: ChatRequest,
    current_user: Dict[str, Any] = Depends(get_ai_user)
):
    """
    Processes chat query strictly within the Learning Management System (LMS) domain.
    Enforces strict role-based access control and confidentiality rules:
    - Role 1 (Employee / RM / HR / CEO): Personal learning data only.
    - Role 2 (L&D Team): Organization-wide analytics and approval summaries.
    - Under NO circumstance are raw database table names disclosed or explored to either role.
    """
    user_context = dict(current_user)
    if req.role:
        user_context["role"] = req.role

    resp = openrouter_service.generate_response(
        user_query=req.query,
        current_user=user_context,
        conversation_history=req.history,
        page_context=req.page_context or ""
    )
    reply_text, suggested_pills = resp[0], resp[1]
    actions = getattr(resp, "actions", [])
    return ChatResponse(reply=reply_text, suggestedPills=suggested_pills, actions=actions, isLmsOnly=True)

@router.get("/top-courses", summary="Get Top Performing Courses for AI Assistant")
def get_top_courses():
    """Returns top performing courses with pricing, provider, and study materials."""
    return ai_context_service.get_top_performing_courses(limit=5)

@router.get("/my-profile-context", summary="Get Current Learner Profile Context")
def get_my_profile_context(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Returns profile skills and enrollments used by the AI Assistant."""
    return ai_context_service.get_user_learning_profile(current_user)

class ImportCourseRequest(BaseModel):
    title: str
    provider: Optional[str] = "Coursera"
    url: Optional[str] = ""
    category: Optional[str] = "TECHNOLOGY"
    snippet: Optional[str] = ""

@router.post("/import-external-course", summary="Import Discovered External Course to LMS Catalog")
def import_external_course(req: ImportCourseRequest, current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Empowers L&D and Administrators to one-click import an externally scraped course into dbo.lms_courses.
    """
    from services.common.ai_assistant.web_course_scraper import web_course_scraper
    emp_id = require_employee_id(current_user)
    course_payload = {
        "title": req.title,
        "provider": req.provider,
        "url": req.url,
        "category": req.category,
        "snippet": req.snippet,
    }
    return web_course_scraper.import_external_course_to_catalog(course_payload, imported_by_id=emp_id)

@router.get("/external-courses", summary="Search External Courses via Web Scraper")
def search_external_courses(skill: str = "Cloud", limit: int = 4):
    """
    Returns multi-engine scraped courses across Coursera, edX, Udemy with 24h caching.
    """
    from services.common.ai_assistant.web_course_scraper import web_course_scraper
    return web_course_scraper.scrape_global_top_courses(skill_keyword=skill, limit=limit)

class StudyMaterialRequest(BaseModel):
    topic: str
    history: Optional[List[Dict[str, Any]]] = None

@router.post("/study-material/generate", summary="Generate AI Study Guide from Topic")
def generate_study_material(
    req: StudyMaterialRequest,
    current_user: Dict[str, Any] = Depends(get_ai_user)
):
    """
    Generates an executive-standard study guide enriched with live scraped web courses.
    Returns metadata, preview, and download links for PDF and Markdown.
    """
    from services.ld.study_material_service import study_material_service
    user_name = current_user.get("name") or "Learner"
    res = study_material_service.generate_study_guide(
        topic=req.topic,
        user_name=user_name,
        role=current_user.get("role") or "Employee"
    )
    return {
        "material_id": res["material_id"],
        "topic": res["topic"],
        "title": res["title"],
        "summary": res["summary"],
        "download_pdf_url": res["download_pdf_url"],
        "download_md_url": res["download_md_url"],
        "scraped_courses_count": len(res.get("scraped_courses") or [])
    }

@router.get("/study-material/{material_id}/download", summary="Download AI-Generated Study Material (PDF or Markdown)")
def download_study_material(material_id: str, format: str = "pdf"):
    """
    Downloads executive-standard, AI-synthesized study notes and curated resources.
    Formats: 'pdf' (corporate ReportLab styled) or 'md' (Markdown text).
    """
    from services.ld.study_material_service import study_material_service
    mat = study_material_service.get_material(material_id)
    if not mat:
        # Generate on-demand fallback if material is not cached in memory
        mat = study_material_service.generate_study_guide(topic="Enterprise Software Engineering")

    safe_title = re.sub(r'[^a-zA-Z0-9_\-]', '_', mat.get("topic", "Study_Guide"))
    fmt = format.lower().strip()

    if fmt in ("md", "markdown"):
        md_content = mat.get("markdown", "")
        return Response(
            content=md_content,
            media_type="text/markdown; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="Emergere_Study_Guide_{safe_title}.md"',
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )
    else:
        pdf_bytes = mat.get("pdf_bytes") or b""
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="Emergere_Study_Guide_{safe_title}.pdf"',
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )

