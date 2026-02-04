from app.routers.auth import router as auth_router
from app.routers.users import router as users_router
from app.routers.agents import router as agents_router
from app.routers.upload import router as upload_router
from app.routers.versions import router as versions_router
from app.routers.components import router as components_router
from app.routers.export import router as export_router
from app.routers.component_upload import router as component_upload_router
from app.routers.memory import router as memory_router
from app.routers.memory import suggestions_router as suggestions_router
from app.routers.library import router as library_router
from app.routers.deployments import router as deployments_router
from app.routers.folders import router as folders_router
from app.routers.organizations import router as organizations_router
from app.routers.stakeholders import router as stakeholders_router
from app.routers.component_grants import router as component_grants_router
from app.routers.component_access_requests import (
    agent_router as access_requests_agent_router,
    component_router as access_requests_component_router,
    request_router as access_requests_router,
)
from app.routers.component_registry import router as component_registry_router
from app.routers.agent_registry_refs import router as agent_registry_refs_router
from app.routers.agent_registry_refs import grants_router as agent_component_grants_router

__all__ = [
    "auth_router",
    "users_router",
    "agents_router",
    "upload_router",
    "versions_router",
    "components_router",
    "export_router",
    "component_upload_router",
    "memory_router",
    "suggestions_router",
    "library_router",
    "deployments_router",
    "folders_router",
    "organizations_router",
    "stakeholders_router",
    "component_grants_router",
    "access_requests_agent_router",
    "access_requests_component_router",
    "access_requests_router",
    "component_registry_router",
    "agent_registry_refs_router",
    "agent_component_grants_router",
]
