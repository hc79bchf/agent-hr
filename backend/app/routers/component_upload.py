"""Granular component upload endpoints for adding individual skills, MCP tools, or memory to agents."""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from uuid import UUID

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.agent import Agent, AgentVersion, ChangeType
from app.models.component import Component, ComponentType
from app.schemas.version import VersionResponse
from app.services.parser import ConfigParser

router = APIRouter(prefix="/api/agents", tags=["component-upload"])
parser = ConfigParser()


async def _upload_component(
    agent_id: UUID,
    file: UploadFile,
    component_type: ComponentType,
    db: Session,
    current_user: User,
) -> AgentVersion:
    """Helper to upload a single component and create a new version."""
    # Verify agent exists
    agent = db.query(Agent).filter(Agent.id == agent_id, Agent.deleted_at.is_(None)).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Read and decode file
    content = await file.read()
    try:
        file_content = content.decode('utf-8')
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be text-based")

    # Get current version to copy existing components
    current_version = None
    if agent.current_version_id:
        current_version = db.query(AgentVersion).filter(
            AgentVersion.id == agent.current_version_id
        ).first()

    # Parse the uploaded file based on type
    if component_type == ComponentType.SKILL:
        parsed = parser.parse_skill(file_content, file.filename)
    elif component_type == ComponentType.MCP_TOOL:
        tools = parser.parse_mcp_config(file_content)
        if not tools:
            raise HTTPException(status_code=400, detail="Invalid MCP configuration file")
        # For MCP, we may have multiple tools in one file
        parsed = tools
    else:  # MEMORY
        parsed = parser.parse_memory(file_content, file.filename)

    # Get next version number
    max_version = db.query(AgentVersion).filter(
        AgentVersion.agent_id == agent_id
    ).count()

    # Build raw_config from current version + new file
    raw_config = {}
    if current_version and current_version.raw_config:
        raw_config = dict(current_version.raw_config)
    raw_config[file.filename] = file_content

    # Create new version
    version = AgentVersion(
        agent_id=agent_id,
        version_number=max_version + 1,
        parent_version_id=agent.current_version_id,
        change_type=ChangeType.UPLOAD,
        change_summary=f"Added {component_type.value}: {file.filename}",
        raw_config=raw_config,
        parsed_config={},  # Will be rebuilt from components
        created_by=current_user.id,
    )
    db.add(version)
    db.flush()

    # Copy existing components from current version
    if current_version:
        for comp in current_version.components:
            new_comp = Component(
                version_id=version.id,
                type=comp.type,
                name=comp.name,
                description=comp.description,
                content=comp.content,
                config=comp.config,
                source_path=comp.source_path,
            )
            db.add(new_comp)

    # Add new component(s)
    if component_type == ComponentType.MCP_TOOL and isinstance(parsed, list):
        # MCP config can contain multiple tools
        for tool in parsed:
            comp = Component(
                version_id=version.id,
                type=ComponentType.MCP_TOOL,
                name=tool["name"],
                description=tool.get("description"),
                content=tool.get("content"),
                config=tool.get("config", {}),
                source_path=file.filename,
            )
            db.add(comp)
    else:
        comp = Component(
            version_id=version.id,
            type=component_type,
            name=parsed["name"],
            description=parsed.get("description"),
            content=parsed.get("content"),
            config=parsed.get("config", {}),
            source_path=file.filename,
        )
        db.add(comp)

    # Update agent's current version
    agent.current_version_id = version.id

    db.commit()
    db.refresh(version)

    return version


@router.post("/{agent_id}/skills", response_model=VersionResponse, status_code=status.HTTP_201_CREATED)
async def upload_skill(
    agent_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a single skill file to an agent.

    Accepts a markdown file containing a skill definition.
    Creates a new version with the added skill while preserving existing components.
    """
    if not file.filename.endswith('.md'):
        raise HTTPException(status_code=400, detail="Skill file must be a markdown (.md) file")

    return await _upload_component(agent_id, file, ComponentType.SKILL, db, current_user)


@router.post("/{agent_id}/mcp-tools", response_model=VersionResponse, status_code=status.HTTP_201_CREATED)
async def upload_mcp_tool(
    agent_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload an MCP configuration file to an agent.

    Accepts a JSON file containing MCP server configurations.
    Creates a new version with the added MCP tools while preserving existing components.
    """
    if not file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="MCP config file must be a JSON (.json) file")

    return await _upload_component(agent_id, file, ComponentType.MCP_TOOL, db, current_user)


@router.post("/{agent_id}/memory", response_model=VersionResponse, status_code=status.HTTP_201_CREATED)
async def upload_memory(
    agent_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a memory/context file to an agent.

    Accepts a markdown or text file containing memory/context.
    Creates a new version with the added memory while preserving existing components.
    """
    if not file.filename.endswith(('.md', '.txt')):
        raise HTTPException(status_code=400, detail="Memory file must be a markdown (.md) or text (.txt) file")

    return await _upload_component(agent_id, file, ComponentType.MEMORY, db, current_user)
