# Marketplace Gaps Implementation Design

**Date:** 2026-02-04
**Scope:** High-priority gaps only (5 workstreams, 20 tasks)
**Architecture:** Extend existing flat routers/ + models/ + schemas/ structure
**Reference:** [Gap Analysis](../marketplace-gap-analysis.md)

---

## Overview

Close the 5 high-priority gaps identified in the Phase 8 Marketplace gap analysis by extending existing AgentHR models and routers. No architectural restructuring.

| # | Workstream | New Files | Modified Files | Tasks |
|---|---|---|---|---|
| 1 | Component Status Lifecycle | 1 migration | 3 (model, router, schema) | 4 |
| 2 | MCP Server Registry + Health Checks | 3 (model, schema, router) + 1 migration | 2 (main.py, requirements.txt) | 5 |
| 3 | Entitlement-Type Logic | 1 migration | 5 (model, 2 routers, 2 schemas) | 4 |
| 4 | Advanced Search | 0 | 2 (router, schema) | 3 |
| 5 | Semver Versioning | 1 new model + 1 migration | 3 (model, router, schema) | 4 |

**Dependency order:** WS1 first (status lifecycle used by search/browse). WS2 independent. WS3-5 after WS1 in any order.

---

## Workstream 1: Component Status Lifecycle

**Goal:** Add draft -> published -> deprecated -> retired lifecycle so marketplace shows only published items by default.

### Task 1.1: Add ComponentStatus enum and status field

**File:** `backend/app/models/component_registry.py`

Add enum:
```python
class ComponentStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    DEPRECATED = "deprecated"
    RETIRED = "retired"
```

Add columns to `ComponentRegistry`:
```python
status = Column(SQLEnum(ComponentStatus), default=ComponentStatus.DRAFT, nullable=False)
published_at = Column(DateTime, nullable=True)
```

### Task 1.2: Migration for status fields

**File:** `backend/migrations/versions/add_component_status.py`

- Create `componentstatus` PostgreSQL enum
- Add `status` column with default `'draft'`
- Add `published_at` column
- Backfill all existing records to `PUBLISHED` status with `published_at = created_at`

### Task 1.3: Update schema and router

**File:** `backend/app/schemas/component_registry.py`
- Add `status: ComponentStatus` to `ComponentRegistryResponse`
- Add `status: Optional[ComponentStatus] = None` to `ComponentRegistryCreate` (defaults to DRAFT)

**File:** `backend/app/routers/component_registry.py`
- Update `GET /` list endpoint: add `status` query param, default to `PUBLISHED` for browsing
- Non-owners see only PUBLISHED; owners see all their own statuses
- Add `POST /api/component-registry/{id}/publish`:
  - Validates component has a description
  - Sets `status = PUBLISHED`, `published_at = utcnow()`
  - Only owner can publish
- Add `POST /api/component-registry/{id}/deprecate`:
  - Accepts optional `reason` in body
  - Sets `status = DEPRECATED`
  - Only owner can deprecate

### Task 1.4: Update library search to respect status

**File:** `backend/app/routers/library.py`
- Library browse/search should filter to `PUBLISHED` components only
- Drafts visible only to owner
- Deprecated items still visible but with status in response

---

## Workstream 2: MCP Server Registry + Health Checks

**Goal:** Dedicated MCP server management with registration, CRUD, and active health monitoring.

### Task 2.1: MCPServer model

**New file:** `backend/app/models/mcp_server.py`

```python
class MCPAuthType(str, Enum):
    NONE = "none"
    API_KEY = "api_key"
    OAUTH = "oauth"
    BEARER = "bearer"

class MCPServerStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    UNHEALTHY = "unhealthy"

class MCPServer(Base):
    __tablename__ = "mcp_servers"

    id = Column(UUID, primary_key=True, default=uuid4)
    name = Column(String, nullable=False)
    description = Column(Text)
    server_url = Column(String, nullable=False)
    protocol_version = Column(String, default="1.0")
    capabilities = Column(ARRAY(String), default=[])
    auth_type = Column(SQLEnum(MCPAuthType), default=MCPAuthType.NONE)
    auth_config = Column(JSONB)  # encrypted reference, never returned in responses
    health_check_url = Column(String)
    health_check_interval_seconds = Column(Integer, default=300)
    status = Column(SQLEnum(MCPServerStatus), default=MCPServerStatus.ACTIVE)
    last_health_check_at = Column(DateTime)
    last_health_status = Column(String)  # "healthy", "unhealthy", "timeout", "error"
    owner_id = Column(UUID, ForeignKey("users.id"), nullable=False)
    component_id = Column(UUID, ForeignKey("component_registry.id"), nullable=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
```

### Task 2.2: MCP Server schema

**New file:** `backend/app/schemas/mcp_server.py`

Schemas:
- `MCPServerCreate`: name (required), server_url (required, URL validated), description, protocol_version, capabilities, auth_type, auth_config, health_check_url, health_check_interval_seconds, component_id
- `MCPServerUpdate`: all optional
- `MCPServerResponse`: all fields EXCEPT `auth_config` (redacted to `{"configured": true/false}`)
- `MCPServerHealthResponse`: id, name, status, last_health_check_at, last_health_status, response_time_ms

### Task 2.3: MCP Server router

**New file:** `backend/app/routers/mcp_servers.py`

Prefix: `/api/mcp-servers`

Endpoints:
- `POST /` — register new MCP server (authenticated, sets owner_id)
- `GET /` — list with filters (status, owner_id, search)
- `GET /{id}` — get single server (auth_config redacted)
- `PATCH /{id}` — update (owner only)
- `DELETE /{id}` — delete (owner only)
- `GET /{id}/health` — trigger live health check (see Task 2.4)
- `POST /{id}/deactivate` — set status to INACTIVE (owner only)
- `GET /{id}/connection` — returns connection config for agents (server_url, protocol_version, capabilities, auth_type)

### Task 2.4: Health check logic

**Dependency:** Add `httpx` to `backend/requirements.txt`

Implement in `backend/app/routers/mcp_servers.py`:

```python
async def check_server_health(server: MCPServer, db: Session) -> dict:
    """Hit health_check_url, update status, return result."""
    import httpx
    import time

    if not server.health_check_url:
        return {"status": "no_health_check_url", "healthy": None}

    start = time.time()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(server.health_check_url)
            elapsed_ms = int((time.time() - start) * 1000)
            healthy = 200 <= response.status_code < 300

            server.last_health_check_at = func.now()
            server.last_health_status = "healthy" if healthy else f"unhealthy ({response.status_code})"
            server.status = MCPServerStatus.ACTIVE if healthy else MCPServerStatus.UNHEALTHY
            db.commit()

            return {"healthy": healthy, "status_code": response.status_code, "response_time_ms": elapsed_ms}
    except httpx.TimeoutException:
        server.last_health_check_at = func.now()
        server.last_health_status = "timeout"
        server.status = MCPServerStatus.UNHEALTHY
        db.commit()
        return {"healthy": False, "error": "timeout"}
    except Exception as e:
        server.last_health_check_at = func.now()
        server.last_health_status = f"error: {str(e)[:100]}"
        server.status = MCPServerStatus.UNHEALTHY
        db.commit()
        return {"healthy": False, "error": str(e)[:100]}
```

Bulk endpoint: `POST /api/mcp-servers/health-check-all` (admin only)
- Iterates all ACTIVE servers, runs health check on each
- Returns summary: `{checked: N, healthy: N, unhealthy: N}`

### Task 2.5: Migration + wire up

**Migration:** `add_mcp_servers.py`
- Create `mcpauthtype` and `mcpserverstatus` PostgreSQL enums
- Create `mcp_servers` table with all columns
- Index on `owner_id`, `status`, `component_id`

**Wire up:** Register `mcp_servers_router` in `backend/app/main.py`

---

## Workstream 3: Entitlement-Type Logic

**Goal:** Make grant/request workflow aware of entitlement types (open auto-grants, request_required needs approval, restricted blocks self-service).

### Task 3.1: Add EntitlementType enum and field

**File:** `backend/app/models/component_registry.py`

Add enum:
```python
class EntitlementType(str, Enum):
    OPEN = "open"
    REQUEST_REQUIRED = "request_required"
    RESTRICTED = "restricted"
```

Add column to `ComponentRegistry`:
```python
entitlement_type = Column(SQLEnum(EntitlementType), default=EntitlementType.OPEN, nullable=False)
```

**File:** `backend/app/models/component_access_request.py`

Add `CANCELLED` to `RequestStatus`:
```python
class RequestStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    DENIED = "denied"
    CANCELLED = "cancelled"
```

### Task 3.2: Migration for entitlement fields

**File:** `backend/migrations/versions/add_entitlement_type.py`

- Create `entitlementtype` PostgreSQL enum
- Add `entitlement_type` column (default 'open')
- Add `cancelled` to `requeststatus` enum
- Backfill: public -> OPEN, private -> RESTRICTED, organization -> REQUEST_REQUIRED

### Task 3.3: Update grant/request workflow

**File:** `backend/app/routers/component_access_requests.py`

Modify request creation (`POST /api/agents/{agent_id}/access-requests`):
```python
# After finding the component:
if component.entitlement_type == EntitlementType.OPEN:
    # Auto-approve: create request as APPROVED + create grant immediately
    request = ComponentAccessRequest(status=RequestStatus.APPROVED, ...)
    grant = ComponentGrant(...)
    db.add_all([request, grant])
    db.commit()
    return request  # with status=APPROVED

elif component.entitlement_type == EntitlementType.RESTRICTED:
    raise HTTPException(403, "This component requires direct owner invitation")

else:  # REQUEST_REQUIRED
    # Existing flow: create PENDING request
    ...
```

Add cancel endpoint:
- `POST /api/access-requests/{id}/cancel` — requester only, must be PENDING status

### Task 3.4: Update schemas and add extend/check endpoints

**File:** `backend/app/schemas/component_registry.py`
- Add `entitlement_type` to response and create schemas

**File:** `backend/app/schemas/grants.py`
- Add `GrantExtendRequest` schema with `new_expires_at`

**File:** `backend/app/routers/component_grants.py`
- Add `PATCH /api/components/{component_id}/grants/{grant_id}/extend` — extend expiration date (owner only)
- Add `GET /api/components/{component_id}/grants/check?agent_id=X` — returns `{has_access: bool, access_level: str, expires_at: str}`

---

## Workstream 4: Advanced Search

**Goal:** Faceted search with popular/recent discovery endpoints.

### Task 4.1: Faceted search with multi-filter support

**File:** `backend/app/schemas/component_registry.py`

Add search params model:
```python
class ComponentSearchParams(BaseModel):
    search: Optional[str] = None
    capability_types: Optional[str] = None  # comma-separated: "skill,tool"
    tags: Optional[str] = None              # comma-separated, matches ANY
    entitlement_type: Optional[str] = None
    status: Optional[str] = "published"     # default to published for browsing
    owner_id: Optional[str] = None
    sort_by: Optional[str] = "created_at"   # name, created_at, updated_at
    sort_order: Optional[str] = "desc"      # asc, desc
```

**File:** `backend/app/routers/component_registry.py`

Update `GET /api/component-registry/`:
- Parse `capability_types` into list, filter with `ComponentRegistry.type.in_(types)`
- Parse `tags` into list, filter with `ComponentRegistry.tags.overlap(tags)` (PostgreSQL array overlap)
- Filter by `entitlement_type`, `status`, `owner_id`
- Dynamic `order_by` based on `sort_by` + `sort_order`
- Non-owners: default status filter `PUBLISHED`

### Task 4.2: Popular and recent endpoints

**File:** `backend/app/routers/component_registry.py`

New endpoints:
- `GET /api/component-registry/popular`:
  - Subquery: `SELECT component_id, COUNT(*) as grant_count FROM component_grants WHERE revoked_at IS NULL GROUP BY component_id`
  - Join with ComponentRegistry, filter `status = PUBLISHED`
  - Order by `grant_count DESC`, limit 20
- `GET /api/component-registry/recent`:
  - Filter `status = PUBLISHED`
  - Order by `published_at DESC`, limit 20
- `GET /api/component-registry/mine`:
  - Filter `owner_id = current_user.id`
  - No status filter (show all including drafts)
  - Order by `updated_at DESC`

### Task 4.3: Search response enrichment

**File:** `backend/app/schemas/component_registry.py`

Add optional computed fields to response:
```python
class ComponentRegistryResponse(BaseModel):
    # ... existing fields ...
    status: Optional[ComponentStatus] = None
    entitlement_type: Optional[EntitlementType] = None
    grant_count: Optional[int] = None           # populated on list endpoints
    active_request_count: Optional[int] = None   # populated on list endpoints
```

These are computed via subquery joins only on list/search/popular/recent endpoints (not on single-get).

---

## Workstream 5: Semver Versioning

**Goal:** Proper semantic versioning with changelog and version comparison.

### Task 5.1: ComponentVersion model

**New file:** `backend/app/models/component_version.py`

```python
class ComponentVersion(Base):
    __tablename__ = "component_versions"

    id = Column(UUID, primary_key=True, default=uuid4)
    component_id = Column(UUID, ForeignKey("component_registry.id"), nullable=False)
    version = Column(String, nullable=False)  # semver: "1.2.0"
    changelog = Column(Text)
    created_by = Column(UUID, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=func.now())
    snapshot = Column(JSONB)                    # full component state
    parameters_schema_snapshot = Column(JSONB)
    mcp_config_snapshot = Column(JSONB)

    __table_args__ = (UniqueConstraint("component_id", "version"),)
```

Add to `ComponentRegistry` model:
```python
version = Column(String, default="1.0.0")
parameters_schema = Column(JSONB)
```

### Task 5.2: Versioning schema and validation

**File:** `backend/app/schemas/component_registry.py`

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

class ComponentVersionCreate(BaseModel):
    version: str  # validated as semver
    changelog: str

class ComponentVersionResponse(BaseModel):
    id: str
    component_id: str
    version: str
    changelog: Optional[str]
    created_by: str
    created_at: datetime
    creator: Optional[UserInfo] = None
```

### Task 5.3: Version endpoints

**File:** `backend/app/routers/component_registry.py`

New endpoints:
- `POST /api/component-registry/{id}/versions`:
  - Validate semver format
  - Validate new version > current `component.version`
  - Snapshot current component state into `ComponentVersion` record
  - Update `component.version` to new version
  - Owner only
- `GET /api/component-registry/{id}/versions`:
  - List all versions, ordered by `created_at DESC`
  - Enriched with creator info
- `GET /api/component-registry/{id}/versions/{version}`:
  - Get specific version record
- `GET /api/component-registry/{id}/versions/latest`:
  - Get most recent version
- `GET /api/component-registry/{id}/changelog`:
  - Aggregated changelog: list of `{version, changelog, created_at}` ordered desc

Existing snapshot endpoints remain untouched for backward compatibility.

### Task 5.4: Migration

**File:** `backend/migrations/versions/add_component_versions.py`

- Create `component_versions` table with all columns + unique constraint
- Add `version` column to `component_registry` (default "1.0.0")
- Add `parameters_schema` JSONB column to `component_registry`
- Backfill: set all existing components to version "1.0.0"

---

## Implementation Order

```
WS1: Status Lifecycle (Tasks 1.1-1.4)
  |
  v
WS2: MCP Server Registry (Tasks 2.1-2.5)  [can run parallel with WS1]
  |
  v
WS3: Entitlement-Type Logic (Tasks 3.1-3.4)  [depends on WS1 for status field]
  |
  v
WS4: Advanced Search (Tasks 4.1-4.3)  [depends on WS1 + WS3 for status + entitlement_type filters]
  |
  v
WS5: Semver Versioning (Tasks 5.1-5.4)  [independent, but benefits from WS1 status]
```

## Migration Strategy

All 4 migrations should be created in sequence with proper Alembic revision chain:
1. `add_component_status.py` (WS1)
2. `add_mcp_servers.py` (WS2)
3. `add_entitlement_type.py` (WS3)
4. `add_component_versions.py` (WS5)

Run `alembic upgrade head` after all migrations are in place.

## Files Summary

**New files (7):**
- `backend/app/models/mcp_server.py`
- `backend/app/models/component_version.py`
- `backend/app/schemas/mcp_server.py`
- `backend/app/routers/mcp_servers.py`
- `backend/migrations/versions/add_component_status.py`
- `backend/migrations/versions/add_mcp_servers.py`
- `backend/migrations/versions/add_entitlement_type.py`
- `backend/migrations/versions/add_component_versions.py`

**Modified files (~10):**
- `backend/app/models/component_registry.py` — add ComponentStatus, EntitlementType, status, entitlement_type, version, parameters_schema, published_at
- `backend/app/models/component_access_request.py` — add CANCELLED to RequestStatus
- `backend/app/schemas/component_registry.py` — add status, entitlement_type, version fields, search params, version schemas
- `backend/app/schemas/grants.py` — add GrantExtendRequest, GrantCheckResponse
- `backend/app/routers/component_registry.py` — publish/deprecate endpoints, advanced search, popular/recent/mine, version endpoints
- `backend/app/routers/component_grants.py` — extend and check endpoints
- `backend/app/routers/component_access_requests.py` — entitlement-type-aware logic, cancel endpoint
- `backend/app/routers/library.py` — filter by PUBLISHED status
- `backend/app/main.py` — register mcp_servers_router
- `backend/requirements.txt` — add httpx
