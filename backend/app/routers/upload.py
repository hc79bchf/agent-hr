import zipfile
import io
from pathlib import Path, PurePosixPath
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from uuid import UUID
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.agent import Agent, AgentVersion, ChangeType
from app.models.component import Component, ComponentType
from app.models.component_folder import ComponentFolder
from app.schemas.version import VersionResponse
from app.services.parser import ConfigParser

router = APIRouter(prefix="/api/agents", tags=["upload"])
parser = ConfigParser()

# Maximum file size for uploads (10 MB)
MAX_UPLOAD_SIZE = 10 * 1024 * 1024


def is_safe_path(path: str) -> bool:
    """Check if a zip entry path is safe (no directory traversal).

    Args:
        path: The path from a zip archive entry.

    Returns:
        True if the path is safe, False if it could be malicious.
    """
    # Reject empty paths
    if not path:
        return False

    # Reject absolute paths
    if path.startswith('/') or path.startswith('\\'):
        return False

    # Reject paths with drive letters (Windows)
    if len(path) >= 2 and path[1] == ':':
        return False

    # Use PurePosixPath to normalize and check for traversal
    # This handles both forward and back slashes
    try:
        normalized = PurePosixPath(path)
        # Check each component for '..'
        for part in normalized.parts:
            if part == '..':
                return False
    except (ValueError, TypeError):
        return False

    return True


def extract_folder_info(source_path: str) -> tuple[str | None, str | None]:
    """Extract folder name and path from a component's source path.

    Returns (folder_name, folder_path) or (None, None) if component should be ungrouped.

    Type folders (skills, tools, memory, agents, commands) represent component types,
    not grouping folders. Files directly in these type folders or in their immediate
    subfolders are individual components and should be ungrouped.

    Examples:
        - "skills/loader.py" → (None, None) - direct child of type folder
        - "prefix/skills/loader.py" → (None, None) - direct child of type folder
        - "skills/brand-guidelines/SKILL.md" → (None, None) - skill subfolder (the skill itself)
        - "skills/my-skill/templates/template.md" → ("templates", "skills/my-skill/templates")
        - ".claude/commands/quick-task.md" → (None, None) - root level
    """
    if not source_path:
        return None, None

    path = Path(source_path)
    parts = path.parts

    # Type folders - files directly in these or their immediate subfolders are individual components
    type_folders = {"skills", "tools", "memory", "memories", "agents", "commands"}

    # Known root-level patterns that shouldn't create folders
    root_patterns = [
        (".claude", "commands"),  # .claude/commands/skill.md
        (".claude", "agents"),     # .claude/agents/agent.md
    ]

    # Check if this is a known root-level path
    for root_pattern in root_patterns:
        pattern_len = len(root_pattern)
        if len(parts) == pattern_len + 1:  # Exactly at root level
            if parts[:pattern_len] == root_pattern:
                return None, None

    # Find the type folder in the path
    type_folder_index = None
    for i, part in enumerate(parts):
        if part.lower() in type_folders:
            type_folder_index = i
            break

    if type_folder_index is not None:
        # Calculate depth from type folder to file
        # e.g., "prefix/skills/loader.py" → depth = 1 (skills to loader.py)
        # e.g., "prefix/skills/brand-guidelines/SKILL.md" → depth = 2
        # e.g., "prefix/skills/my-skill/templates/file.md" → depth = 3
        depth_from_type_folder = len(parts) - type_folder_index - 1

        # Depth 1: File directly in type folder (e.g., skills/loader.py)
        # Depth 2: File in skill's own folder (e.g., skills/brand-guidelines/SKILL.md)
        # These should be ungrouped
        if depth_from_type_folder <= 2:
            return None, None

        # Depth 3+: File in a subfolder within a component
        # e.g., skills/my-skill/templates/file.md → folder is "templates"
        folder_name = parts[-2]
        folder_path = str(Path(*parts[:-1]))
        return folder_name, folder_path

    # For paths without a recognized type folder, use original logic
    # At least 3 parts needed: type_folder/subfolder/file
    if len(parts) >= 3:
        folder_name = parts[-2]
        folder_path = str(Path(*parts[:-1]))
        return folder_name, folder_path

    return None, None


def get_folder_description(folder_path: str, files: dict[str, str]) -> str | None:
    """Try to extract a folder description from README or __init__ file."""
    if not folder_path:
        return None

    # Look for README.md, README.txt, or __init__.py in the folder
    for readme_name in ["README.md", "README.txt", "readme.md", "__init__.py"]:
        readme_path = f"{folder_path}/{readme_name}"
        if readme_path in files:
            content = files[readme_path]
            lines = content.strip().split('\n')
            # Extract first non-header line as description
            for line in lines:
                stripped = line.strip()
                if stripped and not stripped.startswith('#') and not stripped.startswith('"""'):
                    return stripped[:200]
    return None


@router.post("/{agent_id}/upload", response_model=VersionResponse, status_code=status.HTTP_201_CREATED)
async def upload_config(
    agent_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload configuration files to create a new agent version.

    Accepts either a single file or a zip archive containing:
    - .claude/commands/*.md - Skills (slash commands)
    - .claude/agents/*.md - Agent definitions
    - mcp.json, mcp_config.json, .mcp.json - MCP tool configurations
    - CLAUDE.md, *.md, *.txt - Memory/context files
    """
    # Verify agent exists
    agent = db.query(Agent).filter(Agent.id == agent_id, Agent.deleted_at.is_(None)).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Read uploaded file
    content = await file.read()

    # Validate file size
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {MAX_UPLOAD_SIZE // (1024 * 1024)} MB"
        )

    # Parse based on file type
    files_dict = {}
    if file.filename.endswith('.zip'):
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as zf:
                for name in zf.namelist():
                    # Skip directories and validate path safety (prevent zip slip)
                    if name.endswith('/'):
                        continue
                    if not is_safe_path(name):
                        raise HTTPException(
                            status_code=400,
                            detail=f"Invalid path in zip file: {name}"
                        )
                    try:
                        files_dict[name] = zf.read(name).decode('utf-8')
                    except UnicodeDecodeError:
                        pass  # Skip binary files
        except zipfile.BadZipFile:
            raise HTTPException(status_code=400, detail="Invalid zip file")
    else:
        # Single file upload
        try:
            files_dict[file.filename] = content.decode('utf-8')
        except UnicodeDecodeError:
            raise HTTPException(status_code=400, detail="File must be text-based")

    # Parse files
    parsed = parser.parse_uploaded_files(files_dict)

    # Get next version number
    max_version = db.query(AgentVersion).filter(
        AgentVersion.agent_id == agent_id
    ).count()

    # Create version
    version = AgentVersion(
        agent_id=agent_id,
        version_number=max_version + 1,
        change_type=ChangeType.UPLOAD,
        change_summary="Initial upload" if max_version == 0 else "File upload",
        raw_config=files_dict,
        parsed_config=parsed,
        created_by=current_user.id,
    )
    db.add(version)
    db.flush()  # Get version ID

    # Create folders and components
    # Track folders by (type, folder_path) to avoid duplicates
    folder_map: dict[tuple[str, str], ComponentFolder] = {}

    def get_or_create_folder(comp_type: str, source_path: str | None) -> ComponentFolder | None:
        """Get or create a folder for a component based on its source path."""
        if not source_path:
            return None

        folder_name, folder_path = extract_folder_info(source_path)
        if not folder_name or not folder_path:
            return None

        key = (comp_type, folder_path)
        if key in folder_map:
            return folder_map[key]

        # Create new folder
        folder = ComponentFolder(
            version_id=version.id,
            type=comp_type,
            name=folder_name,
            description=get_folder_description(folder_path, files_dict),
            source_path=folder_path,
            file_count=0,
        )
        db.add(folder)
        db.flush()  # Get folder ID before using it
        folder_map[key] = folder
        return folder

    components = []

    for skill in parsed["skills"]:
        folder = get_or_create_folder("skill", skill.get("source_path"))
        comp = Component(
            version_id=version.id,
            folder_id=folder.id if folder else None,
            type=ComponentType.SKILL,
            name=skill["name"],
            description=skill.get("description"),
            content=skill.get("content"),
            config=skill.get("config", {}),
            source_path=skill.get("source_path"),
        )
        db.add(comp)
        components.append(comp)
        if folder:
            folder.file_count += 1

    for tool in parsed["mcp_tools"]:
        folder = get_or_create_folder("mcp_tool", tool.get("source_path"))
        comp = Component(
            version_id=version.id,
            folder_id=folder.id if folder else None,
            type=ComponentType.MCP_TOOL,
            name=tool["name"],
            description=tool.get("description"),
            content=tool.get("content"),
            config=tool.get("config", {}),
            source_path=tool.get("source_path"),
        )
        db.add(comp)
        components.append(comp)
        if folder:
            folder.file_count += 1

    for memory in parsed["memory"]:
        folder = get_or_create_folder("memory", memory.get("source_path"))
        comp = Component(
            version_id=version.id,
            folder_id=folder.id if folder else None,
            type=ComponentType.MEMORY,
            name=memory["name"],
            description=memory.get("description"),
            content=memory.get("content"),
            config=memory.get("config", {}),
            source_path=memory.get("source_path"),
        )
        db.add(comp)
        components.append(comp)
        if folder:
            folder.file_count += 1

    for agent_def in parsed.get("agents", []):
        folder = get_or_create_folder("agent", agent_def.get("source_path"))
        comp = Component(
            version_id=version.id,
            folder_id=folder.id if folder else None,
            type=ComponentType.AGENT,
            name=agent_def["name"],
            description=agent_def.get("description"),
            content=agent_def.get("content"),
            config=agent_def.get("config", {}),
            source_path=agent_def.get("source_path"),
        )
        db.add(comp)
        components.append(comp)
        if folder:
            folder.file_count += 1

    # Update agent's current version
    agent.current_version_id = version.id

    db.commit()
    db.refresh(version)

    return version
