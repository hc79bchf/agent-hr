# Memory and Agent Enhancements Design

**Date:** 2026-01-27
**Status:** Ready for implementation

## Overview

Three enhancements to improve memory handling and agent metadata extraction in Agent-HR:

1. **Memory file filtering** - Only load markdown files as long-term memory, exclude `.py` files and irrelevant `.txt` files
2. **Procedural memory injection** - Enable injecting procedural memory after agent deployment
3. **Agent metadata extraction** - Parse `agent.py` for agent name, description, and model instead of example folders

## Enhancement 1: Memory File Filtering

### Problem

Memory parsing currently includes:
- `.py` files from `/memory/` folder (helper code, not actual memories)
- Irrelevant `.txt` files like `LICENSE.txt`, `README.txt`

### Solution

Update `backend/app/services/parser.py` with two filters:

**1. Blocklist for `.txt` files:**

```python
EXCLUDED_TXT_FILES = {
    'license.txt', 'readme.txt', 'requirements.txt',
    'changelog.txt', 'changes.txt', 'authors.txt',
    'contributors.txt', 'notice.txt', 'copying.txt'
}
```

**2. Exclude code files from memory folder:**

Remove the logic that categorizes `.py`, `.js`, etc. in `/memory/` folder as memory components. Only markdown (`.md`) and non-blocklisted `.txt` files should become memory components.

### Files to Modify

- `backend/app/services/parser.py`

### Behavior After Change

| File | Before | After |
|------|--------|-------|
| `/memory/helper.py` | Memory component | **Excluded** |
| `/memory/context.md` | Memory component | Memory component ✓ |
| `/memory/notes.txt` | Memory component | Memory component ✓ |
| `LICENSE.txt` | Memory component | **Excluded** |
| `README.txt` | Memory component | **Excluded** |

---

## Enhancement 2: Procedural Memory Injection

### Problem

After agent deployment, users can only inject context into working memory (session-scoped). There's no way to add procedural memory (how-to knowledge) at runtime.

### Solution

Add an "Inject Procedural" button to the Procedural Memory section that creates a new procedural memory component.

### UI Changes

1. Add "Inject" button in `MemorySection` header when `type === 'procedural'`
2. Clicking opens `AddMemoryModal` with `memory_type` pre-set to `'procedural'`
3. User enters name + content (markdown)
4. Save creates new version with procedural memory component

### Data Flow

```
User clicks "Inject Procedural"
  → AddMemoryModal opens (type pre-selected)
  → User enters name + content
  → POST /api/agents/{id}/memories (memory_type: 'procedural')
  → New version created
  → UI refreshes
```

### Files to Modify

- `frontend/src/components/memory/MemorySection.tsx` - Add inject button prop and UI
- `frontend/src/pages/AgentDetail.tsx` - Wire handler with preset type

### Component Changes

```typescript
// MemorySection.tsx - Add new prop
interface MemorySectionProps {
  // ... existing props
  onInject?: () => void;  // New: callback for inject button
}

// Show inject button for procedural type
{type === 'procedural' && onInject && (
  <button onClick={onInject}>+ Inject</button>
)}
```

---

## Enhancement 3: Agent Metadata from `agent.py`

### Problem

The Agents tab captures files from `/agents/` folder but:
- Picks up example folders instead of actual agent definitions
- Doesn't extract meaningful metadata from `agent.py`

### Solution

Enhance `parser.py` to detect and parse `agent.py` files, extracting metadata from Python code.

### Parsing Strategy

Look for common patterns in agent.py:

```python
# 1. Module docstring → description
"""My Agent - A helpful assistant for X tasks."""

# 2. Variable assignments
AGENT_NAME = "My Agent"
MODEL = "claude-sonnet-4-20250514"
DESCRIPTION = "Handles customer inquiries"

# 3. Config dict (fallback)
agent_config = {
    "name": "My Agent",
    "model": "claude-sonnet-4-20250514"
}
```

### Extraction Priority

1. Module docstring → `description`
2. `AGENT_NAME`, `NAME`, or `name` variable → `name`
3. `MODEL` or `model` variable → `model` (stored in config)
4. Fallback to filename if no name found

### Filtering Rules

- **Include:** `agent.py`, `*_agent.py` in `/agents/` folder
- **Exclude:** `/agents/examples/`, `/agents/example/` subfolders
- **Exclude:** Test files (`test_*.py`, `*_test.py`)

### Files to Modify

- `backend/app/services/parser.py`:
  - Add `parse_agent_script()` method
  - Update `parse_uploaded_files()` to use it for `.py` files in `/agents/`

### New Method

```python
def parse_agent_script(self, content: str, filename: str) -> dict:
    """Parse an agent.py file for metadata.

    Extracts:
    - name: from AGENT_NAME, NAME variables or filename
    - description: from module docstring
    - model: from MODEL variable
    """
    # Implementation extracts via regex/AST
```

---

## Implementation Order

1. **Memory file filtering** (backend only, low risk)
2. **Agent metadata parsing** (backend only, isolated change)
3. **Procedural memory injection** (frontend, builds on existing modal)

## Testing

### Memory Filtering
- Upload zip with `.py` in memory folder → should not appear as memory
- Upload zip with `LICENSE.txt` → should not appear as memory
- Upload zip with valid `.md` and `.txt` → should appear as memory

### Procedural Injection
- Deploy agent → Memory tab → Procedural section → Click "Inject"
- Enter name/content → Save → New memory appears in list

### Agent Metadata
- Upload zip with `agents/agent.py` containing docstring and variables
- Agents tab should show extracted name/description, not filename
