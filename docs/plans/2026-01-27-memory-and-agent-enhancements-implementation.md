# Memory and Agent Enhancements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve memory file filtering, enable procedural memory injection, and extract agent metadata from `agent.py` files.

**Architecture:** Three independent enhancements to the parser service and frontend memory components. Each can be implemented and tested in isolation.

**Tech Stack:** Python (FastAPI backend), TypeScript/React (frontend), pytest, vitest

---

## Phase 1: Memory File Filtering (Tasks 1-4)

### Task 1: Add blocklist constant and helper method

**Files:**
- Modify: `backend/app/services/parser.py:1-12`

**Step 1: Add blocklist constant after imports**

```python
"""Config parser service for parsing Claude Code configuration files."""

import json
import re
from pathlib import Path


# Files to exclude from memory parsing
EXCLUDED_TXT_FILES = {
    'license.txt', 'readme.txt', 'requirements.txt',
    'changelog.txt', 'changes.txt', 'authors.txt',
    'contributors.txt', 'notice.txt', 'copying.txt',
    'manifest.txt', 'version.txt', 'todo.txt',
}


class ConfigParser:
```

**Step 2: Verify syntax**

Run: `cd /Users/hongfeicao/Desktop/startup-repo/ergo.ai/.worktrees/agent-hr/agent-hr/backend && python -c "from app.services.parser import EXCLUDED_TXT_FILES; print(len(EXCLUDED_TXT_FILES))"`
Expected: `12`

**Step 3: Commit**

```bash
git add backend/app/services/parser.py
git commit -m "feat(parser): add blocklist for excluded txt files"
```

---

### Task 2: Write tests for memory filtering

**Files:**
- Modify: `backend/tests/test_parser.py`

**Step 1: Add new test cases at end of file**

```python
def test_parse_uploaded_files_excludes_license_txt():
    """Test that LICENSE.txt is excluded from memory."""
    parser = ConfigParser()
    files = {
        "LICENSE.txt": "MIT License\n\nCopyright...",
        "memory/context.md": "# Context\n\nImportant context.",
    }
    result = parser.parse_uploaded_files(files)

    memory_names = [m["name"] for m in result["memory"]]
    assert "LICENSE.txt" not in memory_names
    assert "context.md" in memory_names


def test_parse_uploaded_files_excludes_readme_txt():
    """Test that README.txt is excluded from memory."""
    parser = ConfigParser()
    files = {
        "README.txt": "Read me first...",
        "notes.txt": "Important notes here.",
    }
    result = parser.parse_uploaded_files(files)

    memory_names = [m["name"] for m in result["memory"]]
    assert "README.txt" not in memory_names
    assert "notes.txt" in memory_names


def test_parse_uploaded_files_excludes_py_from_memory_folder():
    """Test that .py files in memory folder are excluded."""
    parser = ConfigParser()
    files = {
        "memory/helper.py": "def helper(): pass",
        "memory/context.md": "# Context\n\nThis is context.",
        "memories/loader.py": "class Loader: pass",
        "memories/knowledge.txt": "Knowledge content",
    }
    result = parser.parse_uploaded_files(files)

    memory_names = [m["name"] for m in result["memory"]]
    assert "helper.py" not in memory_names
    assert "loader.py" not in memory_names
    assert "context.md" in memory_names
    assert "knowledge.txt" in memory_names


def test_parse_uploaded_files_allows_valid_memory_txt():
    """Test that non-blocklisted .txt files are included as memory."""
    parser = ConfigParser()
    files = {
        "memory/guidelines.txt": "Follow these guidelines...",
        "docs/notes.txt": "Project notes here",
    }
    result = parser.parse_uploaded_files(files)

    memory_names = [m["name"] for m in result["memory"]]
    assert "guidelines.txt" in memory_names
    assert "notes.txt" in memory_names
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/hongfeicao/Desktop/startup-repo/ergo.ai/.worktrees/agent-hr/agent-hr/backend && python -m pytest tests/test_parser.py::test_parse_uploaded_files_excludes_license_txt tests/test_parser.py::test_parse_uploaded_files_excludes_readme_txt tests/test_parser.py::test_parse_uploaded_files_excludes_py_from_memory_folder -v`
Expected: FAIL (LICENSE.txt and .py files are currently included)

**Step 3: Commit test file**

```bash
git add backend/tests/test_parser.py
git commit -m "test(parser): add tests for memory file filtering"
```

---

### Task 3: Implement memory filtering logic

**Files:**
- Modify: `backend/app/services/parser.py:217-223` and `backend/app/services/parser.py:242-246`

**Step 1: Update .md/.txt parsing block (lines 217-223)**

Replace:
```python
            # Other markdown files as memory (except SKILL.md in skills folders - already handled)
            elif path.suffix in [".md", ".txt"]:
                # Skip SKILL.md files in skills folders - they're already parsed as skills
                if path.name.upper() == "SKILL.MD" and "/skills/" in lower_path:
                    continue
                memory = self.parse_memory(content, path.name)
                memory["source_path"] = filepath
                result["memory"].append(memory)
```

With:
```python
            # Other markdown files as memory (except SKILL.md in skills folders - already handled)
            elif path.suffix in [".md", ".txt"]:
                # Skip SKILL.md files in skills folders - they're already parsed as skills
                if path.name.upper() == "SKILL.MD" and "/skills/" in lower_path:
                    continue
                # Skip blocklisted .txt files
                if path.suffix == ".txt" and path.name.lower() in EXCLUDED_TXT_FILES:
                    continue
                memory = self.parse_memory(content, path.name)
                memory["source_path"] = filepath
                result["memory"].append(memory)
```

**Step 2: Remove .py files from memory folder (lines 242-246)**

Replace:
```python
                # Files in memory/ folder → memory
                elif "/memory/" in lower_path or "\\memory\\" in lower_path or "/memories/" in lower_path:
                    memory = self.parse_code_file(content, path.name, path.suffix)
                    memory["source_path"] = filepath
                    result["memory"].append(memory)
```

With:
```python
                # Files in memory/ folder → skip code files (only markdown/txt handled above)
                elif "/memory/" in lower_path or "\\memory\\" in lower_path or "/memories/" in lower_path:
                    # Skip code files in memory folder - they're helpers, not actual memories
                    continue
```

**Step 3: Run tests to verify they pass**

Run: `cd /Users/hongfeicao/Desktop/startup-repo/ergo.ai/.worktrees/agent-hr/agent-hr/backend && python -m pytest tests/test_parser.py -v`
Expected: All tests PASS

**Step 4: Commit**

```bash
git add backend/app/services/parser.py
git commit -m "feat(parser): filter out .py files and blocklisted .txt from memory"
```

---

### Task 4: Verify all existing tests still pass

**Step 1: Run full test suite**

Run: `cd /Users/hongfeicao/Desktop/startup-repo/ergo.ai/.worktrees/agent-hr/agent-hr/backend && python -m pytest tests/test_parser.py -v`
Expected: All tests PASS

**Step 2: No commit needed if all pass**

---

## Phase 2: Procedural Memory Injection (Tasks 5-8)

### Task 5: Add onInject prop to MemorySection

**Files:**
- Modify: `frontend/src/components/memory/MemorySection.tsx:10-25`

**Step 1: Update MemorySectionProps interface**

Replace:
```typescript
interface MemorySectionProps {
  /** Memory type for this section */
  type: MemoryType;
  /** Memory components to display */
  memories: Component[];
  /** Pending suggestions count (for long_term only) */
  pendingCount?: number;
  /** Callback when edit is clicked */
  onEdit?: (memory: Component) => void;
  /** Callback when delete is clicked */
  onDelete?: (memory: Component) => void;
  /** Callback when pending badge is clicked */
  onViewPending?: () => void;
  /** Whether actions are disabled */
  disabled?: boolean;
}
```

With:
```typescript
interface MemorySectionProps {
  /** Memory type for this section */
  type: MemoryType;
  /** Memory components to display */
  memories: Component[];
  /** Pending suggestions count (for long_term only) */
  pendingCount?: number;
  /** Callback when edit is clicked */
  onEdit?: (memory: Component) => void;
  /** Callback when delete is clicked */
  onDelete?: (memory: Component) => void;
  /** Callback when pending badge is clicked */
  onViewPending?: () => void;
  /** Callback when inject is clicked (for procedural memory) */
  onInject?: () => void;
  /** Whether actions are disabled */
  disabled?: boolean;
}
```

**Step 2: Update function signature (line 125-133)**

Replace:
```typescript
export function MemorySection({
  type,
  memories,
  pendingCount = 0,
  onEdit,
  onDelete,
  onViewPending,
  disabled,
}: MemorySectionProps) {
```

With:
```typescript
export function MemorySection({
  type,
  memories,
  pendingCount = 0,
  onEdit,
  onDelete,
  onViewPending,
  onInject,
  disabled,
}: MemorySectionProps) {
```

**Step 3: Verify build**

Run: `cd /Users/hongfeicao/Desktop/startup-repo/ergo.ai/.worktrees/agent-hr/agent-hr/frontend && npm run build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add frontend/src/components/memory/MemorySection.tsx
git commit -m "feat(memory): add onInject prop to MemorySection"
```

---

### Task 6: Add inject button UI to MemorySection

**Files:**
- Modify: `frontend/src/components/memory/MemorySection.tsx:139-162`

**Step 1: Update section header to include inject button**

Replace the section header block (lines 139-162):
```typescript
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium text-gray-900">{info.label}</h4>
          <p className="text-xs text-gray-500">{info.description}</p>
        </div>

        {/* Pending suggestions badge for long-term memory */}
        {type === 'long_term' && pendingCount > 0 && (
          <button
            onClick={onViewPending}
            className="inline-flex items-center px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 rounded-full hover:bg-amber-100"
          >
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                clipRule="evenodd"
              />
            </svg>
            {pendingCount} pending
          </button>
        )}
      </div>
```

With:
```typescript
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium text-gray-900">{info.label}</h4>
          <p className="text-xs text-gray-500">{info.description}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Inject button for procedural memory */}
          {type === 'procedural' && onInject && (
            <button
              onClick={onInject}
              disabled={disabled}
              className="inline-flex items-center px-2 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 rounded hover:bg-indigo-100 disabled:opacity-50"
            >
              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Add
            </button>
          )}

          {/* Pending suggestions badge for long-term memory */}
          {type === 'long_term' && pendingCount > 0 && (
            <button
              onClick={onViewPending}
              className="inline-flex items-center px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 rounded-full hover:bg-amber-100"
            >
              <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                  clipRule="evenodd"
                />
              </svg>
              {pendingCount} pending
            </button>
          )}
        </div>
      </div>
```

**Step 2: Verify build**

Run: `cd /Users/hongfeicao/Desktop/startup-repo/ergo.ai/.worktrees/agent-hr/agent-hr/frontend && npm run build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add frontend/src/components/memory/MemorySection.tsx
git commit -m "feat(memory): add inject button UI for procedural memory"
```

---

### Task 7: Add defaultMemoryType prop to AddMemoryModal

**Files:**
- Modify: `frontend/src/components/memory/AddMemoryModal.tsx:18-29` and `frontend/src/components/memory/AddMemoryModal.tsx:51-64`

**Step 1: Add defaultMemoryType to props interface**

Replace:
```typescript
interface AddMemoryModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Agent ID to add memory to */
  agentId: string;
  /** Optional existing memory for edit mode */
  existingMemory?: Component | null;
  /** Callback when memory is saved */
  onSuccess?: () => void;
}
```

With:
```typescript
interface AddMemoryModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Agent ID to add memory to */
  agentId: string;
  /** Optional existing memory for edit mode */
  existingMemory?: Component | null;
  /** Default memory type for new memories */
  defaultMemoryType?: MemoryType;
  /** Callback when memory is saved */
  onSuccess?: () => void;
}
```

**Step 2: Update function signature and useEffect**

Replace function signature:
```typescript
export function AddMemoryModal({
  isOpen,
  onClose,
  agentId,
  existingMemory,
  onSuccess,
}: AddMemoryModalProps) {
```

With:
```typescript
export function AddMemoryModal({
  isOpen,
  onClose,
  agentId,
  existingMemory,
  defaultMemoryType = 'long_term',
  onSuccess,
}: AddMemoryModalProps) {
```

**Step 3: Update useEffect to use defaultMemoryType (lines 51-64)**

Replace:
```typescript
  // Reset form when modal opens/closes or memory changes
  useEffect(() => {
    if (isOpen) {
      if (existingMemory) {
        setName(existingMemory.name);
        setContent(existingMemory.content || '');
        setMemoryType((existingMemory.memory_type as MemoryType) || 'long_term');
      } else {
        setName('');
        setContent('');
        setMemoryType('long_term');
      }
      setError(null);
    }
  }, [isOpen, existingMemory]);
```

With:
```typescript
  // Reset form when modal opens/closes or memory changes
  useEffect(() => {
    if (isOpen) {
      if (existingMemory) {
        setName(existingMemory.name);
        setContent(existingMemory.content || '');
        setMemoryType((existingMemory.memory_type as MemoryType) || 'long_term');
      } else {
        setName('');
        setContent('');
        setMemoryType(defaultMemoryType);
      }
      setError(null);
    }
  }, [isOpen, existingMemory, defaultMemoryType]);
```

**Step 4: Verify build**

Run: `cd /Users/hongfeicao/Desktop/startup-repo/ergo.ai/.worktrees/agent-hr/agent-hr/frontend && npm run build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add frontend/src/components/memory/AddMemoryModal.tsx
git commit -m "feat(memory): add defaultMemoryType prop to AddMemoryModal"
```

---

### Task 8: Wire up procedural inject in AgentDetail

**Files:**
- Modify: `frontend/src/pages/AgentDetail.tsx`

**Step 1: Add state for default memory type (after line 75 approximately, near other state declarations)**

Add after the editingMemory state:
```typescript
  const [defaultMemoryType, setDefaultMemoryType] = useState<MemoryType>('long_term');
```

**Step 2: Add import for MemoryType at top of file**

Update the import from types/memory:
```typescript
import type { MemoryType } from '../types/memory';
```

**Step 3: Create handler for procedural inject (after handleAddMemory around line 308)**

Add after handleAddMemory:
```typescript
  // Handle add procedural memory
  const handleAddProceduralMemory = useCallback(() => {
    setEditingMemory(null);
    setDefaultMemoryType('procedural');
    setIsMemoryModalOpen(true);
  }, []);

  // Update handleAddMemory to reset defaultMemoryType
  const handleAddMemory = useCallback(() => {
    setEditingMemory(null);
    setDefaultMemoryType('long_term');
    setIsMemoryModalOpen(true);
  }, []);
```

Note: This replaces the existing handleAddMemory.

**Step 4: Pass onInject to procedural MemorySection (around line 1145)**

Find:
```typescript
                    {/* Procedural Memory */}
                    <MemorySection
                      type="procedural"
                      memories={(memories || []).filter(
                        (m) => m.memory_type === 'procedural'
                      )}
                      onEdit={handleEditMemory}
                      onDelete={handleDeleteMemoryClick}
```

Replace with:
```typescript
                    {/* Procedural Memory */}
                    <MemorySection
                      type="procedural"
                      memories={(memories || []).filter(
                        (m) => m.memory_type === 'procedural'
                      )}
                      onEdit={handleEditMemory}
                      onDelete={handleDeleteMemoryClick}
                      onInject={handleAddProceduralMemory}
```

**Step 5: Pass defaultMemoryType to AddMemoryModal (around line 1378)**

Find:
```typescript
        <AddMemoryModal
          isOpen={isMemoryModalOpen}
          onClose={handleMemoryModalClose}
```

Add the defaultMemoryType prop:
```typescript
        <AddMemoryModal
          isOpen={isMemoryModalOpen}
          onClose={handleMemoryModalClose}
          defaultMemoryType={defaultMemoryType}
```

**Step 6: Verify build**

Run: `cd /Users/hongfeicao/Desktop/startup-repo/ergo.ai/.worktrees/agent-hr/agent-hr/frontend && npm run build`
Expected: Build succeeds

**Step 7: Commit**

```bash
git add frontend/src/pages/AgentDetail.tsx
git commit -m "feat(agent): wire up procedural memory injection in Memory tab"
```

---

## Phase 3: Agent Metadata Extraction (Tasks 9-12)

### Task 9: Write tests for agent.py parsing

**Files:**
- Modify: `backend/tests/test_parser.py`

**Step 1: Add tests for agent.py parsing**

```python
def test_parse_agent_script_extracts_docstring():
    """Test that agent.py docstring is extracted as description."""
    parser = ConfigParser()
    content = '''"""Customer Support Agent - Handles customer inquiries and issues."""

AGENT_NAME = "Customer Support"
MODEL = "claude-sonnet-4-20250514"
'''
    result = parser.parse_agent_script(content, "agent.py")

    assert result["name"] == "Customer Support"
    assert "customer inquiries" in result["description"].lower()
    assert result["config"]["model"] == "claude-sonnet-4-20250514"


def test_parse_agent_script_extracts_variables():
    """Test that agent.py variables are extracted."""
    parser = ConfigParser()
    content = '''# Sales Agent
AGENT_NAME = "Sales Bot"
MODEL = "claude-sonnet-4-20250514"
DESCRIPTION = "Helps with sales inquiries"
'''
    result = parser.parse_agent_script(content, "agent.py")

    assert result["name"] == "Sales Bot"
    assert result["description"] == "Helps with sales inquiries"
    assert result["config"]["model"] == "claude-sonnet-4-20250514"


def test_parse_agent_script_fallback_to_filename():
    """Test that agent name falls back to filename if no variables."""
    parser = ConfigParser()
    content = '''# Just some code
def run():
    pass
'''
    result = parser.parse_agent_script(content, "support_agent.py")

    assert result["name"] == "support_agent"


def test_parse_uploaded_files_parses_agent_py():
    """Test that agents/agent.py is parsed for metadata."""
    parser = ConfigParser()
    files = {
        "agents/agent.py": '''"""My Custom Agent"""
AGENT_NAME = "Custom Agent"
MODEL = "claude-sonnet-4-20250514"
''',
    }
    result = parser.parse_uploaded_files(files)

    assert len(result["agents"]) == 1
    assert result["agents"][0]["name"] == "Custom Agent"
    assert result["agents"][0]["config"]["model"] == "claude-sonnet-4-20250514"


def test_parse_uploaded_files_excludes_agent_examples():
    """Test that agents/examples/ folder is excluded."""
    parser = ConfigParser()
    files = {
        "agents/agent.py": '''"""Main Agent"""
AGENT_NAME = "Main"
''',
        "agents/examples/demo.py": '''"""Demo Agent"""
AGENT_NAME = "Demo"
''',
        "agents/example/sample.py": '''"""Sample Agent"""
AGENT_NAME = "Sample"
''',
    }
    result = parser.parse_uploaded_files(files)

    agent_names = [a["name"] for a in result["agents"]]
    assert "Main" in agent_names
    assert "Demo" not in agent_names
    assert "Sample" not in agent_names


def test_parse_uploaded_files_excludes_agent_tests():
    """Test that test files in agents/ are excluded."""
    parser = ConfigParser()
    files = {
        "agents/agent.py": '''AGENT_NAME = "Main"''',
        "agents/test_agent.py": '''AGENT_NAME = "Test"''',
        "agents/agent_test.py": '''AGENT_NAME = "Test2"''',
    }
    result = parser.parse_uploaded_files(files)

    agent_names = [a["name"] for a in result["agents"]]
    assert "Main" in agent_names
    assert "Test" not in agent_names
    assert "Test2" not in agent_names
```

**Step 2: Run tests to verify they fail**

Run: `cd /Users/hongfeicao/Desktop/startup-repo/ergo.ai/.worktrees/agent-hr/agent-hr/backend && python -m pytest tests/test_parser.py::test_parse_agent_script_extracts_docstring -v`
Expected: FAIL (parse_agent_script doesn't exist yet)

**Step 3: Commit**

```bash
git add backend/tests/test_parser.py
git commit -m "test(parser): add tests for agent.py metadata extraction"
```

---

### Task 10: Implement parse_agent_script method

**Files:**
- Modify: `backend/app/services/parser.py` (add after parse_agent method, around line 156)

**Step 1: Add the new method**

```python
    def parse_agent_script(self, content: str, filename: str) -> dict:
        """Parse an agent.py file for metadata.

        Extracts:
        - name: from AGENT_NAME, NAME variables or filename
        - description: from module docstring or DESCRIPTION variable
        - model: from MODEL variable

        Args:
            content: The raw Python content of the agent file.
            filename: The filename (used as fallback for name).

        Returns:
            A dictionary containing:
                - name: Agent name
                - type: Always "agent"
                - description: Agent description
                - content: Full file content
                - config: Contains model if found
        """
        lines = content.strip().split('\n')
        name = Path(filename).stem
        description = ""
        model = None

        # Try to extract module docstring
        if lines and (lines[0].startswith('"""') or lines[0].startswith("'''")):
            quote = lines[0][:3]
            if quote in lines[0][3:]:
                # Single line docstring
                description = lines[0][3:lines[0].index(quote, 3)].strip()
            else:
                # Multi-line docstring
                docstring_lines = [lines[0][3:]]
                for i, line in enumerate(lines[1:], 1):
                    if quote in line:
                        docstring_lines.append(line[:line.index(quote)])
                        description = ' '.join(l.strip() for l in docstring_lines).strip()[:200]
                        break
                    docstring_lines.append(line)

        # Extract variables using regex
        # Pattern matches: VARIABLE = "value" or VARIABLE = 'value'
        name_pattern = re.compile(r'^(?:AGENT_NAME|NAME)\s*=\s*["\']([^"\']+)["\']', re.MULTILINE)
        desc_pattern = re.compile(r'^DESCRIPTION\s*=\s*["\']([^"\']+)["\']', re.MULTILINE)
        model_pattern = re.compile(r'^MODEL\s*=\s*["\']([^"\']+)["\']', re.MULTILINE)

        name_match = name_pattern.search(content)
        if name_match:
            name = name_match.group(1)

        desc_match = desc_pattern.search(content)
        if desc_match:
            description = desc_match.group(1)

        model_match = model_pattern.search(content)
        if model_match:
            model = model_match.group(1)

        config = {}
        if model:
            config["model"] = model

        return {
            "name": name,
            "type": "agent",
            "description": description,
            "content": content,
            "config": config,
        }
```

**Step 2: Run parse_agent_script tests**

Run: `cd /Users/hongfeicao/Desktop/startup-repo/ergo.ai/.worktrees/agent-hr/agent-hr/backend && python -m pytest tests/test_parser.py::test_parse_agent_script_extracts_docstring tests/test_parser.py::test_parse_agent_script_extracts_variables tests/test_parser.py::test_parse_agent_script_fallback_to_filename -v`
Expected: All PASS

**Step 3: Commit**

```bash
git add backend/app/services/parser.py
git commit -m "feat(parser): add parse_agent_script method for agent.py metadata"
```

---

### Task 11: Update parse_uploaded_files to use parse_agent_script

**Files:**
- Modify: `backend/app/services/parser.py:247-252`

**Step 1: Replace the agents folder handling**

Find the block:
```python
                # Files in agents/ folder → agents
                elif "/agents/" in lower_path or "\\agents\\" in lower_path:
                    agent = self.parse_code_file(content, path.name, path.suffix)
                    agent["type"] = "agent"
                    agent["source_path"] = filepath
                    result["agents"].append(agent)
```

Replace with:
```python
                # Files in agents/ folder → agents (with special handling for agent.py)
                elif "/agents/" in lower_path or "\\agents\\" in lower_path:
                    # Skip examples folders
                    if "/examples/" in lower_path or "/example/" in lower_path:
                        continue
                    # Skip test files
                    if path.name.startswith("test_") or path.name.endswith("_test.py"):
                        continue
                    # Use specialized parsing for agent.py files
                    if path.suffix == ".py" and ("agent.py" in path.name.lower() or path.name.lower().endswith("_agent.py")):
                        agent = self.parse_agent_script(content, path.name)
                    else:
                        agent = self.parse_code_file(content, path.name, path.suffix)
                        agent["type"] = "agent"
                    agent["source_path"] = filepath
                    result["agents"].append(agent)
```

**Step 2: Run all agent tests**

Run: `cd /Users/hongfeicao/Desktop/startup-repo/ergo.ai/.worktrees/agent-hr/agent-hr/backend && python -m pytest tests/test_parser.py -k "agent" -v`
Expected: All PASS

**Step 3: Commit**

```bash
git add backend/app/services/parser.py
git commit -m "feat(parser): use parse_agent_script for agents/*.py files"
```

---

### Task 12: Run full test suite and verify

**Step 1: Run all parser tests**

Run: `cd /Users/hongfeicao/Desktop/startup-repo/ergo.ai/.worktrees/agent-hr/agent-hr/backend && python -m pytest tests/test_parser.py -v`
Expected: All PASS

**Step 2: Run frontend build**

Run: `cd /Users/hongfeicao/Desktop/startup-repo/ergo.ai/.worktrees/agent-hr/agent-hr/frontend && npm run build`
Expected: Build succeeds

**Step 3: Final commit if any cleanup needed**

```bash
git status
# If clean, no commit needed
```

---

## Summary

| Phase | Tasks | Focus |
|-------|-------|-------|
| 1 | 1-4 | Memory File Filtering |
| 2 | 5-8 | Procedural Memory Injection |
| 3 | 9-12 | Agent Metadata Extraction |

**Total: 12 tasks**

Each task is self-contained with clear verification steps. Phases can be done in any order.
