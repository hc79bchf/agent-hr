# Folder-Based Component Display Design

**Date:** 2026-01-26
**Status:** Approved
**Author:** Claude Code (brainstorming session)

## Overview

Redesign the MCP, Skills, Memory, and Agent tabs in the Agent Detail page to display components at the folder level rather than individual files. This provides a cleaner, more intuitive interface that reflects the logical grouping of related components.

## Goals

1. Show folders instead of individual script files in component tabs
2. Extract and display actual metadata for descriptions
3. Display memory as knowledge summaries rather than raw files
4. Enable library publishing at both folder and individual file levels
5. Maintain backward compatibility with existing components

## Design Decisions

| Question | Decision |
|----------|----------|
| How to determine folder grouping? | New `folder_id` metadata field on components (explicit grouping) |
| Where should folder description come from? | New folder-level metadata field in `component_folders` table |
| What happens when user clicks folder card? | Modal detail view showing files within folder |
| How should library publishing work? | Both folder-level and individual file publish options |

## Data Model Changes

### New Table: `component_folders`

```sql
CREATE TABLE component_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id UUID NOT NULL REFERENCES agent_versions(id),
    type VARCHAR(20) NOT NULL,  -- 'skill', 'mcp_tool', 'memory', 'agent'
    name VARCHAR(255) NOT NULL,
    description TEXT,
    source_path VARCHAR(500),   -- Original folder path from upload
    file_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(version_id, type, name)
);
```

### Updated Table: `components`

```sql
ALTER TABLE components
ADD COLUMN folder_id UUID REFERENCES component_folders(id);
```

### TypeScript Types

```typescript
// New folder type
interface ComponentFolder {
  id: string;
  version_id: string;
  type: ComponentType;
  name: string;
  description: string | null;
  source_path: string | null;
  file_count: number;
  created_at: string;
  updated_at: string;
}

// Updated component type
interface Component {
  // existing fields...
  folder_id?: string | null;
}

// API response for folder detail
interface FolderDetailResponse {
  folder: ComponentFolder;
  components: Component[];
}
```

### API Endpoints

```
GET  /api/agents/{agent_id}/versions/{version_id}/folders
     → List folders for a version, grouped by type

GET  /api/agents/{agent_id}/versions/{version_id}/folders/{folder_id}
     → Get folder detail with its components

POST /api/library/folders/{folder_id}/publish
     → Publish entire folder to library

POST /api/library/components/{component_id}/publish
     → Publish single component to library
```

## Frontend Components

### FolderCard Component

Replaces individual `ComponentCard` display. Shows:
- Folder icon (type-specific)
- Folder name
- Description (from folder metadata)
- File count badge
- Type indicator chip
- Action menu (publish, view details)

```typescript
interface FolderCardProps {
  folder: ComponentFolder;
  onClick?: (folder: ComponentFolder) => void;
  onPublish?: (folder: ComponentFolder) => void;
}
```

### FolderDetailModal Component

Opens when user clicks a folder card. Displays:
- Folder header with full metadata
- List of files within the folder (using existing `ComponentCard`)
- Individual file actions (view content, publish to library)
- Folder-level publish action

```typescript
interface FolderDetailModalProps {
  folder: ComponentFolder;
  isOpen: boolean;
  onClose: () => void;
  onPublishFolder?: (folder: ComponentFolder) => void;
  onPublishComponent?: (component: Component) => void;
}
```

### Tab Layout Changes

Each component tab (Skills, MCP Tools, Memory, Agents) will:
1. Fetch folders instead of raw components
2. Render `FolderCard` grid/list
3. Handle click → open `FolderDetailModal`

## Memory Tab Special Handling

Memory components require semantic treatment rather than file-based display:

### Memory Folder Types (Knowledge Domains)

| Folder Type | Description | Display Focus |
|-------------|-------------|---------------|
| working | Active task context | Current session state |
| short_term | Recent interactions | Conversation summaries |
| long_term | Persistent knowledge | Key facts, preferences |
| procedural | How-to knowledge | Process summaries |

### Memory Folder Card Display

Instead of showing file names, memory folders show:
- **Domain label** (e.g., "Long-term Knowledge")
- **Content summary** (extracted/generated from memory content)
- **Entry count** (number of memory records)
- **Last updated** timestamp

### Memory Detail Modal

Shows:
- Categorized memory entries
- Key facts/summaries (not raw content)
- Memory freshness indicators
- Search/filter within memory domain

### Backend Processing for Memory

```python
async def get_memory_folder_summary(folder: ComponentFolder) -> MemoryFolderSummary:
    components = await get_folder_components(folder.id)

    # Generate summary from memory content
    summary = await llm_summarize_memories(components)

    return MemoryFolderSummary(
        folder=folder,
        summary=summary,
        entry_count=len(components),
        last_updated=max(c.updated_at for c in components)
    )
```

## Library Publishing Integration

### Folder Publishing Flow

1. User clicks "Publish to Library" on a `FolderCard`
2. System creates `library_item` with type matching folder type
3. All components bundled as single publishable unit
4. Metadata from folder record used for library display

### Individual File Publishing

- Available within `FolderDetailModal`
- Each file has its own "Publish" option
- Published as standalone library item
- Useful for sharing single utilities

### Library Item Schema

```typescript
interface LibraryItem {
  // existing fields...
  source_type: 'folder' | 'component';
  source_folder_id?: string;
  component_count?: number;  // For folder-sourced items
}
```

## Upload/Import Handling

### Folder Detection Logic

1. **Zip with directories** → Each directory becomes a `component_folder`
2. **Flat zip** → Group by component type into synthetic folders
3. **Single file** → Placed in default folder for its type

### Metadata Extraction

| Component Type | Extraction Source |
|----------------|-------------------|
| Skills | Docstrings, function signatures, `__doc__` |
| MCP Tools | Tool manifest/schema files |
| Agents | Agent config files |
| Memory | Content analysis for domain summary |

### Processing Flow

```python
async def process_upload(file: UploadFile, version_id: UUID):
    folders = detect_folders(file)
    for folder in folders:
        folder_record = create_folder(
            name=folder.name,
            type=folder.type,
            version_id=version_id,
            description=extract_folder_description(folder)
        )
        for component in folder.files:
            metadata = extract_metadata(component)
            create_component(
                component,
                folder_id=folder_record.id,
                **metadata
            )
```

## Migration Strategy

### Phase 1: Schema Migration

```python
def upgrade():
    # 1. Create component_folders table
    op.create_table('component_folders',
        sa.Column('id', UUID, primary_key=True),
        sa.Column('version_id', UUID, sa.ForeignKey('agent_versions.id')),
        sa.Column('type', sa.String(20), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text),
        sa.Column('source_path', sa.String(500)),
        sa.Column('file_count', sa.Integer, default=0),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now()),
    )

    # 2. Add folder_id to components (nullable for backward compat)
    op.add_column('components',
        sa.Column('folder_id', UUID, sa.ForeignKey('component_folders.id'), nullable=True)
    )
```

### Phase 2: Data Migration

```python
def migrate_existing_components():
    """Create default folders and assign existing components."""
    connection = op.get_bind()

    # Get all versions with components
    versions = connection.execute(
        "SELECT DISTINCT version_id FROM components"
    ).fetchall()

    for version_id in versions:
        # Get component types in this version
        types = connection.execute(
            "SELECT DISTINCT type FROM components WHERE version_id = %s",
            version_id
        ).fetchall()

        for comp_type in types:
            # Create default folder for this type
            folder_id = uuid.uuid4()
            connection.execute(
                """INSERT INTO component_folders
                   (id, version_id, type, name, description)
                   VALUES (%s, %s, %s, %s, %s)""",
                (folder_id, version_id, comp_type, f"Default {comp_type}",
                 f"Migrated {comp_type} components")
            )

            # Update components to point to folder
            connection.execute(
                """UPDATE components
                   SET folder_id = %s
                   WHERE version_id = %s AND type = %s""",
                (folder_id, version_id, comp_type)
            )

            # Update file count
            connection.execute(
                """UPDATE component_folders
                   SET file_count = (
                       SELECT COUNT(*) FROM components WHERE folder_id = %s
                   ) WHERE id = %s""",
                (folder_id, folder_id)
            )
```

### Frontend Backward Compatibility

- Components without `folder_id` display in "Ungrouped" section
- Graceful degradation: if no folders exist, show flat list (current behavior)
- Type guards to handle both folder-based and legacy displays

## Implementation Checklist

### Backend
- [ ] Create `component_folders` table migration
- [ ] Add `folder_id` column to components
- [ ] Run data migration for existing components
- [ ] Create folder list endpoint
- [ ] Create folder detail endpoint
- [ ] Update upload handler for folder detection
- [ ] Add metadata extraction utilities
- [ ] Create memory summary generation service
- [ ] Add folder publish endpoint
- [ ] Update library item schema

### Frontend
- [ ] Create `ComponentFolder` type
- [ ] Update `Component` type with `folder_id`
- [ ] Create `FolderCard` component
- [ ] Create `FolderDetailModal` component
- [ ] Create `useFolders` hook
- [ ] Update Skills tab to use folders
- [ ] Update MCP Tools tab to use folders
- [ ] Update Memory tab with semantic display
- [ ] Update Agents tab to use folders
- [ ] Add folder publish UI
- [ ] Add individual component publish in modal
- [ ] Handle legacy components (ungrouped section)

### Testing
- [ ] Unit tests for folder detection logic
- [ ] Unit tests for metadata extraction
- [ ] Integration tests for folder CRUD
- [ ] E2E tests for folder display
- [ ] E2E tests for publish flows
- [ ] Migration rollback testing

## Open Questions

None - all design questions resolved during brainstorming session.

---

*Generated with Claude Code during brainstorming session*
