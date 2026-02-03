"""Memory management router for agent knowledge base CRUD operations."""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from uuid import UUID

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.agent import Agent, AgentVersion, ChangeType
from app.models.component import Component, ComponentType
from app.models.memory import MemorySuggestion
from app.schemas.memory import (
    MemoryCreate,
    MemoryUpdate,
    MemoryCreateResponse,
    MemoryUpdateResponse,
    MemoryDeleteResponse,
    MemorySuggestionCreate,
    MemorySuggestionResponse,
    MemorySuggestionReview,
    MemorySuggestionListResponse,
)

router = APIRouter(prefix="/api/agents", tags=["memory"])

# Create a separate router for suggestion-specific endpoints
suggestions_router = APIRouter(prefix="/api", tags=["memory-suggestions"])


def _extract_description(content: str) -> str:
    """Extract description from first non-header line of content."""
    lines = content.strip().split("\n")
    for line in lines:
        stripped = line.strip()
        if stripped and not stripped.startswith("#"):
            return stripped[:200]
    return ""


@router.post(
    "/{agent_id}/memories",
    response_model=MemoryCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_memory(
    agent_id: UUID,
    memory_data: MemoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a new memory entry to an agent.

    Creates a new agent version with the memory added.
    """
    # Verify agent exists
    agent = db.query(Agent).filter(
        Agent.id == agent_id, Agent.deleted_at.is_(None)
    ).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Get current version
    current_version = None
    if agent.current_version_id:
        current_version = db.query(AgentVersion).filter(
            AgentVersion.id == agent.current_version_id
        ).first()

    # Get next version number
    max_version = db.query(AgentVersion).filter(
        AgentVersion.agent_id == agent_id
    ).count()

    # Auto-generate description if not provided
    description = memory_data.description
    if not description:
        description = _extract_description(memory_data.content)

    # Create new version
    new_version = AgentVersion(
        agent_id=agent_id,
        version_number=max_version + 1,
        parent_version_id=current_version.id if current_version else None,
        change_type=ChangeType.EDIT,
        change_summary=f"Added memory: {memory_data.name}",
        raw_config=current_version.raw_config if current_version else {},
        parsed_config=current_version.parsed_config if current_version else {},
        created_by=current_user.id,
    )
    db.add(new_version)
    db.flush()

    # Copy existing components
    if current_version:
        for comp in current_version.components:
            new_comp = Component(
                version_id=new_version.id,
                type=comp.type,
                name=comp.name,
                description=comp.description,
                content=comp.content,
                config=comp.config,
                source_path=comp.source_path,
            )
            db.add(new_comp)

    # Add new memory component
    new_memory = Component(
        version_id=new_version.id,
        type=ComponentType.MEMORY,
        name=memory_data.name,
        description=description,
        content=memory_data.content,
        config={},
        source_path=None,
    )
    db.add(new_memory)

    # Update agent's current version
    agent.current_version_id = new_version.id

    db.commit()
    db.refresh(new_version)
    db.refresh(new_memory)

    return MemoryCreateResponse(memory=new_memory, new_version=new_version)


@router.put(
    "/{agent_id}/memories/{memory_id}",
    response_model=MemoryUpdateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def update_memory(
    agent_id: UUID,
    memory_id: UUID,
    memory_data: MemoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an existing memory entry.

    Creates a new agent version with the memory updated.
    """
    # Verify agent exists
    agent = db.query(Agent).filter(
        Agent.id == agent_id, Agent.deleted_at.is_(None)
    ).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    if not agent.current_version_id:
        raise HTTPException(status_code=404, detail="Agent has no version")

    # Get current version
    current_version = db.query(AgentVersion).filter(
        AgentVersion.id == agent.current_version_id
    ).first()

    # Find the memory component
    source_memory = db.query(Component).filter(
        Component.id == memory_id,
        Component.version_id == current_version.id,
        Component.type == ComponentType.MEMORY,
    ).first()
    if not source_memory:
        raise HTTPException(status_code=404, detail="Memory not found")

    # Get next version number
    max_version = db.query(AgentVersion).filter(
        AgentVersion.agent_id == agent_id
    ).count()

    # Create new version
    new_version = AgentVersion(
        agent_id=agent_id,
        version_number=max_version + 1,
        parent_version_id=current_version.id,
        change_type=ChangeType.EDIT,
        change_summary=f"Updated memory: {source_memory.name}",
        raw_config=current_version.raw_config,
        parsed_config=current_version.parsed_config,
        created_by=current_user.id,
    )
    db.add(new_version)
    db.flush()

    # Copy all components, applying update to the target memory
    updated_memory = None
    for comp in current_version.components:
        if comp.id == memory_id:
            # This is the memory to update
            new_name = memory_data.name if memory_data.name else comp.name
            new_content = memory_data.content if memory_data.content else comp.content
            new_description = memory_data.description
            if new_description is None and memory_data.content:
                new_description = _extract_description(memory_data.content)
            elif new_description is None:
                new_description = comp.description

            new_comp = Component(
                version_id=new_version.id,
                type=comp.type,
                name=new_name,
                description=new_description,
                content=new_content,
                config=comp.config,
                source_path=comp.source_path,
            )
            db.add(new_comp)
            updated_memory = new_comp
        else:
            # Copy unchanged
            new_comp = Component(
                version_id=new_version.id,
                type=comp.type,
                name=comp.name,
                description=comp.description,
                content=comp.content,
                config=comp.config,
                source_path=comp.source_path,
            )
            db.add(new_comp)

    # Update agent's current version
    agent.current_version_id = new_version.id

    db.commit()
    db.refresh(new_version)
    db.refresh(updated_memory)

    return MemoryUpdateResponse(memory=updated_memory, new_version=new_version)


@router.delete(
    "/{agent_id}/memories/{memory_id}",
    response_model=MemoryDeleteResponse,
    status_code=status.HTTP_200_OK,
)
async def delete_memory(
    agent_id: UUID,
    memory_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a memory entry from an agent.

    Creates a new agent version without the deleted memory.
    """
    # Verify agent exists
    agent = db.query(Agent).filter(
        Agent.id == agent_id, Agent.deleted_at.is_(None)
    ).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    if not agent.current_version_id:
        raise HTTPException(status_code=404, detail="Agent has no version")

    # Get current version
    current_version = db.query(AgentVersion).filter(
        AgentVersion.id == agent.current_version_id
    ).first()

    # Find the memory component
    source_memory = db.query(Component).filter(
        Component.id == memory_id,
        Component.version_id == current_version.id,
        Component.type == ComponentType.MEMORY,
    ).first()
    if not source_memory:
        raise HTTPException(status_code=404, detail="Memory not found")

    # Get next version number
    max_version = db.query(AgentVersion).filter(
        AgentVersion.agent_id == agent_id
    ).count()

    # Create new version
    new_version = AgentVersion(
        agent_id=agent_id,
        version_number=max_version + 1,
        parent_version_id=current_version.id,
        change_type=ChangeType.EDIT,
        change_summary=f"Deleted memory: {source_memory.name}",
        raw_config=current_version.raw_config,
        parsed_config=current_version.parsed_config,
        created_by=current_user.id,
    )
    db.add(new_version)
    db.flush()

    # Copy all components EXCEPT the deleted memory
    for comp in current_version.components:
        if comp.id == memory_id:
            continue  # Skip the deleted memory
        new_comp = Component(
            version_id=new_version.id,
            type=comp.type,
            name=comp.name,
            description=comp.description,
            content=comp.content,
            config=comp.config,
            source_path=comp.source_path,
        )
        db.add(new_comp)

    # Update agent's current version
    agent.current_version_id = new_version.id

    db.commit()
    db.refresh(new_version)

    return MemoryDeleteResponse(deleted=True, new_version=new_version)


# =============================================================================
# Memory Suggestion Endpoints
# =============================================================================


@router.get(
    "/{agent_id}/suggestions",
    response_model=MemorySuggestionListResponse,
)
async def list_memory_suggestions(
    agent_id: UUID,
    status_filter: Optional[str] = Query(
        None,
        alias="status",
        pattern="^(pending|approved|rejected)$",
        description="Filter by suggestion status",
    ),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=100, description="Maximum records to return"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List memory suggestions for an agent.

    Args:
        agent_id: The agent's UUID.
        status_filter: Optional status filter (pending, approved, rejected).
        skip: Pagination offset.
        limit: Maximum number of results.
        db: Database session.
        current_user: The authenticated user.

    Returns:
        List of memory suggestions with total count.

    Raises:
        HTTPException: If agent not found.
    """
    # Verify agent exists
    agent = db.query(Agent).filter(
        Agent.id == agent_id, Agent.deleted_at.is_(None)
    ).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Build query
    query = db.query(MemorySuggestion).filter(MemorySuggestion.agent_id == agent_id)
    if status_filter:
        query = query.filter(MemorySuggestion.status == status_filter)

    # Get total count before pagination
    total = query.count()

    # Apply pagination and ordering
    suggestions = (
        query.order_by(MemorySuggestion.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return MemorySuggestionListResponse(data=suggestions, total=total)


@router.post(
    "/{agent_id}/suggestions",
    response_model=MemorySuggestionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_memory_suggestion(
    agent_id: UUID,
    data: MemorySuggestionCreate,
    deployment_id: Optional[UUID] = Query(
        None, description="ID of the deployment context"
    ),
    db: Session = Depends(get_db),
):
    """Create a memory suggestion (typically called by agent during conversation).

    This endpoint does not require user authentication as it's typically
    called by the agent runtime to propose memories for user approval.

    Args:
        agent_id: The agent's UUID.
        data: The suggestion data.
        deployment_id: Optional deployment context ID.
        db: Database session.

    Returns:
        The created memory suggestion.

    Raises:
        HTTPException: If agent not found.
    """
    # Verify agent exists
    agent = db.query(Agent).filter(
        Agent.id == agent_id, Agent.deleted_at.is_(None)
    ).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Create the suggestion
    suggestion = MemorySuggestion(
        agent_id=agent_id,
        deployment_id=deployment_id,
        suggested_name=data.suggested_name,
        suggested_content=data.suggested_content,
        suggested_type=data.suggested_type.value,
        source_message_id=data.source_message_id,
    )
    db.add(suggestion)
    db.commit()
    db.refresh(suggestion)

    return suggestion


@suggestions_router.patch(
    "/suggestions/{suggestion_id}",
    response_model=MemorySuggestionResponse,
)
async def review_memory_suggestion(
    suggestion_id: UUID,
    data: MemorySuggestionReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Approve or reject a memory suggestion.

    Args:
        suggestion_id: The suggestion's UUID.
        data: Review decision (approved or rejected).
        db: Database session.
        current_user: The authenticated user.

    Returns:
        The updated suggestion.

    Raises:
        HTTPException: If suggestion not found.
    """
    suggestion = db.query(MemorySuggestion).filter(
        MemorySuggestion.id == suggestion_id
    ).first()
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")

    # Update suggestion status
    suggestion.status = data.status.value
    suggestion.reviewed_at = datetime.utcnow()
    suggestion.reviewed_by = current_user.id

    db.commit()
    db.refresh(suggestion)

    return suggestion


@suggestions_router.delete(
    "/suggestions/{suggestion_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_memory_suggestion(
    suggestion_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a memory suggestion.

    Args:
        suggestion_id: The suggestion's UUID.
        db: Database session.
        current_user: The authenticated user.

    Raises:
        HTTPException: If suggestion not found.
    """
    suggestion = db.query(MemorySuggestion).filter(
        MemorySuggestion.id == suggestion_id
    ).first()
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")

    db.delete(suggestion)
    db.commit()
