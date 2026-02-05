# Marketplace Gaps - UI & API Testing Plan (dev-browser)

**Goal:** Validate all 5 marketplace gap workstreams using dev-browser automation against the local Docker deployment (frontend at `localhost:3000`, backend at `localhost:8000`).

**Strategy:** The frontend UI does not yet have pages for the new backend features (status lifecycle, MCP servers, entitlements, versioning). Tests use a **hybrid approach**:
- **UI tests** for existing pages (login, component registry list, search/filter)
- **API tests via browser** for new backend endpoints (using `page.evaluate(fetch(...))`)

**Prerequisites:**
- Local Docker running: `docker compose up -d`
- dev-browser server started from `skills/dev-browser/`

---

## Journey 1: Authentication & Component Registry UI

**Purpose:** Verify login flow and component registry page loads with new fields visible.

### Script 1.1: Login and navigate to component registry

```typescript
import { connect, waitForPageLoad } from "@/client.js";

const client = await connect();
const page = await client.page("marketplace", { viewport: { width: 1440, height: 900 } });

// Navigate to login
await page.goto("http://localhost:3000/login");
await waitForPageLoad(page);
await page.screenshot({ path: "tmp/01-login-page.png" });

// Register a test user (or login if exists)
const registerResponse = await page.evaluate(async () => {
  const res = await fetch("http://localhost:8000/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "UI Tester", email: "uitest@test.com", password: "test1234" }),
  });
  return { status: res.status, data: await res.json() };
});
console.log("Register:", registerResponse.status);

// Login
await page.fill('input[type="email"]', "uitest@test.com");
await page.fill('input[type="password"]', "test1234");
await page.click('button[type="submit"]');
await waitForPageLoad(page);
await page.screenshot({ path: "tmp/02-after-login.png" });

console.log("Current URL:", page.url());
await client.disconnect();
```

**Verify:** Screenshot shows dashboard/home page after login.

### Script 1.2: Navigate to component registry and verify list

```typescript
import { connect, waitForPageLoad } from "@/client.js";

const client = await connect();
const page = await client.page("marketplace");

await page.goto("http://localhost:3000/component-registry");
await waitForPageLoad(page);
await page.waitForSelector('[class*="grid"]', { timeout: 5000 }).catch(() => {});
await page.screenshot({ path: "tmp/03-registry-list.png" });

// Check page content
const content = await page.textContent("body");
console.log("Has components:", content?.includes("skill") || content?.includes("tool"));
console.log("Page title area:", content?.substring(0, 200));

await client.disconnect();
```

**Verify:** Component registry page loads with 22+ components. Screenshot shows grid of component cards.

---

## Journey 2: Component Status Lifecycle (WS1)

**Purpose:** Test DRAFT -> PUBLISHED -> DEPRECATED flow via API, verify in UI.

### Script 2.1: Create draft, publish, deprecate via API

```typescript
import { connect, waitForPageLoad } from "@/client.js";

const client = await connect();
const page = await client.page("marketplace");

// Get auth token
const loginRes = await page.evaluate(async () => {
  const res = await fetch("http://localhost:8000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "uitest@test.com", password: "test1234" }),
  });
  return res.json();
});
const token = loginRes.access_token;
console.log("Token acquired:", !!token);

// Create DRAFT component
const createRes = await page.evaluate(async (t) => {
  const res = await fetch("http://localhost:8000/api/component-registry", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
    body: JSON.stringify({
      type: "skill",
      name: "Lifecycle Test Skill",
      description: "Testing status lifecycle",
      tags: ["test", "lifecycle"],
    }),
  });
  return res.json();
}, token);
console.log("Created:", createRes.id, "status:", createRes.status);
// Expected: status = "draft"

const componentId = createRes.id;

// Publish
const publishRes = await page.evaluate(async (args) => {
  const res = await fetch(`http://localhost:8000/api/component-registry/${args.id}/publish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${args.token}` },
  });
  return res.json();
}, { id: componentId, token });
console.log("After publish:", publishRes.status, "published_at:", publishRes.published_at);
// Expected: status = "published", published_at = non-null

// Deprecate
const deprecateRes = await page.evaluate(async (args) => {
  const res = await fetch(`http://localhost:8000/api/component-registry/${args.id}/deprecate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${args.token}` },
    body: JSON.stringify({ reason: "Replaced by v2" }),
  });
  return res.json();
}, { id: componentId, token });
console.log("After deprecate:", deprecateRes.status, "reason:", deprecateRes.deprecation_reason);
// Expected: status = "deprecated", deprecation_reason = "Replaced by v2"

await client.disconnect();
```

### Script 2.2: Verify status filter in list

```typescript
import { connect } from "@/client.js";

const client = await connect();
const page = await client.page("marketplace");

const token = await page.evaluate(async () => {
  const res = await fetch("http://localhost:8000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "uitest@test.com", password: "test1234" }),
  });
  return (await res.json()).access_token;
});

// Test status filters
for (const status of ["draft", "published", "deprecated"]) {
  const res = await page.evaluate(async (args) => {
    const r = await fetch(
      `http://localhost:8000/api/component-registry?status=${args.status}&limit=5`,
      { headers: { Authorization: `Bearer ${args.token}` } }
    );
    return r.json();
  }, { status, token });
  console.log(`Status=${status}: total=${res.total}`);
}

// Test default (no status) - should show published + own
const defaultRes = await page.evaluate(async (t) => {
  const r = await fetch("http://localhost:8000/api/component-registry?limit=50", {
    headers: { Authorization: `Bearer ${t}` },
  });
  return r.json();
}, token);
console.log("Default filter total:", defaultRes.total);

await client.disconnect();
```

**Verify:** `draft` returns at least 1, `published` returns 20+, `deprecated` returns at least 1. Default returns all published + user's drafts.

---

## Journey 3: MCP Server Registry (WS2)

**Purpose:** Test full MCP server CRUD and health check flow.

### Script 3.1: Register, list, health check, deactivate, delete

```typescript
import { connect } from "@/client.js";

const client = await connect();
const page = await client.page("marketplace");

const token = await page.evaluate(async () => {
  const res = await fetch("http://localhost:8000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "uitest@test.com", password: "test1234" }),
  });
  return (await res.json()).access_token;
});

// Register MCP server
const mcpRes = await page.evaluate(async (t) => {
  const res = await fetch("http://localhost:8000/api/mcp-servers", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
    body: JSON.stringify({
      name: "Test MCP Server",
      description: "A test MCP server for UI validation",
      server_url: "https://httpbin.org/get",
      health_check_url: "https://httpbin.org/status/200",
      capabilities: ["tools", "resources", "prompts"],
      auth_type: "api_key",
      auth_config: { api_key: "test-key-123" },
    }),
  });
  return res.json();
}, token);
console.log("Registered MCP:", mcpRes.id, "status:", mcpRes.status);
console.log("Auth configured:", mcpRes.auth_configured, "(should be true)");
console.log("Auth config exposed:", mcpRes.auth_config, "(should be undefined)");
// Expected: status=active, auth_configured=true, no auth_config in response

const serverId = mcpRes.id;

// List servers
const listRes = await page.evaluate(async (t) => {
  const res = await fetch("http://localhost:8000/api/mcp-servers", {
    headers: { Authorization: `Bearer ${t}` },
  });
  return res.json();
}, token);
console.log("List total:", listRes.total);
// Expected: total >= 1

// Health check
const healthRes = await page.evaluate(async (args) => {
  const res = await fetch(`http://localhost:8000/api/mcp-servers/${args.id}/health`, {
    headers: { Authorization: `Bearer ${args.token}` },
  });
  return res.json();
}, { id: serverId, token });
console.log("Health check:", healthRes.healthy, "status_code:", healthRes.status_code);
// Expected: healthy=true (httpbin returns 200)

// Get connection config
const connRes = await page.evaluate(async (args) => {
  const res = await fetch(`http://localhost:8000/api/mcp-servers/${args.id}/connection`, {
    headers: { Authorization: `Bearer ${args.token}` },
  });
  return res.json();
}, { id: serverId, token });
console.log("Connection:", connRes.server_url, "caps:", connRes.capabilities);
// Expected: url and capabilities match registration

// Deactivate
const deactivateRes = await page.evaluate(async (args) => {
  const res = await fetch(`http://localhost:8000/api/mcp-servers/${args.id}/deactivate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${args.token}` },
  });
  return res.json();
}, { id: serverId, token });
console.log("After deactivate:", deactivateRes.status);
// Expected: status=inactive

// Delete
const deleteRes = await page.evaluate(async (args) => {
  const res = await fetch(`http://localhost:8000/api/mcp-servers/${args.id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${args.token}` },
  });
  return { status: res.status };
}, { id: serverId, token });
console.log("Delete status:", deleteRes.status);
// Expected: 204

await client.disconnect();
```

**Verify:** Full CRUD cycle works, health check returns real result from httpbin, auth_config is never exposed.

---

## Journey 4: Entitlement-Type Logic (WS3)

**Purpose:** Test OPEN (auto-approve), REQUEST_REQUIRED (pending), and RESTRICTED (403) flows.

### Script 4.1: Test all three entitlement types

```typescript
import { connect } from "@/client.js";

const client = await connect();
const page = await client.page("marketplace");

// Register two users
const register = async (name, email) => {
  await page.evaluate(async (args) => {
    await fetch("http://localhost:8000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: args.name, email: args.email, password: "test1234" }),
    });
  }, { name, email });
};
await register("Owner User", "entitle-owner@test.com");
await register("Requester User", "entitle-req@test.com");

const getToken = async (email) => {
  return page.evaluate(async (e) => {
    const res = await fetch("http://localhost:8000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: e, password: "test1234" }),
    });
    return (await res.json()).access_token;
  }, email);
};

const ownerToken = await getToken("entitle-owner@test.com");
const reqToken = await getToken("entitle-req@test.com");

// Owner creates an agent for the requester to use
const agent = await page.evaluate(async (t) => {
  const res = await fetch("http://localhost:8000/api/agents", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
    body: JSON.stringify({ name: "Test Agent", type: "hr_assistant", description: "Test" }),
  });
  return res.json();
}, reqToken);
const agentId = agent.id;

// Owner creates 3 components with different entitlements
const createComp = async (name, entType) => {
  return page.evaluate(async (args) => {
    const res = await fetch("http://localhost:8000/api/component-registry", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${args.token}` },
      body: JSON.stringify({
        type: "skill", name: args.name, description: "Test " + args.entType,
        entitlement_type: args.entType,
      }),
    });
    const data = await res.json();
    // Publish it
    await fetch(`http://localhost:8000/api/component-registry/${data.id}/publish`, {
      method: "POST", headers: { Authorization: `Bearer ${args.token}` },
    });
    return data;
  }, { name, entType, token: ownerToken });
};

const openComp = await createComp("Open Skill", "open");
const reqComp = await createComp("Request Required Skill", "request_required");
const restrictedComp = await createComp("Restricted Skill", "restricted");

console.log("Components created:", openComp.id, reqComp.id, restrictedComp.id);

// Test OPEN: auto-approve
const openReq = await page.evaluate(async (args) => {
  const res = await fetch(`http://localhost:8000/api/agents/${args.agentId}/access-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${args.token}` },
    body: JSON.stringify({ component_id: args.compId, requested_level: "viewer" }),
  });
  return res.json();
}, { agentId, compId: openComp.id, token: reqToken });
console.log("OPEN request status:", openReq.status);
// Expected: "approved" (auto-approved)

// Test REQUEST_REQUIRED: pending
const reqReq = await page.evaluate(async (args) => {
  const res = await fetch(`http://localhost:8000/api/agents/${args.agentId}/access-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${args.token}` },
    body: JSON.stringify({ component_id: args.compId, requested_level: "viewer" }),
  });
  return res.json();
}, { agentId, compId: reqComp.id, token: reqToken });
console.log("REQUEST_REQUIRED status:", reqReq.status);
// Expected: "pending"

// Test cancel
const cancelRes = await page.evaluate(async (args) => {
  const res = await fetch(`http://localhost:8000/api/access-requests/${args.reqId}/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${args.token}` },
  });
  return res.json();
}, { reqId: reqReq.id, token: reqToken });
console.log("After cancel:", cancelRes.status);
// Expected: "cancelled"

// Test RESTRICTED: 403
const restrictedReq = await page.evaluate(async (args) => {
  const res = await fetch(`http://localhost:8000/api/agents/${args.agentId}/access-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${args.token}` },
    body: JSON.stringify({ component_id: args.compId, requested_level: "viewer" }),
  });
  return { status: res.status, data: await res.json() };
}, { agentId, compId: restrictedComp.id, token: reqToken });
console.log("RESTRICTED:", restrictedReq.status, restrictedReq.data.detail);
// Expected: 403 "This component requires direct owner invitation..."

await client.disconnect();
```

**Verify:** OPEN -> auto-approved, REQUEST_REQUIRED -> pending, cancel works, RESTRICTED -> 403.

---

## Journey 5: Advanced Search & Discovery (WS4)

**Purpose:** Test faceted search, multi-type/tag filters, sorting, and discovery endpoints.

### Script 5.1: Faceted search via API

```typescript
import { connect } from "@/client.js";

const client = await connect();
const page = await client.page("marketplace");

const token = await page.evaluate(async () => {
  const res = await fetch("http://localhost:8000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "uitest@test.com", password: "test1234" }),
  });
  return (await res.json()).access_token;
});

const search = async (params) => {
  return page.evaluate(async (args) => {
    const qs = new URLSearchParams(args.params).toString();
    const res = await fetch(`http://localhost:8000/api/component-registry?${qs}`, {
      headers: { Authorization: `Bearer ${args.token}` },
    });
    return res.json();
  }, { params, token });
};

// Multi-type filter
const multiType = await search({ types: "skill,tool", limit: "50" });
console.log("types=skill,tool:", multiType.total);

// Tag filter
const tagged = await search({ tag: "test", limit: "50" });
console.log("tag=test:", tagged.total);

// Search by name
const searched = await search({ search: "Parser", limit: "50" });
console.log("search=Parser:", searched.total);

// Sort by name ascending
const sorted = await search({ sort_by: "name", sort_order: "asc", limit: "5" });
console.log("Sorted asc, first:", sorted.data[0]?.name);

// Entitlement filter
const openOnly = await search({ entitlement_type: "open", limit: "50" });
console.log("entitlement_type=open:", openOnly.total);

// Popular endpoint
const popular = await page.evaluate(async (t) => {
  const res = await fetch("http://localhost:8000/api/component-registry/popular?limit=5", {
    headers: { Authorization: `Bearer ${t}` },
  });
  return res.json();
}, token);
console.log("Popular:", popular.total);

// Recent endpoint
const recent = await page.evaluate(async (t) => {
  const res = await fetch("http://localhost:8000/api/component-registry/recent?limit=5", {
    headers: { Authorization: `Bearer ${t}` },
  });
  return res.json();
}, token);
console.log("Recent:", recent.total, "first:", recent.data[0]?.name);

// Mine endpoint
const mine = await page.evaluate(async (t) => {
  const res = await fetch("http://localhost:8000/api/component-registry/mine", {
    headers: { Authorization: `Bearer ${t}` },
  });
  return res.json();
}, token);
console.log("Mine:", mine.total);

await client.disconnect();
```

### Script 5.2: Verify search in UI

```typescript
import { connect, waitForPageLoad } from "@/client.js";

const client = await connect();
const page = await client.page("marketplace");

await page.goto("http://localhost:3000/component-registry");
await waitForPageLoad(page);

// Use the search input
const searchInput = await page.waitForSelector('input[placeholder*="earch"]', { timeout: 5000 });
if (searchInput) {
  await searchInput.fill("Parser");
  await page.waitForTimeout(500); // Wait for debounce
  await page.screenshot({ path: "tmp/04-search-parser.png" });
  const content = await page.textContent("body");
  console.log("Search results contain 'Parser':", content?.includes("Parser"));
}

// Test type filter if available in UI
const typeFilter = await page.$('select, [role="listbox"], button:has-text("Type")');
if (typeFilter) {
  console.log("Type filter found in UI");
} else {
  console.log("Type filter not yet in UI (backend-only)");
}

await client.disconnect();
```

**Verify:** All search filters return correct results. UI search works for name matching.

---

## Journey 6: Semver Versioning (WS5)

**Purpose:** Test version creation, listing, changelog, and validation.

### Script 6.1: Full versioning lifecycle

```typescript
import { connect } from "@/client.js";

const client = await connect();
const page = await client.page("marketplace");

const token = await page.evaluate(async () => {
  const res = await fetch("http://localhost:8000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "uitest@test.com", password: "test1234" }),
  });
  return (await res.json()).access_token;
});

// Create and publish a component
const comp = await page.evaluate(async (t) => {
  const res = await fetch("http://localhost:8000/api/component-registry", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
    body: JSON.stringify({
      type: "tool", name: "Versioned Tool", description: "For version testing",
    }),
  });
  const data = await res.json();
  await fetch(`http://localhost:8000/api/component-registry/${data.id}/publish`, {
    method: "POST", headers: { Authorization: `Bearer ${t}` },
  });
  return data;
}, token);
const compId = comp.id;
console.log("Component:", compId, "version:", comp.version || "1.0.0");

// Create version 1.1.0
const v1 = await page.evaluate(async (args) => {
  const res = await fetch(`http://localhost:8000/api/component-registry/${args.id}/versions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${args.token}` },
    body: JSON.stringify({ version: "1.1.0", changelog: "Added input validation" }),
  });
  return res.json();
}, { id: compId, token });
console.log("v1.1.0 created:", v1.version, "changelog:", v1.changelog);

// Create version 2.0.0
const v2 = await page.evaluate(async (args) => {
  const res = await fetch(`http://localhost:8000/api/component-registry/${args.id}/versions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${args.token}` },
    body: JSON.stringify({ version: "2.0.0", changelog: "Breaking: new API interface" }),
  });
  return res.json();
}, { id: compId, token });
console.log("v2.0.0 created:", v2.version);

// List versions
const versions = await page.evaluate(async (args) => {
  const res = await fetch(`http://localhost:8000/api/component-registry/${args.id}/versions`, {
    headers: { Authorization: `Bearer ${args.token}` },
  });
  return res.json();
}, { id: compId, token });
console.log("Versions:", versions.total, versions.data.map(v => v.version));
// Expected: ["2.0.0", "1.1.0"]

// Get latest
const latest = await page.evaluate(async (args) => {
  const res = await fetch(`http://localhost:8000/api/component-registry/${args.id}/versions/latest`, {
    headers: { Authorization: `Bearer ${args.token}` },
  });
  return res.json();
}, { id: compId, token });
console.log("Latest:", latest.version);
// Expected: "2.0.0"

// Get specific version
const specific = await page.evaluate(async (args) => {
  const res = await fetch(`http://localhost:8000/api/component-registry/${args.id}/versions/1.1.0`, {
    headers: { Authorization: `Bearer ${args.token}` },
  });
  return res.json();
}, { id: compId, token });
console.log("v1.1.0 snapshot keys:", Object.keys(specific.snapshot || {}));

// Get changelog
const changelog = await page.evaluate(async (args) => {
  const res = await fetch(`http://localhost:8000/api/component-registry/${args.id}/changelog`, {
    headers: { Authorization: `Bearer ${args.token}` },
  });
  return res.json();
}, { id: compId, token });
console.log("Changelog entries:", changelog.entries.length, changelog.entries.map(e => `${e.version}: ${e.changelog}`));

// Reject lower version
const badVersion = await page.evaluate(async (args) => {
  const res = await fetch(`http://localhost:8000/api/component-registry/${args.id}/versions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${args.token}` },
    body: JSON.stringify({ version: "1.0.0" }),
  });
  return { status: res.status, data: await res.json() };
}, { id: compId, token });
console.log("Reject lower version:", badVersion.status, badVersion.data.detail);
// Expected: 400 "must be greater than current 2.0.0"

// Reject invalid semver
const badSemver = await page.evaluate(async (args) => {
  const res = await fetch(`http://localhost:8000/api/component-registry/${args.id}/versions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${args.token}` },
    body: JSON.stringify({ version: "not-a-version" }),
  });
  return { status: res.status, data: await res.json() };
}, { id: compId, token });
console.log("Reject bad semver:", badSemver.status);
// Expected: 422

await client.disconnect();
```

**Verify:** Version creation, listing, changelog, snapshot, and validation all work correctly.

---

## Journey 7: Grant Extensions & Access Checks (WS3 continued)

### Script 7.1: Extend grant and check access

```typescript
import { connect } from "@/client.js";

const client = await connect();
const page = await client.page("marketplace");

const token = await page.evaluate(async () => {
  const res = await fetch("http://localhost:8000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "uitest@test.com", password: "test1234" }),
  });
  return (await res.json()).access_token;
});

// Get a component we own
const mine = await page.evaluate(async (t) => {
  const res = await fetch("http://localhost:8000/api/component-registry/mine?limit=1", {
    headers: { Authorization: `Bearer ${t}` },
  });
  return res.json();
}, token);

if (mine.total > 0) {
  const compId = mine.data[0].id;
  console.log("Testing with component:", compId);

  // Create an agent to grant access to
  const agent = await page.evaluate(async (t) => {
    const res = await fetch("http://localhost:8000/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify({ name: "Grant Test Agent", type: "hr_assistant", description: "test" }),
    });
    return res.json();
  }, token);

  // Create a grant
  const grant = await page.evaluate(async (args) => {
    const res = await fetch(`http://localhost:8000/api/components/${args.compId}/grants`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${args.token}` },
      body: JSON.stringify({
        component_id: args.compId, agent_id: args.agentId, access_level: "viewer",
      }),
    });
    return res.json();
  }, { compId, agentId: agent.id, token });
  console.log("Grant created for agent:", agent.id);

  // Check access
  const check = await page.evaluate(async (args) => {
    const res = await fetch(
      `http://localhost:8000/api/components/${args.compId}/grants/check?agent_id=${args.agentId}`,
      { headers: { Authorization: `Bearer ${args.token}` } }
    );
    return res.json();
  }, { compId, agentId: agent.id, token });
  console.log("Access check:", check.has_access, "level:", check.access_level);
  // Expected: has_access=true, access_level=viewer

  // Extend grant
  const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const extended = await page.evaluate(async (args) => {
    const res = await fetch(
      `http://localhost:8000/api/components/${args.compId}/grants/${args.agentId}/extend`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${args.token}` },
        body: JSON.stringify({ new_expires_at: args.futureDate }),
      }
    );
    return res.json();
  }, { compId, agentId: agent.id, token, futureDate });
  console.log("Extended expires_at:", extended.expires_at);
  // Expected: expires_at set to future date
}

await client.disconnect();
```

---

## Journey 8: Final Screenshot Walkthrough

### Script 8.1: Take screenshots of all key pages

```typescript
import { connect, waitForPageLoad } from "@/client.js";

const client = await connect();
const page = await client.page("marketplace");

// Component registry list
await page.goto("http://localhost:3000/component-registry");
await waitForPageLoad(page);
await page.waitForTimeout(1000);
await page.screenshot({ path: "tmp/final-01-registry.png", fullPage: true });

// API docs (shows all new endpoints)
await page.goto("http://localhost:3000/api-docs");
await waitForPageLoad(page);
await page.waitForTimeout(2000);
await page.screenshot({ path: "tmp/final-02-api-docs.png", fullPage: true });

console.log("Screenshots saved to tmp/");
await client.disconnect();
```

---

## Expected Results Summary

| Journey | Test | Expected |
|---------|------|----------|
| 1 | Login + registry page | Page loads, 22+ components |
| 2 | Status lifecycle | draft -> published -> deprecated |
| 3 | MCP servers | Full CRUD, health check, auth redaction |
| 4 | Entitlements | OPEN=auto-approve, REQ=pending, RESTRICTED=403 |
| 5 | Faceted search | Multi-type, multi-tag, sort, popular/recent/mine |
| 6 | Versioning | Create, list, changelog, validation |
| 7 | Grants | Check access, extend expiration |
| 8 | Screenshots | Visual confirmation of all pages |
