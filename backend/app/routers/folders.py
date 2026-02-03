"""API endpoints for component folders."""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from uuid import UUID
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.agent import Agent, AgentVersion
from app.models.component import Component
from app.models.component_folder import ComponentFolder
from app.schemas.folder import (
    ComponentFolderResponse,
    ComponentFolderDetailResponse,
    FolderListResponse,
    FoldersByTypeResponse,
    ComponentInFolder,
)

router = APIRouter(prefix="/api/agents", tags=["folders"])


@router.get("/{agent_id}/versions/{version_id}/folders", response_model=FoldersByTypeResponse)
async def list_folders_by_type(
    agent_id: UUID,
    version_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all folders for a version, grouped by component type."""
    # Verify agent exists
    agent = db.query(Agent).filter(Agent.id == agent_id, Agent.deleted_at.is_(None)).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Verify version exists
    version = db.query(AgentVersion).filter(
        AgentVersion.id == version_id,
        AgentVersion.agent_id == agent_id
    ).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    # Get all folders for this version
    folders = db.query(ComponentFolder).filter(
        ComponentFolder.version_id == version_id
    ).all()

    # Group by type
    result = FoldersByTypeResponse()
    for folder in folders:
        folder_response = ComponentFolderResponse.model_validate(folder)
        if folder.type == "skill":
            result.skills.append(folder_response)
        elif folder.type == "mcp_tool":
            result.mcp_tools.append(folder_response)
        elif folder.type == "memory":
            result.memory.append(folder_response)
        elif folder.type == "agent":
            result.agents.append(folder_response)

    return result


@router.get("/{agent_id}/versions/{version_id}/folders/list", response_model=FolderListResponse)
async def list_folders(
    agent_id: UUID,
    version_id: UUID,
    type: str = Query(None, description="Filter by component type"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List folders for a version with optional type filtering and pagination."""
    # Verify agent exists
    agent = db.query(Agent).filter(Agent.id == agent_id, Agent.deleted_at.is_(None)).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Verify version exists
    version = db.query(AgentVersion).filter(
        AgentVersion.id == version_id,
        AgentVersion.agent_id == agent_id
    ).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    # Build query
    query = db.query(ComponentFolder).filter(ComponentFolder.version_id == version_id)
    if type:
        query = query.filter(ComponentFolder.type == type)

    total = query.count()
    folders = query.order_by(ComponentFolder.name).offset(skip).limit(limit).all()

    return FolderListResponse(
        data=[ComponentFolderResponse.model_validate(f) for f in folders],
        total=total
    )


@router.get("/{agent_id}/versions/{version_id}/folders/{folder_id}", response_model=ComponentFolderDetailResponse)
async def get_folder_detail(
    agent_id: UUID,
    version_id: UUID,
    folder_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get folder details including its components."""
    # Verify agent exists
    agent = db.query(Agent).filter(Agent.id == agent_id, Agent.deleted_at.is_(None)).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Verify version exists
    version = db.query(AgentVersion).filter(
        AgentVersion.id == version_id,
        AgentVersion.agent_id == agent_id
    ).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    # Get folder
    folder = db.query(ComponentFolder).filter(
        ComponentFolder.id == folder_id,
        ComponentFolder.version_id == version_id
    ).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")

    # Get components in this folder
    components = db.query(Component).filter(Component.folder_id == folder_id).all()

    return ComponentFolderDetailResponse(
        id=folder.id,
        version_id=folder.version_id,
        type=folder.type,
        name=folder.name,
        description=folder.description,
        source_path=folder.source_path,
        file_count=folder.file_count,
        created_at=folder.created_at,
        updated_at=folder.updated_at,
        components=[ComponentInFolder.model_validate(c) for c in components]
    )


@router.get("/{agent_id}/versions/{version_id}/ungrouped", response_model=FoldersByTypeResponse)
async def get_ungrouped_components(
    agent_id: UUID,
    version_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get components that are not assigned to any folder, grouped by type.

    This supports backward compatibility for components created before folders were introduced.
    Returns a FoldersByTypeResponse where each "folder" represents ungrouped components of that type.
    """
    # Verify agent exists
    agent = db.query(Agent).filter(Agent.id == agent_id, Agent.deleted_at.is_(None)).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Verify version exists
    version = db.query(AgentVersion).filter(
        AgentVersion.id == version_id,
        AgentVersion.agent_id == agent_id
    ).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    # Get ungrouped components
    ungrouped = db.query(Component).filter(
        Component.version_id == version_id,
        Component.folder_id.is_(None)
    ).all()

    # Group by type and create synthetic folder responses
    result = FoldersByTypeResponse()

    # Count by type
    type_counts = {}
    for comp in ungrouped:
        comp_type = comp.type.value
        if comp_type not in type_counts:
            type_counts[comp_type] = 0
        type_counts[comp_type] += 1

    # Create synthetic folder for each type that has ungrouped components
    for comp_type, count in type_counts.items():
        synthetic_folder = ComponentFolderResponse(
            id=UUID('00000000-0000-0000-0000-000000000000'),  # Sentinel ID for ungrouped
            version_id=version_id,
            type=comp_type,
            name="Ungrouped",
            description=f"Components not assigned to a folder",
            source_path=None,
            file_count=count,
            created_at=version.created_at,
            updated_at=version.created_at,
        )

        if comp_type == "skill":
            result.skills.append(synthetic_folder)
        elif comp_type == "mcp_tool":
            result.mcp_tools.append(synthetic_folder)
        elif comp_type == "memory":
            result.memory.append(synthetic_folder)
        elif comp_type == "agent":
            result.agents.append(synthetic_folder)

    return result
