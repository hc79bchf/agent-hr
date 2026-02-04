from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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

app = FastAPI(
    title="Agent-HR API",
    description="API for managing Claude Code agents",
    version="0.1.0",
)

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
