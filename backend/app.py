"""
LMS Backend Application.
Powered by FastAPI with Layered Architecture (Routers -> Services -> Repositories -> Database).
Swagger UI documentation available at /docs.
"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from config import config
from database.connection import init_db
from routes import api_router
from utils.idempotency import IdempotencyMiddleware

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context for startup and shutdown routines."""
    print("[LMS Backend] Initializing database schema...")
    try:
        init_db()
        print("[LMS Backend] Database initialized successfully.")
    except Exception as e:
        print(f"[LMS Backend] Database initialization notice: {e}")
    yield
    print("[LMS Backend] Shutting down...")

app = FastAPI(
    title="LMS Backend API",
    description="Learning Management System backend built with FastAPI, Microsoft Entra ID RBAC, and Layered Architecture.",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Idempotency Middleware (registered before CORSMiddleware so CORSMiddleware sits outermost and adds CORS headers to 409/replays)
app.add_middleware(IdempotencyMiddleware)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_origin_regex=r"^(https?://(localhost|127\.0\.0\.1)(:[0-9]+)?|chrome-extension://.*)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "X-Idempotent-Replay"],
    max_age=86400,
)

@app.middleware("http")
async def add_private_network_header(request: Request, call_next):
    response = await call_next(request)
    if request.headers.get("access-control-request-private-network"):
        response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response

from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi import HTTPException

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Ensure CORS headers and structured JSON response even on unhandled exceptions."""
    origin = request.headers.get("origin", "*")
    cors_headers = {
        "Access-Control-Allow-Origin": origin if ("localhost" in origin or "127.0.0.1" in origin or origin in config.ALLOWED_ORIGINS) else "*",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "*",
        "Access-Control-Allow-Headers": "*",
    }

    if isinstance(exc, (HTTPException, StarletteHTTPException)):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers=cors_headers,
        )

    import traceback
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "error": str(exc)},
        headers=cors_headers,
    )

# Mount all unified API routes
app.include_router(api_router)

# Mount Static Files for Uploaded Certificates and Documents
from fastapi.staticfiles import StaticFiles
uploads_dir = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

@app.get("/", tags=["Root"])
def root():
    """Welcome endpoint pointing to Swagger UI documentation."""
    return {
        "message": "Welcome to LMS Backend API",
        "documentation": "/docs",
        "health": "/api/health",
        "architecture": "Layered Architecture (Router -> Service -> Repository -> Database)"
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 5000))
    host = os.environ.get("HOST", "0.0.0.0")
    uvicorn.run(
        "app:app",
        host=host,
        port=port,
        reload=True,
        reload_excludes=["uploads", "uploads/*", "*.db", "*.db-journal", "*.sqlite", "__pycache__"],
    )
