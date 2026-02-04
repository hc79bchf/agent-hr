from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.routers import (
    auth_router,
    users_router,
    agents_router,
    upload_router,
    versions_router,
    components_router,
    export_router,
    component_upload_router,
    memory_router,
    suggestions_router,
    library_router,
    deployments_router,
    folders_router,
    organizations_router,
    stakeholders_router,
    component_grants_router,
    access_requests_agent_router,
    access_requests_component_router,
    access_requests_router,
    component_registry_router,
    agent_registry_refs_router,
    agent_component_grants_router,
)

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses to prevent reverse engineering."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        response.headers["Pragma"] = "no-cache"

        # Remove server identification headers
        if "server" in response.headers:
            del response.headers["server"]

        return response


# Blocked paths that could expose source code or sensitive info
BLOCKED_PATHS = [
    "/.git", "/.env", "/.svn", "/.hg",
    "/requirements.txt", "/pyproject.toml", "/setup.py",
    "/Dockerfile", "/docker-compose",
    "/__pycache__", "/.pytest_cache",
    "/tests", "/test",
]


class PathProtectionMiddleware(BaseHTTPMiddleware):
    """Block access to sensitive paths that could expose source code."""

    async def dispatch(self, request: Request, call_next):
        path = request.url.path.lower()

        # Block access to sensitive paths
        for blocked in BLOCKED_PATHS:
            if blocked in path:
                return JSONResponse(
                    status_code=404,
                    content={"detail": "Not Found"}
                )

        # Block access to Python files
        if path.endswith(".py") or path.endswith(".pyc"):
            return JSONResponse(
                status_code=404,
                content={"detail": "Not Found"}
            )

        return await call_next(request)


app = FastAPI(
    title="Agent-HR API",
    description="API for managing Claude Code agents",
    version="0.1.0",
    # Hide docs in production (can be enabled via env var if needed)
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# Security middleware - add headers and block sensitive paths
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(PathProtectionMiddleware)

# CORS configuration - allow Railway subdomains and localhost
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://.*\.railway\.app|http://localhost:\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(agents_router)
app.include_router(upload_router)
app.include_router(versions_router)
app.include_router(components_router)
app.include_router(export_router)
app.include_router(component_upload_router)
app.include_router(memory_router)
app.include_router(suggestions_router)
app.include_router(library_router)
app.include_router(deployments_router)
app.include_router(folders_router)
app.include_router(organizations_router)
app.include_router(stakeholders_router)
app.include_router(component_grants_router)
app.include_router(access_requests_agent_router)
app.include_router(access_requests_component_router)
app.include_router(access_requests_router)
app.include_router(component_registry_router)
app.include_router(agent_registry_refs_router)
app.include_router(agent_component_grants_router)


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
