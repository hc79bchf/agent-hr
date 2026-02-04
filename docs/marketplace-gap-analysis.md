# Gap Analysis: Phase 8 Marketplace vs Current AgentHR Implementation

**Date:** 2026-02-04
**Spec Reference:** Phase 8 Marketplace (30 Tasks)
**Codebase:** AgentHR

---

## Executive Summary

AgentHR already has ~60-65% of the marketplace concepts implemented, but under different names and architecture. The spec envisions a new `modules/marketplace/` structure, while AgentHR uses a flat `routers/` + `models/` structure. The biggest gaps are: **no dedicated MCP server registry**, **no capability catalog with entitlement types**, **no background jobs**, **no metrics/analytics**, and **no notification service**.

---

## Mapping: Spec Concepts to Existing Implementation

| Spec Concept | Spec Name | Existing AgentHR Equivalent | Match Level |
|---|---|---|---|
| Catalog item | `Capability` model | `ComponentRegistry` model | **Partial** |
| Item types | `CapabilityType` (skill, tool, integration, mcp_server) | `ComponentType` (skill, tool, memory) | **Partial** - missing `integration`, `mcp_server` |
| Access model | `EntitlementType` (open, request_required, restricted) | `ComponentVisibility` (private, org, public) | **Partial** - different concept |
| Lifecycle | `CapabilityStatus` (draft, published, deprecated, retired) | No status on components | **Missing** |
| Access grant | `Entitlement` model | `ComponentGrant` model | **Partial** |
| Grant status | `EntitlementStatus` (active, revoked, expired) | `is_active` computed property | **Partial** |
| Approval flow | `EntitlementRequest` model | `ComponentAccessRequest` model | **Strong** |
| Request status | `RequestStatus` (pending, approved, denied, cancelled) | `RequestStatus` (pending, approved, denied) | **Strong** - missing `cancelled` |
| MCP registry | `MCPServer` model | None (MCP tools stored as components) | **Missing** |
| Versioning | `CapabilityVersion` model | `ComponentSnapshot` model | **Partial** - manual snapshots vs full versioning |
| Search | Full-text search with facets | Basic `ilike` search on name/description | **Partial** |
| Metrics | `CapabilityMetricsService` | `usage_count` on library components | **Minimal** |
| Notifications | `MarketplaceNotificationService` | None | **Missing** |
| Background jobs | `EntitlementExpirationJob` | None | **Missing** |
| Service layer | Dedicated service classes | Logic embedded in routers | **Missing** (architectural) |
| Repository pattern | Dedicated repository classes | Direct SQLAlchemy in routers | **Missing** (architectural) |

---

## Detailed Gap Analysis by Task

| Task | Spec Requirement | Current Status | Gap |
|---|---|---|---|
| **8.1** Enums | `CapabilityType`, `EntitlementType`, `CapabilityStatus`, `EntitlementStatus`, `RequestStatus` | `ComponentType` (3 values), `ComponentVisibility`, `ComponentAccessLevel`, `RequestStatus` (3 values) | Need `integration`/`mcp_server` types, `CapabilityStatus` lifecycle, `cancelled` request status |
| **8.2** Capability Model | Full catalog entry with MCP config, parameters_schema, versioning | `ComponentRegistry` covers ~70% (no `parameters_schema`, no `mcp_config`, no `status` lifecycle, no `version` field) | Add status, version, mcp_config, parameters_schema fields |
| **8.3** Entitlement Model | Access grants with expiration, revocation tracking | `ComponentGrant` has expiration + revocation | **Mostly covered** - close match |
| **8.4** Request Model | Approval workflow with justification, metadata | `ComponentAccessRequest` has workflow but no `justification` text field, no `metadata` JSONB | Add justification and metadata fields |
| **8.5** MCP Server Model | Dedicated server registry with health checks, auth config | **Not implemented** - MCP tools stored as generic components | **Full gap** - need new model |
| **8.6** Schemas | Pydantic schemas for all marketplace operations | Existing schemas cover ~60% | Need `CapabilitySearchParams`, MCP schemas, metrics schemas |
| **8.7** Capability Repository | Repository pattern for capabilities | Direct queries in routers | **Architecture gap** - need service/repo layer |
| **8.8** Entitlement Repository | Repository pattern for entitlements | Direct queries in routers | **Architecture gap** |
| **8.9** Request Repository | Repository pattern for requests | Direct queries in routers | **Architecture gap** |
| **8.10** Capability Service | Business logic for capabilities | Logic in routers | **Architecture gap** |
| **8.11** Entitlement Service | Grant/revoke with entitlement type checks | Basic grant CRUD without type-based logic | Need entitlement-type-aware logic |
| **8.12** Request Service | Auto-approve for open, notifications | Basic approve/deny without auto-approve | Need auto-approve + notification integration |
| **8.13** MCP Server Repository | MCP server CRUD | **Not implemented** | **Full gap** |
| **8.14** MCP Server Service | Health checks, connection config | **Not implemented** | **Full gap** |
| **8.15** Dependencies | FastAPI DI functions | Inline in routers | **Architecture gap** |
| **8.16** Capability Router CRUD | CRUD + publish/deprecate | CRUD exists, no publish/deprecate lifecycle | Need lifecycle endpoints |
| **8.17** Capability Search | Faceted search, popular, recent | Basic `ilike` search | Need advanced search, popular/recent endpoints |
| **8.18** Capability Versioning | Semver versioning with changelog | Manual snapshots with labels | Need semver validation, changelog, version comparison |
| **8.19** Entitlement Router | Grant/revoke/extend/check | Grant/revoke exists, no extend/check endpoints | Need extend and check endpoints |
| **8.20** Request Router | Full approval workflow with cancel | Approve/deny exists, no cancel | Need cancel endpoint |
| **8.21** MCP Server Router | Full MCP server management | **Not implemented** | **Full gap** |
| **8.22** Capability Version Model | Version history with snapshots | `ComponentSnapshot` partially covers | Need dedicated version model with semver |
| **8.23** Version History Service | Semver validation, rollback, compare | Basic snapshot create/restore | Need semver, compare, rollback |
| **8.24** Metrics Service | Usage analytics, platform metrics | `usage_count` counter only | **Full gap** - need comprehensive metrics |
| **8.25** Expiration Job | Background entitlement cleanup | **Not implemented** | **Full gap** |
| **8.26** Notification Service | Workflow notifications | **Not implemented** | **Full gap** |
| **8.27** Migration | Database tables | Tables exist for current models | Need migration for new fields/tables |
| **8.28** Wire Up Module | Module init + main.py | Routers already wired | Need restructuring if adopting module pattern |
| **8.29** Integration Tests | End-to-end workflow tests | No integration tests for these features | **Full gap** |
| **8.30** API Documentation | OpenAPI docs | Basic FastAPI auto-docs | Need enriched descriptions |

---

## Current AgentHR Implementation Inventory

### Component Registry
- **Model:** `ComponentRegistry` with fields: name, description, type (skill/tool/memory), visibility (private/org/public), config (JSONB), owner_id, organization_id, folder
- **Versioning:** `ComponentSnapshot` for manual save points with labels
- **Agent linking:** `AgentRegistryRef` (many-to-many with config overrides)
- **Router:** 11 endpoints covering CRUD, search, snapshots, agent references

### Component Library
- **Model:** `ComponentLibrary` with fields: name, description, type (skill/mcp_tool/memory), category, config (JSONB), is_default, usage_count
- **Agent linking:** `AgentLibraryRef` (many-to-many)
- **Router:** 9 endpoints covering CRUD, batch operations, categories, agent references

### Access Control / Grants
- **Model:** `ComponentGrant` with access levels (VIEWER/EXECUTOR/CONTRIBUTOR)
- **Features:** Expiration dates, revocation tracking, is_active computed property
- **Model:** `AgentUserGrant` for agent-level user access

### Access Requests
- **Model:** `ComponentAccessRequest` with approval workflow
- **Status:** pending, approved, denied (missing: cancelled)
- **Router:** 5 endpoints across 3 router prefixes

### Agent System
- **Model:** `Agent` with full version history (`AgentVersion`)
- **Features:** Version rollback, diff comparison between versions
- **Stakeholders:** `AgentStakeholder` with role-based associations

### Organizations
- **Model:** `Organization` with hierarchy support
- **User association:** via `user_organization_id` on User model

---

## Priority Summary

### Already Implemented (can skip or adapt)
- Component CRUD (Task 8.2 partial, 8.16 partial)
- Access grants (Task 8.3, 8.19 partial)
- Access requests/approval (Task 8.4 partial, 8.20 partial)
- Agent-component references
- Organizations & stakeholders
- Basic versioning/snapshots

### High Priority Gaps (core marketplace functionality)
1. **MCP Server Registry** (Tasks 8.5, 8.13, 8.14, 8.21) - completely missing
2. **Capability Status Lifecycle** (draft -> published -> deprecated -> retired)
3. **Entitlement-type-aware logic** (open auto-grants, request_required flow, restricted blocks)
4. **Advanced Search** (faceted, popular, recent) (Task 8.17)
5. **Semver Versioning** with changelog (Tasks 8.18, 8.22, 8.23)

### Medium Priority Gaps (operational excellence)
6. **Metrics/Analytics Service** (Task 8.24)
7. **Background Jobs** for entitlement expiration (Task 8.25)
8. **Notification Service** for workflow events (Task 8.26)
9. **Integration Tests** (Task 8.29)

### Low Priority / Architectural (can defer)
10. **Service/Repository layer refactor** (Tasks 8.7-8.10, 8.15)
11. **Module structure reorganization** (`modules/marketplace/`)
12. **Enhanced API documentation** (Task 8.30)

---

## Key Architectural Differences

| Aspect | Phase 8 Spec | Current AgentHR |
|---|---|---|
| Structure | `modules/marketplace/` with services, repositories, models | Flat `routers/` + `models/` |
| Business logic | Service classes | Inline in route handlers |
| Data access | Repository pattern | Direct SQLAlchemy queries in routers |
| Component systems | Single `Capability` model | Dual system: `ComponentRegistry` + `ComponentLibrary` |
| Versioning | Semver with `CapabilityVersion` model | Manual `ComponentSnapshot` with labels |
| Access model | Entitlement-based (open/request/restricted) | Visibility + grants (private/org/public + VIEWER/EXECUTOR/CONTRIBUTOR) |

---

## Recommendation

Rather than implementing Phase 8 as a net-new module, the most efficient approach is to **extend the existing AgentHR models and routers** to close the gaps:

1. Add missing fields to `ComponentRegistry` (status lifecycle, version, mcp_config, parameters_schema)
2. Create a new `MCPServer` model and router for dedicated MCP server management
3. Add entitlement-type logic to the existing grant/request workflow
4. Implement semver versioning on top of existing snapshots
5. Add metrics, notifications, and background jobs as new services
6. Gradually refactor toward service/repository pattern as complexity warrants
