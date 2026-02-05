# Marketplace Gaps Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the 5 high-priority gaps from the Phase 8 Marketplace spec by extending existing AgentHR models and routers.

**Architecture:** Extend the flat `routers/` + `models/` + `schemas/` structure. No service/repository layer refactor. Add new columns to existing `ComponentRegistry` model, create new `MCPServer` and `ComponentVersion` models, enhance existing routers with new endpoints.

**Tech Stack:** FastAPI, SQLAlchemy, PostgreSQL, Alembic, Pydantic v2, httpx (for health checks)

---

## Pre-flight

**Current Alembic head:** `add_component_registry_cols`

**How to run the app locally:** `docker compose up -d` from project root. Backend at `localhost:8000`, frontend at `localhost:3000`, PostgreSQL at `localhost:5432`.

**How to run migrations:** `docker compose exec backend alembic upgrade head`

**How to restart backend after code changes:** `docker compose restart backend` (or `docker compose up -d --build backend` for Dockerfile changes)

**Key patterns to follow:**
- Enums: `class MyEnum(str, Enum)` in model files, use `SQLEnum(MyEnum, values_callable=lambda x: [e.value for e in x])`
- UUID columns: `Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)`
- Soft deletes: `deleted_at = Column(DateTime, nullable=True)`, filter with `.filter(Model.deleted_at.is_(None))`
- Enrichment: `enrich_component()` adds User info to responses via dict spread
- Schemas: `model_config = ConfigDict(from_attributes=True)` for ORM compat
- Migrations: raw SQL `DO $$ BEGIN CREATE TYPE ... EXCEPTION WHEN duplicate_object THEN null; END $$;` for enums
- Router registration: import in `backend/app/routers/__init__.py`, include in `backend/app/main.py`

---

## Workstream 1: Component Status Lifecycle

---

### Task 1.1: Add ComponentStatus enum and model fields

**Files:**
- Modify: `backend/app/models/component_registry.py`

**Step 1: Add the enum and columns**

Add after `ComponentVisibility` enum (after line 19):

```python
class ComponentStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    DEPRECATED = "deprecated"
    RETIRED = "retired"
```

Add columns to `ComponentRegistry` class, after `component_metadata` (after line 42):

```python
status = Column(
    SQLEnum(ComponentStatus, values_callable=lambda x: [e.value for e in x]),
    default=ComponentStatus.DRAFT,
    nullable=False
)
published_at = Column(DateTime, nullable=True)
deprecation_reason = Column(String(500), nullable=True)
```

**Step 2: Verify import**

Ensure `String` is in the imports on line 4 (already imported).

**Step 3: Test that app starts**

Run: `docker compose restart backend && docker compose logs backend --tail 10`
Expected: Server starts without import errors (migration will be added in Task 1.2)

---

### Task 1.2: Migration for status fields

**Files:**
- Create: `backend/migrations/versions/add_component_status.py`

**Step 1: Create the migration file**

```python
"""Add component status lifecycle fields.

Revision ID: add_component_status
Revises: add_component_registry_cols
Create Date: 2026-02-04
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'add_component_status'
down_revision: Union[str, Sequence[str], None] = 'add_component_registry_cols'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create ComponentStatus enum
    op.execute(
        "DO $$ BEGIN CREATE TYPE componentstatus AS ENUM "
        "('draft', 'published', 'deprecated', 'retired'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )

    # Add status column with default 'draft'
    componentstatus_type = postgresql.ENUM(
        'draft', 'published', 'deprecated', 'retired',
        name='componentstatus', create_type=False
    )
    op.add_column('component_registry', sa.Column(
        'status', componentstatus_type, nullable=False, server_default='draft'
    ))
    op.add_column('component_registry', sa.Column(
        'published_at', sa.DateTime(), nullable=True
    ))
    op.add_column('component_registry', sa.Column(
        'deprecation_reason', sa.String(500), nullable=True
    ))

    # Backfill: set all existing components to PUBLISHED
    op.execute(
        "UPDATE component_registry SET status = 'published', "
        "published_at = created_at WHERE deleted_at IS NULL"
    )


def downgrade() -> None:
    op.drop_column('component_registry', 'deprecation_reason')
    op.drop_column('component_registry', 'published_at')
    op.drop_column('component_registry', 'status')
    sa.Enum(name='componentstatus').drop(op.get_bind(), checkfirst=True)
```

**Step 2: Run the migration**

Run: `docker compose exec backend alembic upgrade head`
Expected: Migration applies successfully

**Step 3: Verify in database**

Run: `docker compose exec db psql -U agent_hr -d agent_hr -c "SELECT id, name, status, published_at FROM component_registry LIMIT 3;"`
Expected: Existing components show `status=published` and `published_at` populated

**Step 4: Commit**

```bash
git add backend/app/models/component_registry.py backend/migrations/versions/add_component_status.py
git commit -m "feat: add ComponentStatus lifecycle enum and migration"
```

---

### Task 1.3: Update schema and router for status lifecycle

**Files:**
- Modify: `backend/app/schemas/component_registry.py`
- Modify: `backend/app/routers/component_registry.py`

**Step 1: Update schemas**

In `backend/app/schemas/component_registry.py`:

Add import at line 9:
```python
from app.models.component_registry import ComponentType, ComponentVisibility, ComponentStatus
```

Add to `ComponentRegistryCreate` (after `component_metadata` field):
```python
status: Optional[ComponentStatus] = None  # Defaults to DRAFT in model
```

Add to `ComponentRegistryResponse` (after `updated_at` field, before enriched fields):
```python
status: Optional[ComponentStatus] = None
published_at: Optional[datetime] = None
deprecation_reason: Optional[str] = None
```

Add new schemas at end of file:
```python
class ComponentPublishRequest(BaseModel):
    """No body needed - just POST to publish."""
    pass


class ComponentDeprecateRequest(BaseModel):
    """Schema for deprecating a component."""
    reason: Optional[str] = None
```

**Step 2: Update router - list endpoint**

In `backend/app/routers/component_registry.py`:

Update imports at line 12:
```python
from app.models.component_registry import ComponentRegistry, ComponentSnapshot, ComponentType, ComponentVisibility, ComponentStatus
```

Update imports at line 13-22 to include new schemas:
```python
from app.schemas.component_registry import (
    ComponentRegistryCreate,
    ComponentRegistryUpdate,
    ComponentOwnershipUpdate,
    ComponentRegistryResponse,
    ComponentRegistryListResponse,
    ComponentSnapshotCreate,
    ComponentSnapshotResponse,
    ComponentSnapshotListResponse,
    ComponentPublishRequest,
    ComponentDeprecateRequest,
    UserInfo,
)
```

Add `status` query param to `list_components` (line 48-96). Add after `tag` param:
```python
status: Optional[str] = Query(None, pattern="^(draft|published|deprecated|retired)$"),
```

Add filter logic inside the function, after the tag filter block (after line 90):
```python
if status:
    query = query.filter(ComponentRegistry.status == status)
else:
    # Default: non-owners see only published
    query = query.filter(
        (ComponentRegistry.status == ComponentStatus.PUBLISHED) |
        (ComponentRegistry.owner_id == current_user.id)
    )
```

**Step 3: Update router - create endpoint**

In `create_component` (line 99-130), add `status` to the constructor:
```python
component = ComponentRegistry(
    ...
    status=data.status or ComponentStatus.DRAFT,
)
```

**Step 4: Add publish and deprecate endpoints**

Add after `delete_component` endpoint (after line 252), before the snapshot section:

```python
@router.post("/{component_id}/publish", response_model=ComponentRegistryResponse)
async def publish_component(
    component_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Publish a component to the marketplace (owner only).

    Component must have a description to be published.
    """
    component = db.query(ComponentRegistry).filter(
        ComponentRegistry.id == component_id,
        ComponentRegistry.deleted_at.is_(None)
    ).first()
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")

    if component.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can publish")

    if not component.description:
        raise HTTPException(status_code=400, detail="Component must have a description to publish")

    if component.status == ComponentStatus.PUBLISHED:
        raise HTTPException(status_code=400, detail="Component is already published")

    from datetime import datetime
    component.status = ComponentStatus.PUBLISHED
    component.published_at = datetime.utcnow()
    db.commit()
    db.refresh(component)
    return enrich_component(component, db)


@router.post("/{component_id}/deprecate", response_model=ComponentRegistryResponse)
async def deprecate_component(
    component_id: UUID,
    data: ComponentDeprecateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Deprecate a component (owner only)."""
    component = db.query(ComponentRegistry).filter(
        ComponentRegistry.id == component_id,
        ComponentRegistry.deleted_at.is_(None)
    ).first()
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")

    if component.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can deprecate")

    component.status = ComponentStatus.DEPRECATED
    component.deprecation_reason = data.reason
    db.commit()
    db.refresh(component)
    return enrich_component(component, db)
```

**Step 5: Test endpoints**

Run: `docker compose restart backend`

Test publish:
```bash
# Create a component (will be DRAFT)
curl -s -X POST http://localhost:8000/api/component-registry \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"type":"skill","name":"Test Skill","description":"A test skill"}' | jq '.status'
# Expected: "draft"

# Publish it
curl -s -X POST http://localhost:8000/api/component-registry/{id}/publish \
  -H "Authorization: Bearer $TOKEN" | jq '.status'
# Expected: "published"
```

**Step 6: Commit**

```bash
git add backend/app/schemas/component_registry.py backend/app/routers/component_registry.py
git commit -m "feat: add publish/deprecate lifecycle endpoints for components"
```

---

### Task 1.4: Update library search to respect status

**Files:**
- Modify: `backend/app/routers/library.py`

**Step 1: Read the current library router**

Read `backend/app/routers/library.py` to understand the current list endpoint.

**Step 2: Add status filter**

In the library list/search endpoint, add a filter so only PUBLISHED components from the registry are shown when browsing. The library has its own `ComponentLibrary` model, so this task only applies if the library router queries `ComponentRegistry`. If the library is independent (it likely is based on having its own model), this task may be a no-op.

Check: if the library only queries `ComponentLibrary` (not `ComponentRegistry`), skip this task. The status lifecycle applies to the registry. Mark as complete.

**Step 3: Commit (if changes made)**

```bash
git add backend/app/routers/library.py
git commit -m "feat: filter library browse to published components only"
```

---

## Workstream 2: MCP Server Registry + Health Checks

---

### Task 2.1: MCPServer model

**Files:**
- Create: `backend/app/models/mcp_server.py`

**Step 1: Create the model file**

```python
"""MCP Server registry model for managing MCP server connections."""

import uuid
from datetime import datetime
from enum import Enum

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship

from app.database import Base


class MCPAuthType(str, Enum):
    """Authentication type for MCP server connections."""
    NONE = "none"
    API_KEY = "api_key"
    OAUTH = "oauth"
    BEARER = "bearer"


class MCPServerStatus(str, Enum):
    """Health status of an MCP server."""
    ACTIVE = "active"
    INACTIVE = "inactive"
    UNHEALTHY = "unhealthy"


class MCPServer(Base):
    """Model for registered MCP servers.

    Tracks MCP server URLs, authentication, capabilities, and health status.
    Optionally linked to a ComponentRegistry entry.
    """
    __tablename__ = "mcp_servers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    server_url = Column(String(2048), nullable=False)
    protocol_version = Column(String(50), default="1.0")
    capabilities = Column(ARRAY(String), default=list)
    auth_type = Column(
        SQLEnum(MCPAuthType, values_callable=lambda x: [e.value for e in x]),
        default=MCPAuthType.NONE,
        nullable=False
    )
    auth_config = Column(JSONB, nullable=True)
    health_check_url = Column(String(2048), nullable=True)
    health_check_interval_seconds = Column(Integer, default=300)
    status = Column(
        SQLEnum(MCPServerStatus, values_callable=lambda x: [e.value for e in x]),
        default=MCPServerStatus.ACTIVE,
        nullable=False
    )
    last_health_check_at = Column(DateTime, nullable=True)
    last_health_status = Column(String(255), nullable=True)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    component_id = Column(UUID(as_uuid=True), ForeignKey("component_registry.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    owner = relationship("User", foreign_keys=[owner_id])
    component = relationship("ComponentRegistry", foreign_keys=[component_id])
```

**Step 2: Commit**

```bash
git add backend/app/models/mcp_server.py
git commit -m "feat: add MCPServer model with auth and health check fields"
```

---

### Task 2.2: MCP Server schema

**Files:**
- Create: `backend/app/schemas/mcp_server.py`

**Step 1: Create the schema file**

```python
"""Schemas for MCP Server registry."""

from datetime import datetime
from typing import Optional, Dict, Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.mcp_server import MCPAuthType, MCPServerStatus


class MCPServerCreate(BaseModel):
    """Schema for registering a new MCP server."""

    name: str
    description: Optional[str] = None
    server_url: str
    protocol_version: str = "1.0"
    capabilities: list[str] = []
    auth_type: MCPAuthType = MCPAuthType.NONE
    auth_config: Optional[Dict[str, Any]] = None
    health_check_url: Optional[str] = None
    health_check_interval_seconds: int = 300
    component_id: Optional[UUID] = None

    @field_validator("server_url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        if not v.startswith(("http://", "https://")):
            raise ValueError("server_url must start with http:// or https://")
        return v


class MCPServerUpdate(BaseModel):
    """Schema for updating an MCP server."""

    name: Optional[str] = None
    description: Optional[str] = None
    server_url: Optional[str] = None
    protocol_version: Optional[str] = None
    capabilities: Optional[list[str]] = None
    auth_type: Optional[MCPAuthType] = None
    auth_config: Optional[Dict[str, Any]] = None
    health_check_url: Optional[str] = None
    health_check_interval_seconds: Optional[int] = None
    component_id: Optional[UUID] = None


class MCPServerResponse(BaseModel):
    """Response schema for MCP servers. auth_config is redacted."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: Optional[str] = None
    server_url: str
    protocol_version: str
    capabilities: list[str] = []
    auth_type: MCPAuthType
    auth_configured: bool = False  # True if auth_config is set, never expose actual config
    health_check_url: Optional[str] = None
    health_check_interval_seconds: int
    status: MCPServerStatus
    last_health_check_at: Optional[datetime] = None
    last_health_status: Optional[str] = None
    owner_id: UUID
    component_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime


class MCPServerListResponse(BaseModel):
    """Schema for paginated MCP server list."""

    data: list[MCPServerResponse]
    total: int


class MCPServerHealthResponse(BaseModel):
    """Response from a health check."""

    id: UUID
    name: str
    healthy: Optional[bool] = None
    status_code: Optional[int] = None
    response_time_ms: Optional[int] = None
    error: Optional[str] = None
    last_health_status: Optional[str] = None


class MCPServerConnectionResponse(BaseModel):
    """Connection config returned to agents."""

    id: UUID
    name: str
    server_url: str
    protocol_version: str
    capabilities: list[str] = []
    auth_type: MCPAuthType
```

**Step 2: Commit**

```bash
git add backend/app/schemas/mcp_server.py
git commit -m "feat: add MCP server Pydantic schemas"
```

---

### Task 2.3: MCP Server router

**Files:**
- Create: `backend/app/routers/mcp_servers.py`

**Step 1: Create the router file**

```python
"""MCP Server registry router for managing MCP server connections."""

import time
from datetime import datetime
from typing import Optional
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.mcp_server import MCPServer, MCPServerStatus
from app.schemas.mcp_server import (
    MCPServerCreate,
    MCPServerUpdate,
    MCPServerResponse,
    MCPServerListResponse,
    MCPServerHealthResponse,
    MCPServerConnectionResponse,
)

router = APIRouter(prefix="/api/mcp-servers", tags=["mcp-servers"])


def to_response(server: MCPServer) -> dict:
    """Convert MCPServer to response dict with auth_config redacted."""
    data = {c.name: getattr(server, c.name) for c in server.__table__.columns}
    data["auth_configured"] = server.auth_config is not None and len(server.auth_config) > 0
    del data["auth_config"]  # Never expose
    return data


async def check_server_health(server: MCPServer, db: Session) -> dict:
    """Hit health_check_url, update server status, return result."""
    if not server.health_check_url:
        return {"id": server.id, "name": server.name, "healthy": None, "error": "no_health_check_url"}

    start = time.time()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(server.health_check_url)
            elapsed_ms = int((time.time() - start) * 1000)
            healthy = 200 <= response.status_code < 300

            server.last_health_check_at = datetime.utcnow()
            server.last_health_status = "healthy" if healthy else f"unhealthy ({response.status_code})"
            server.status = MCPServerStatus.ACTIVE if healthy else MCPServerStatus.UNHEALTHY
            db.commit()

            return {
                "id": server.id, "name": server.name,
                "healthy": healthy, "status_code": response.status_code,
                "response_time_ms": elapsed_ms, "last_health_status": server.last_health_status,
            }
    except httpx.TimeoutException:
        server.last_health_check_at = datetime.utcnow()
        server.last_health_status = "timeout"
        server.status = MCPServerStatus.UNHEALTHY
        db.commit()
        return {"id": server.id, "name": server.name, "healthy": False, "error": "timeout"}
    except Exception as e:
        server.last_health_check_at = datetime.utcnow()
        server.last_health_status = f"error: {str(e)[:100]}"
        server.status = MCPServerStatus.UNHEALTHY
        db.commit()
        return {"id": server.id, "name": server.name, "healthy": False, "error": str(e)[:100]}


@router.post("", response_model=MCPServerResponse, status_code=status.HTTP_201_CREATED)
async def register_server(
    data: MCPServerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Register a new MCP server."""
    server = MCPServer(
        name=data.name,
        description=data.description,
        server_url=data.server_url,
        protocol_version=data.protocol_version,
        capabilities=data.capabilities or [],
        auth_type=data.auth_type,
        auth_config=data.auth_config,
        health_check_url=data.health_check_url,
        health_check_interval_seconds=data.health_check_interval_seconds,
        component_id=data.component_id,
        owner_id=current_user.id,
    )
    db.add(server)
    db.commit()
    db.refresh(server)
    return to_response(server)


@router.get("", response_model=MCPServerListResponse)
async def list_servers(
    status_filter: Optional[str] = Query(None, alias="status", pattern="^(active|inactive|unhealthy)$"),
    owner_id: Optional[UUID] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List MCP servers with optional filtering."""
    query = db.query(MCPServer)

    if status_filter:
        query = query.filter(MCPServer.status == status_filter)
    if owner_id:
        query = query.filter(MCPServer.owner_id == owner_id)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (MCPServer.name.ilike(pattern)) | (MCPServer.description.ilike(pattern))
        )

    total = query.count()
    servers = query.order_by(MCPServer.created_at.desc()).offset(skip).limit(limit).all()
    return MCPServerListResponse(data=[to_response(s) for s in servers], total=total)


@router.get("/{server_id}", response_model=MCPServerResponse)
async def get_server(
    server_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific MCP server."""
    server = db.query(MCPServer).filter(MCPServer.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="MCP server not found")
    return to_response(server)


@router.patch("/{server_id}", response_model=MCPServerResponse)
async def update_server(
    server_id: UUID,
    data: MCPServerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an MCP server (owner only)."""
    server = db.query(MCPServer).filter(MCPServer.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="MCP server not found")
    if server.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can update this server")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(server, field, value)

    db.commit()
    db.refresh(server)
    return to_response(server)


@router.delete("/{server_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_server(
    server_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an MCP server (owner only)."""
    server = db.query(MCPServer).filter(MCPServer.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="MCP server not found")
    if server.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can delete this server")

    db.delete(server)
    db.commit()


@router.get("/{server_id}/health", response_model=MCPServerHealthResponse)
async def health_check(
    server_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Trigger a live health check on an MCP server."""
    server = db.query(MCPServer).filter(MCPServer.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="MCP server not found")
    return await check_server_health(server, db)


@router.post("/{server_id}/deactivate", response_model=MCPServerResponse)
async def deactivate_server(
    server_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Deactivate an MCP server (owner only)."""
    server = db.query(MCPServer).filter(MCPServer.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="MCP server not found")
    if server.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can deactivate this server")

    server.status = MCPServerStatus.INACTIVE
    db.commit()
    db.refresh(server)
    return to_response(server)


@router.get("/{server_id}/connection", response_model=MCPServerConnectionResponse)
async def get_connection_config(
    server_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get connection config for an MCP server (for agents to connect)."""
    server = db.query(MCPServer).filter(MCPServer.id == server_id).first()
    if not server:
        raise HTTPException(status_code=404, detail="MCP server not found")
    return MCPServerConnectionResponse(
        id=server.id, name=server.name, server_url=server.server_url,
        protocol_version=server.protocol_version,
        capabilities=server.capabilities or [], auth_type=server.auth_type,
    )


@router.post("/health-check-all")
async def health_check_all(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Run health checks on all active MCP servers (admin only)."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")

    servers = db.query(MCPServer).filter(MCPServer.status == MCPServerStatus.ACTIVE).all()
    results = {"checked": 0, "healthy": 0, "unhealthy": 0, "details": []}

    for server in servers:
        result = await check_server_health(server, db)
        results["checked"] += 1
        if result.get("healthy"):
            results["healthy"] += 1
        elif result.get("healthy") is False:
            results["unhealthy"] += 1
        results["details"].append(result)

    return results
```

**Step 2: Commit**

```bash
git add backend/app/routers/mcp_servers.py
git commit -m "feat: add MCP server router with CRUD and health checks"
```

---

### Task 2.4: Migration for MCP servers table

**Files:**
- Create: `backend/migrations/versions/add_mcp_servers.py`

**Step 1: Create the migration**

```python
"""Add MCP servers table.

Revision ID: add_mcp_servers
Revises: add_component_status
Create Date: 2026-02-04
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'add_mcp_servers'
down_revision: Union[str, Sequence[str], None] = 'add_component_status'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enums
    op.execute(
        "DO $$ BEGIN CREATE TYPE mcpauthtype AS ENUM "
        "('none', 'api_key', 'oauth', 'bearer'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )
    op.execute(
        "DO $$ BEGIN CREATE TYPE mcpserverstatus AS ENUM "
        "('active', 'inactive', 'unhealthy'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )

    mcpauthtype = postgresql.ENUM('none', 'api_key', 'oauth', 'bearer', name='mcpauthtype', create_type=False)
    mcpserverstatus = postgresql.ENUM('active', 'inactive', 'unhealthy', name='mcpserverstatus', create_type=False)

    op.create_table(
        'mcp_servers',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('server_url', sa.String(2048), nullable=False),
        sa.Column('protocol_version', sa.String(50), server_default='1.0'),
        sa.Column('capabilities', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('auth_type', mcpauthtype, nullable=False, server_default='none'),
        sa.Column('auth_config', postgresql.JSONB(), nullable=True),
        sa.Column('health_check_url', sa.String(2048), nullable=True),
        sa.Column('health_check_interval_seconds', sa.Integer(), server_default='300'),
        sa.Column('status', mcpserverstatus, nullable=False, server_default='active'),
        sa.Column('last_health_check_at', sa.DateTime(), nullable=True),
        sa.Column('last_health_status', sa.String(255), nullable=True),
        sa.Column('owner_id', sa.UUID(), nullable=False),
        sa.Column('component_id', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], name='fk_mcp_server_owner'),
        sa.ForeignKeyConstraint(['component_id'], ['component_registry.id'], name='fk_mcp_server_component'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_mcp_servers_owner_id', 'mcp_servers', ['owner_id'])
    op.create_index('ix_mcp_servers_status', 'mcp_servers', ['status'])
    op.create_index('ix_mcp_servers_component_id', 'mcp_servers', ['component_id'])


def downgrade() -> None:
    op.drop_index('ix_mcp_servers_component_id', 'mcp_servers')
    op.drop_index('ix_mcp_servers_status', 'mcp_servers')
    op.drop_index('ix_mcp_servers_owner_id', 'mcp_servers')
    op.drop_table('mcp_servers')
    sa.Enum(name='mcpserverstatus').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='mcpauthtype').drop(op.get_bind(), checkfirst=True)
```

**Step 2: Commit**

```bash
git add backend/migrations/versions/add_mcp_servers.py
git commit -m "feat: add MCP servers database migration"
```

---

### Task 2.5: Wire up MCP server router

**Files:**
- Modify: `backend/app/routers/__init__.py`
- Modify: `backend/app/main.py`

**Step 1: Add import to __init__.py**

Add at end of imports (before `__all__`):
```python
from app.routers.mcp_servers import router as mcp_servers_router
```

Add `"mcp_servers_router"` to the `__all__` list.

**Step 2: Register in main.py**

Add import in the import block:
```python
mcp_servers_router,
```

Add after `agent_component_grants_router` include:
```python
app.include_router(mcp_servers_router)
```

**Step 3: Run migration and test**

Run: `docker compose exec backend alembic upgrade head`
Run: `docker compose restart backend`

Test:
```bash
curl -s http://localhost:8000/api/mcp-servers -H "Authorization: Bearer $TOKEN" | jq
# Expected: {"data": [], "total": 0}
```

**Step 4: Commit**

```bash
git add backend/app/routers/__init__.py backend/app/main.py backend/migrations/versions/add_mcp_servers.py
git commit -m "feat: wire up MCP server router and run migration"
```

---

## Workstream 3: Entitlement-Type Logic

---

### Task 3.1: Add EntitlementType enum and CANCELLED status

**Files:**
- Modify: `backend/app/models/component_registry.py`
- Modify: `backend/app/models/component_access_request.py`

**Step 1: Add EntitlementType to component_registry.py**

Add after `ComponentStatus` enum:
```python
class EntitlementType(str, Enum):
    OPEN = "open"
    REQUEST_REQUIRED = "request_required"
    RESTRICTED = "restricted"
```

Add column to `ComponentRegistry` after `deprecation_reason`:
```python
entitlement_type = Column(
    SQLEnum(EntitlementType, values_callable=lambda x: [e.value for e in x]),
    default=EntitlementType.OPEN,
    nullable=False
)
```

**Step 2: Add CANCELLED to RequestStatus in component_access_request.py**

Update `RequestStatus` enum to:
```python
class RequestStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    DENIED = "denied"
    CANCELLED = "cancelled"
```

**Step 3: Commit**

```bash
git add backend/app/models/component_registry.py backend/app/models/component_access_request.py
git commit -m "feat: add EntitlementType enum and CANCELLED request status"
```

---

### Task 3.2: Migration for entitlement type

**Files:**
- Create: `backend/migrations/versions/add_entitlement_type.py`

**Step 1: Create the migration**

```python
"""Add entitlement type and cancelled request status.

Revision ID: add_entitlement_type
Revises: add_mcp_servers
Create Date: 2026-02-04
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'add_entitlement_type'
down_revision: Union[str, Sequence[str], None] = 'add_mcp_servers'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create EntitlementType enum
    op.execute(
        "DO $$ BEGIN CREATE TYPE entitlementtype AS ENUM "
        "('open', 'request_required', 'restricted'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )

    # Add entitlement_type column
    entitlementtype = postgresql.ENUM(
        'open', 'request_required', 'restricted',
        name='entitlementtype', create_type=False
    )
    op.add_column('component_registry', sa.Column(
        'entitlement_type', entitlementtype, nullable=False, server_default='open'
    ))

    # Add 'cancelled' to requeststatus enum
    op.execute("ALTER TYPE requeststatus ADD VALUE IF NOT EXISTS 'cancelled'")

    # Backfill based on visibility:
    # public -> open, private -> restricted, organization -> request_required
    op.execute(
        "UPDATE component_registry SET entitlement_type = 'open' "
        "WHERE visibility = 'public'"
    )
    op.execute(
        "UPDATE component_registry SET entitlement_type = 'restricted' "
        "WHERE visibility = 'private'"
    )
    op.execute(
        "UPDATE component_registry SET entitlement_type = 'request_required' "
        "WHERE visibility = 'organization'"
    )


def downgrade() -> None:
    op.drop_column('component_registry', 'entitlement_type')
    sa.Enum(name='entitlementtype').drop(op.get_bind(), checkfirst=True)
    # Note: cannot remove enum value from requeststatus in PostgreSQL
```

**Step 2: Run migration**

Run: `docker compose exec backend alembic upgrade head`

**Step 3: Commit**

```bash
git add backend/migrations/versions/add_entitlement_type.py
git commit -m "feat: add entitlement type migration with backfill"
```

---

### Task 3.3: Entitlement-aware request workflow + cancel endpoint

**Files:**
- Modify: `backend/app/routers/component_access_requests.py`

**Step 1: Add entitlement-type awareness to create_access_request**

Add import at top:
```python
from app.models.component_registry import ComponentRegistry, EntitlementType
```

Replace the body of `create_access_request` (lines 62-85) with entitlement-type logic:

```python
    component = get_component_or_404(data.component_id, db)

    # Entitlement-type-aware logic
    if hasattr(component, 'entitlement_type') and component.entitlement_type == EntitlementType.RESTRICTED:
        raise HTTPException(
            status_code=403,
            detail="This component requires direct owner invitation. Self-service requests are not allowed."
        )

    # Check if there's already a pending request
    existing = db.query(ComponentAccessRequest).filter(
        ComponentAccessRequest.component_id == data.component_id,
        ComponentAccessRequest.agent_id == agent_id,
        ComponentAccessRequest.status == RequestStatus.PENDING,
    ).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail="A pending access request already exists for this component"
        )

    if hasattr(component, 'entitlement_type') and component.entitlement_type == EntitlementType.OPEN:
        # Auto-approve: create request as APPROVED + create grant
        now = datetime.utcnow()
        request = ComponentAccessRequest(
            component_id=data.component_id,
            agent_id=agent_id,
            requested_level=data.requested_level,
            requested_by=component.owner_id,
            status=RequestStatus.APPROVED,
            resolved_by=component.owner_id,
            resolved_at=now,
        )
        db.add(request)

        # Also create or update grant
        existing_grant = db.query(ComponentGrant).filter(
            ComponentGrant.component_id == data.component_id,
            ComponentGrant.agent_id == agent_id,
        ).first()
        if existing_grant:
            existing_grant.access_level = data.requested_level
            existing_grant.revoked_at = None
        else:
            grant = ComponentGrant(
                component_id=data.component_id,
                agent_id=agent_id,
                access_level=data.requested_level,
                granted_by=component.owner_id,
            )
            db.add(grant)

        db.commit()
        db.refresh(request)
        return request
    else:
        # REQUEST_REQUIRED (default): create pending request
        request = ComponentAccessRequest(
            component_id=data.component_id,
            agent_id=agent_id,
            requested_level=data.requested_level,
            requested_by=component.owner_id,
        )
        db.add(request)
        db.commit()
        db.refresh(request)
        return request
```

**Step 2: Add cancel endpoint**

Add after `resolve_request` (at end of file):

```python
@request_router.post("/{request_id}/cancel", response_model=ComponentAccessRequestResponse)
def cancel_request(
    request_id: UUID,
    db: Session = Depends(get_db),
):
    """Cancel a pending access request (requester only)."""
    request = db.query(ComponentAccessRequest).filter(
        ComponentAccessRequest.id == request_id
    ).first()
    if not request:
        raise HTTPException(status_code=404, detail="Access request not found")

    if request.status != RequestStatus.PENDING:
        raise HTTPException(status_code=400, detail="Only pending requests can be cancelled")

    request.status = RequestStatus.CANCELLED
    request.resolved_at = datetime.utcnow()
    db.commit()
    db.refresh(request)
    return request
```

**Step 3: Restart and test**

Run: `docker compose restart backend`

**Step 4: Commit**

```bash
git add backend/app/routers/component_access_requests.py
git commit -m "feat: add entitlement-type-aware request workflow and cancel endpoint"
```

---

### Task 3.4: Update schemas + extend/check grant endpoints

**Files:**
- Modify: `backend/app/schemas/component_registry.py`
- Modify: `backend/app/schemas/grants.py`
- Modify: `backend/app/routers/component_grants.py`

**Step 1: Add entitlement_type to component registry schemas**

In `backend/app/schemas/component_registry.py`:

Update import:
```python
from app.models.component_registry import ComponentType, ComponentVisibility, ComponentStatus, EntitlementType
```

Add to `ComponentRegistryCreate`:
```python
entitlement_type: Optional[EntitlementType] = None  # Defaults to OPEN in model
```

Add to `ComponentRegistryResponse` (after `deprecation_reason`):
```python
entitlement_type: Optional[EntitlementType] = None
```

**Step 2: Add grant extend and check schemas**

In `backend/app/schemas/grants.py`, add at end:

```python
class GrantExtendRequest(BaseModel):
    """Schema for extending a grant's expiration."""
    new_expires_at: datetime


class GrantCheckResponse(BaseModel):
    """Response for checking if an agent has access to a component."""
    has_access: bool
    access_level: Optional[ComponentAccessLevel] = None
    expires_at: Optional[datetime] = None
```

**Step 3: Add extend and check endpoints to grants router**

In `backend/app/routers/component_grants.py`:

Add imports:
```python
from app.schemas.grants import (
    ComponentGrantCreate,
    ComponentGrantUpdate,
    ComponentGrantResponse,
    ComponentGrantListResponse,
    GrantExtendRequest,
    GrantCheckResponse,
)
from app.dependencies import get_current_user
from app.models.user import User
```

Add after `revoke_grant` (at end of file):

```python
@router.patch("/{agent_id}/extend", response_model=ComponentGrantResponse)
def extend_grant(
    component_id: UUID,
    agent_id: UUID,
    data: GrantExtendRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Extend a grant's expiration (component owner only)."""
    component = get_component_or_404(component_id, db)
    if component.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only component owner can extend grants")

    grant = db.query(ComponentGrant).filter(
        ComponentGrant.component_id == component_id,
        ComponentGrant.agent_id == agent_id,
    ).first()
    if not grant:
        raise HTTPException(status_code=404, detail="Grant not found")

    grant.expires_at = data.new_expires_at
    db.commit()
    db.refresh(grant)
    return grant


@router.get("/check", response_model=GrantCheckResponse)
def check_access(
    component_id: UUID,
    agent_id: UUID,
    db: Session = Depends(get_db),
):
    """Check if an agent has active access to a component."""
    get_component_or_404(component_id, db)
    grant = db.query(ComponentGrant).filter(
        ComponentGrant.component_id == component_id,
        ComponentGrant.agent_id == agent_id,
    ).first()

    if not grant or not grant.is_active:
        return GrantCheckResponse(has_access=False)

    return GrantCheckResponse(
        has_access=True,
        access_level=grant.access_level,
        expires_at=grant.expires_at,
    )
```

**Important:** The `/check` endpoint MUST be defined BEFORE `/{agent_id}` in the router, or FastAPI will try to parse "check" as a UUID and return 422. Move the `check_access` endpoint above `get_grant`.

**Step 4: Commit**

```bash
git add backend/app/schemas/component_registry.py backend/app/schemas/grants.py backend/app/routers/component_grants.py
git commit -m "feat: add entitlement_type to schemas, grant extend and check endpoints"
```

---

## Workstream 4: Advanced Search

---

### Task 4.1: Faceted search with multi-filter support

**Files:**
- Modify: `backend/app/routers/component_registry.py`

**Step 1: Replace list_components with enhanced version**

Replace the `list_components` function (lines 48-96) with:

```python
@router.get("", response_model=ComponentRegistryListResponse)
async def list_components(
    type: Optional[str] = Query(None, description="Filter by type: skill, tool, memory"),
    types: Optional[str] = Query(None, description="Comma-separated types: skill,tool"),
    visibility: Optional[str] = Query(None, pattern="^(private|organization|public)$"),
    owner_id: Optional[UUID] = None,
    organization_id: Optional[UUID] = None,
    search: Optional[str] = Query(None, description="Search by name or description"),
    tag: Optional[str] = Query(None, description="Filter by single tag"),
    tags: Optional[str] = Query(None, description="Comma-separated tags, matches ANY"),
    status: Optional[str] = Query(None, description="Filter by status: draft, published, deprecated, retired"),
    entitlement_type: Optional[str] = Query(None, description="Filter: open, request_required, restricted"),
    sort_by: str = Query("created_at", pattern="^(name|created_at|updated_at)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List components with faceted filtering, sorting, and pagination."""
    query = db.query(ComponentRegistry).filter(ComponentRegistry.deleted_at.is_(None))

    # Type filters
    if type:
        query = query.filter(ComponentRegistry.type == type)
    elif types:
        type_list = [t.strip() for t in types.split(",") if t.strip()]
        if type_list:
            query = query.filter(ComponentRegistry.type.in_(type_list))

    if visibility:
        query = query.filter(ComponentRegistry.visibility == visibility)
    if owner_id:
        query = query.filter(ComponentRegistry.owner_id == owner_id)
    if organization_id:
        query = query.filter(ComponentRegistry.organization_id == organization_id)
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (ComponentRegistry.name.ilike(search_pattern)) |
            (ComponentRegistry.description.ilike(search_pattern))
        )

    # Tag filters
    if tag:
        query = query.filter(ComponentRegistry.tags.any(tag))
    elif tags:
        tag_list = [t.strip() for t in tags.split(",") if t.strip()]
        if tag_list:
            query = query.filter(ComponentRegistry.tags.overlap(tag_list))

    # Status filter (default: show published + own drafts)
    if status:
        query = query.filter(ComponentRegistry.status == status)
    else:
        query = query.filter(
            (ComponentRegistry.status == ComponentStatus.PUBLISHED) |
            (ComponentRegistry.owner_id == current_user.id)
        )

    # Entitlement type filter
    if entitlement_type:
        query = query.filter(ComponentRegistry.entitlement_type == entitlement_type)

    total = query.count()

    # Dynamic sorting
    sort_column = getattr(ComponentRegistry, sort_by, ComponentRegistry.created_at)
    if sort_order == "asc":
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())

    components = query.offset(skip).limit(limit).all()
    enriched = [enrich_component(comp, db) for comp in components]
    return ComponentRegistryListResponse(data=enriched, total=total)
```

**Step 2: Commit**

```bash
git add backend/app/routers/component_registry.py
git commit -m "feat: add faceted search with multi-type, multi-tag, sorting"
```

---

### Task 4.2: Popular, recent, and mine endpoints

**Files:**
- Modify: `backend/app/routers/component_registry.py`

**Step 1: Add new endpoints**

Add these BEFORE the `/{component_id}` endpoint (otherwise FastAPI will try to parse "popular" as a UUID). Insert after `list_components`:

```python
from sqlalchemy import func as sa_func


@router.get("/popular", response_model=ComponentRegistryListResponse)
async def list_popular(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List most popular published components by active grant count."""
    from app.models.component_grant import ComponentGrant

    grant_counts = (
        db.query(
            ComponentGrant.component_id,
            sa_func.count(ComponentGrant.id).label("grant_count")
        )
        .filter(ComponentGrant.revoked_at.is_(None))
        .group_by(ComponentGrant.component_id)
        .subquery()
    )

    components = (
        db.query(ComponentRegistry)
        .outerjoin(grant_counts, ComponentRegistry.id == grant_counts.c.component_id)
        .filter(
            ComponentRegistry.deleted_at.is_(None),
            ComponentRegistry.status == ComponentStatus.PUBLISHED,
        )
        .order_by(sa_func.coalesce(grant_counts.c.grant_count, 0).desc())
        .limit(limit)
        .all()
    )

    enriched = [enrich_component(comp, db) for comp in components]
    return ComponentRegistryListResponse(data=enriched, total=len(enriched))


@router.get("/recent", response_model=ComponentRegistryListResponse)
async def list_recent(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List most recently published components."""
    components = (
        db.query(ComponentRegistry)
        .filter(
            ComponentRegistry.deleted_at.is_(None),
            ComponentRegistry.status == ComponentStatus.PUBLISHED,
        )
        .order_by(ComponentRegistry.published_at.desc())
        .limit(limit)
        .all()
    )

    enriched = [enrich_component(comp, db) for comp in components]
    return ComponentRegistryListResponse(data=enriched, total=len(enriched))


@router.get("/mine", response_model=ComponentRegistryListResponse)
async def list_mine(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List components owned by current user (all statuses including drafts)."""
    query = (
        db.query(ComponentRegistry)
        .filter(
            ComponentRegistry.deleted_at.is_(None),
            ComponentRegistry.owner_id == current_user.id,
        )
        .order_by(ComponentRegistry.updated_at.desc())
    )

    total = query.count()
    components = query.offset(skip).limit(limit).all()
    enriched = [enrich_component(comp, db) for comp in components]
    return ComponentRegistryListResponse(data=enriched, total=total)
```

**Step 2: Commit**

```bash
git add backend/app/routers/component_registry.py
git commit -m "feat: add popular, recent, and mine discovery endpoints"
```

---

### Task 4.3: Search response enrichment

**Files:**
- Modify: `backend/app/schemas/component_registry.py`

**Step 1: Add optional computed fields to response**

Add to `ComponentRegistryResponse` (after `entitlement_type`):

```python
grant_count: Optional[int] = None
active_request_count: Optional[int] = None
```

These fields are set to `None` by default and only populated when the enrichment function provides them. No query changes needed for single-get endpoints.

**Step 2: Commit**

```bash
git add backend/app/schemas/component_registry.py
git commit -m "feat: add grant_count and active_request_count to response schema"
```

---

## Workstream 5: Semver Versioning

---

### Task 5.1: ComponentVersion model

**Files:**
- Create: `backend/app/models/component_version.py`
- Modify: `backend/app/models/component_registry.py`

**Step 1: Create the model file**

```python
"""Component version model for semantic versioning."""

import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.database import Base


class ComponentVersion(Base):
    """Tracks version history of components with semantic versioning."""

    __tablename__ = "component_versions"
    __table_args__ = (
        UniqueConstraint("component_id", "version", name="uq_component_version"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    component_id = Column(UUID(as_uuid=True), ForeignKey("component_registry.id", ondelete="CASCADE"), nullable=False)
    version = Column(String(50), nullable=False)  # semver: "1.2.0"
    changelog = Column(Text, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    snapshot = Column(JSONB, nullable=True)
    parameters_schema_snapshot = Column(JSONB, nullable=True)
    mcp_config_snapshot = Column(JSONB, nullable=True)

    # Relationships
    component = relationship("ComponentRegistry", foreign_keys=[component_id])
    creator = relationship("User", foreign_keys=[created_by])
```

**Step 2: Add version and parameters_schema to ComponentRegistry**

In `backend/app/models/component_registry.py`, add after `entitlement_type` column:

```python
version = Column(String(50), default="1.0.0")
parameters_schema = Column(JSONB, nullable=True)
```

**Step 3: Commit**

```bash
git add backend/app/models/component_version.py backend/app/models/component_registry.py
git commit -m "feat: add ComponentVersion model and version field to ComponentRegistry"
```

---

### Task 5.2: Version schemas and validation

**Files:**
- Modify: `backend/app/schemas/component_registry.py`

**Step 1: Add version schemas**

Add at the top of the file (after imports):

```python
import re

SEMVER_PATTERN = re.compile(r'^\d+\.\d+\.\d+$')


def validate_semver(v: str) -> str:
    if not SEMVER_PATTERN.match(v):
        raise ValueError("Version must be semver format: X.Y.Z")
    return v


def semver_gt(new: str, current: str) -> bool:
    """Return True if new > current in semver comparison."""
    return tuple(int(x) for x in new.split('.')) > tuple(int(x) for x in current.split('.'))
```

Add `version` to `ComponentRegistryResponse`:
```python
version: Optional[str] = None
```

Add at end of file:

```python
class ComponentVersionCreate(BaseModel):
    """Schema for creating a new component version."""
    version: str
    changelog: Optional[str] = None

    @field_validator("version")
    @classmethod
    def check_semver(cls, v: str) -> str:
        return validate_semver(v)


class ComponentVersionResponse(BaseModel):
    """Response schema for component versions."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    component_id: UUID
    version: str
    changelog: Optional[str] = None
    created_by: UUID
    created_at: datetime
    creator: Optional[UserInfo] = None


class ComponentVersionListResponse(BaseModel):
    """Schema for paginated version list."""
    data: list[ComponentVersionResponse]
    total: int


class ChangelogEntry(BaseModel):
    """A single changelog entry."""
    version: str
    changelog: Optional[str] = None
    created_at: datetime


class ComponentChangelogResponse(BaseModel):
    """Aggregated changelog across versions."""
    component_id: UUID
    entries: list[ChangelogEntry]
```

Add `field_validator` to imports:
```python
from pydantic import BaseModel, ConfigDict, field_validator
```

**Step 2: Commit**

```bash
git add backend/app/schemas/component_registry.py
git commit -m "feat: add semver validation and version schemas"
```

---

### Task 5.3: Version endpoints

**Files:**
- Modify: `backend/app/routers/component_registry.py`

**Step 1: Add imports**

Add to imports:
```python
from app.models.component_version import ComponentVersion
from app.schemas.component_registry import (
    ...,  # existing imports
    ComponentVersionCreate,
    ComponentVersionResponse,
    ComponentVersionListResponse,
    ComponentChangelogResponse,
    ChangelogEntry,
    semver_gt,
)
```

**Step 2: Add version endpoints**

Add after the snapshot endpoints (at end of file):

```python
# ============== Version Endpoints ==============


def enrich_version(version: ComponentVersion, db: Session) -> dict:
    """Add creator info to version response."""
    creator_info = None
    if version.created_by:
        creator = db.query(User).filter(User.id == version.created_by).first()
        if creator:
            creator_info = UserInfo(id=creator.id, name=creator.name, email=creator.email)
    return {
        **{c.name: getattr(version, c.name) for c in version.__table__.columns},
        "creator": creator_info,
    }


@router.post("/{component_id}/versions", response_model=ComponentVersionResponse, status_code=status.HTTP_201_CREATED)
async def create_version(
    component_id: UUID,
    data: ComponentVersionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new version of a component (owner only).

    Snapshots current state and bumps version. New version must be greater than current.
    """
    component = db.query(ComponentRegistry).filter(
        ComponentRegistry.id == component_id,
        ComponentRegistry.deleted_at.is_(None)
    ).first()
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")
    if component.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can create versions")

    # Validate version is greater than current
    current_version = component.version or "0.0.0"
    if not semver_gt(data.version, current_version):
        raise HTTPException(
            status_code=400,
            detail=f"New version {data.version} must be greater than current {current_version}"
        )

    # Snapshot current state
    version = ComponentVersion(
        component_id=component_id,
        version=data.version,
        changelog=data.changelog,
        created_by=current_user.id,
        snapshot={
            "name": component.name,
            "description": component.description,
            "content": component.content,
            "tags": component.tags or [],
            "component_metadata": component.component_metadata or {},
        },
        parameters_schema_snapshot=component.parameters_schema,
    )
    db.add(version)

    # Update component version
    component.version = data.version
    db.commit()
    db.refresh(version)
    return enrich_version(version, db)


@router.get("/{component_id}/versions", response_model=ComponentVersionListResponse)
async def list_versions(
    component_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all versions of a component."""
    component = db.query(ComponentRegistry).filter(
        ComponentRegistry.id == component_id,
        ComponentRegistry.deleted_at.is_(None)
    ).first()
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")

    versions = db.query(ComponentVersion).filter(
        ComponentVersion.component_id == component_id
    ).order_by(ComponentVersion.created_at.desc()).all()

    enriched = [enrich_version(v, db) for v in versions]
    return ComponentVersionListResponse(data=enriched, total=len(enriched))


@router.get("/{component_id}/versions/latest", response_model=ComponentVersionResponse)
async def get_latest_version(
    component_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the latest version of a component."""
    component = db.query(ComponentRegistry).filter(
        ComponentRegistry.id == component_id,
        ComponentRegistry.deleted_at.is_(None)
    ).first()
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")

    version = db.query(ComponentVersion).filter(
        ComponentVersion.component_id == component_id
    ).order_by(ComponentVersion.created_at.desc()).first()
    if not version:
        raise HTTPException(status_code=404, detail="No versions found")
    return enrich_version(version, db)


@router.get("/{component_id}/versions/{version_string}", response_model=ComponentVersionResponse)
async def get_version(
    component_id: UUID,
    version_string: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific version of a component."""
    version = db.query(ComponentVersion).filter(
        ComponentVersion.component_id == component_id,
        ComponentVersion.version == version_string,
    ).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    return enrich_version(version, db)


@router.get("/{component_id}/changelog", response_model=ComponentChangelogResponse)
async def get_changelog(
    component_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get aggregated changelog for a component."""
    component = db.query(ComponentRegistry).filter(
        ComponentRegistry.id == component_id,
        ComponentRegistry.deleted_at.is_(None)
    ).first()
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")

    versions = db.query(ComponentVersion).filter(
        ComponentVersion.component_id == component_id
    ).order_by(ComponentVersion.created_at.desc()).all()

    entries = [
        ChangelogEntry(version=v.version, changelog=v.changelog, created_at=v.created_at)
        for v in versions
    ]
    return ComponentChangelogResponse(component_id=component_id, entries=entries)
```

**Step 3: Commit**

```bash
git add backend/app/routers/component_registry.py
git commit -m "feat: add semver versioning endpoints for component registry"
```

---

### Task 5.4: Migration for component versions

**Files:**
- Create: `backend/migrations/versions/add_component_versions.py`

**Step 1: Create the migration**

```python
"""Add component versions table and version field.

Revision ID: add_component_versions
Revises: add_entitlement_type
Create Date: 2026-02-04
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'add_component_versions'
down_revision: Union[str, Sequence[str], None] = 'add_entitlement_type'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create component_versions table
    op.create_table(
        'component_versions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('component_id', sa.UUID(), nullable=False),
        sa.Column('version', sa.String(50), nullable=False),
        sa.Column('changelog', sa.Text(), nullable=True),
        sa.Column('created_by', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('snapshot', postgresql.JSONB(), nullable=True),
        sa.Column('parameters_schema_snapshot', postgresql.JSONB(), nullable=True),
        sa.Column('mcp_config_snapshot', postgresql.JSONB(), nullable=True),
        sa.ForeignKeyConstraint(['component_id'], ['component_registry.id'], name='fk_version_component', ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], name='fk_version_creator'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('component_id', 'version', name='uq_component_version'),
    )
    op.create_index('ix_component_versions_component_id', 'component_versions', ['component_id'])

    # Add version and parameters_schema to component_registry
    op.add_column('component_registry', sa.Column('version', sa.String(50), server_default='1.0.0'))
    op.add_column('component_registry', sa.Column('parameters_schema', postgresql.JSONB(), nullable=True))

    # Backfill existing components to version 1.0.0
    op.execute("UPDATE component_registry SET version = '1.0.0' WHERE version IS NULL")


def downgrade() -> None:
    op.drop_column('component_registry', 'parameters_schema')
    op.drop_column('component_registry', 'version')
    op.drop_index('ix_component_versions_component_id', 'component_versions')
    op.drop_table('component_versions')
```

**Step 2: Run all migrations**

Run: `docker compose exec backend alembic upgrade head`

**Step 3: Restart and verify**

Run: `docker compose restart backend`
Run: `curl -s http://localhost:8000/api/component-registry/popular -H "Authorization: Bearer $TOKEN" | jq '.total'`

**Step 4: Commit**

```bash
git add backend/migrations/versions/add_component_versions.py
git commit -m "feat: add component versions migration with backfill"
```

---

## Final Verification

After all workstreams are complete:

1. Run all migrations: `docker compose exec backend alembic upgrade head`
2. Restart backend: `docker compose restart backend`
3. Check health: `curl http://localhost:8000/health`
4. Verify endpoints load: `curl http://localhost:8000/api/docs`
5. Test key flows:
   - Create component (DRAFT) -> Publish -> Deprecate
   - Register MCP server -> Health check
   - Request access to OPEN component (auto-approve)
   - Request access to RESTRICTED component (403)
   - Search with type + tag filters
   - Create version 1.1.0 -> List versions -> Get changelog
