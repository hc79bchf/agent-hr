"""Component Library router for managing shared components across agents."""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.agent import Agent, AgentVersion
from app.models.component import Component, ComponentType
from app.models.library import ComponentLibrary, AgentLibraryRef
from app.schemas.agent import AuthorInfo
from app.schemas.library import (
    LibraryComponentCreate,
    LibraryComponentUpdate,
    LibraryComponentResponse,
    LibraryComponentListResponse,
    LibraryComponentBatchCreate,
    LibraryComponentBatchResponse,
    AgentLibraryRefCreate,
    AgentLibraryRefResponse,
    AgentLibraryRefsResponse,
    PublishToLibraryRequest,
    PublishToLibraryResponse,
)

router = APIRouter(prefix="/api", tags=["library"])


def enrich_library_component(component: ComponentLibrary, db: Session) -> dict:
    """Add author info to library component response."""
    author = db.query(User).filter(User.id == component.author_id).first()
    author_info = None
    if author:
        author_info = AuthorInfo(id=author.id, name=author.name, email=author.email)

    return {
        **{c.name: getattr(component, c.name) for c in component.__table__.columns},
        "author": author_info,
    }


# =============================================================================
# Library CRUD Endpoints
# =============================================================================

@router.get("/library", response_model=LibraryComponentListResponse)
async def list_library_components(
    type: Optional[str] = Query(None, pattern="^(skill|mcp_tool|memory)$"),
    search: Optional[str] = None,
    tag: Optional[str] = None,
    author_id: Optional[UUID] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List library components with optional filtering.

    Args:
        type: Filter by component type (skill, mcp_tool, memory).
        search: Search by name or description (case-insensitive).
        tag: Filter by specific tag.
        author_id: Filter by author.
        skip: Number of records to skip (pagination).
        limit: Maximum number of records to return.
    """
    query = db.query(ComponentLibrary)

    if type:
        query = query.filter(ComponentLibrary.type == type)
    if tag:
        query = query.filter(ComponentLibrary.tags.any(tag))
    if author_id:
        query = query.filter(ComponentLibrary.author_id == author_id)
    if search:
        search_filter = or_(
            ComponentLibrary.name.ilike(f"%{search}%"),
            ComponentLibrary.description.ilike(f"%{search}%"),
        )
        query = query.filter(search_filter)

    total = query.count()
    components = query.order_by(ComponentLibrary.created_at.desc()).offset(skip).limit(limit).all()

    enriched = [enrich_library_component(comp, db) for comp in components]
    return LibraryComponentListResponse(data=enriched, total=total)


@router.post("/library", response_model=LibraryComponentResponse, status_code=status.HTTP_201_CREATED)
async def create_library_component(
    data: LibraryComponentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new component in the library.

    Args:
        data: Component data.
    """
    component = ComponentLibrary(
        type=data.type,
        name=data.name,
        description=data.description,
        content=data.content,
        config=data.config,
        tags=data.tags,
        author_id=current_user.id,
    )
    db.add(component)
    db.commit()
    db.refresh(component)
    return enrich_library_component(component, db)


@router.post("/library/batch", response_model=LibraryComponentBatchResponse, status_code=status.HTTP_201_CREATED)
async def create_library_components_batch(
    data: LibraryComponentBatchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create multiple components in the library at once.

    Args:
        data: Batch of component data.

    Returns:
        List of created components with success/failure status.
    """
    created = []
    failed = []

    for item in data.components:
        try:
            component = ComponentLibrary(
                type=item.type,
                name=item.name,
                description=item.description,
                content=item.content,
                config=item.config,
                tags=item.tags,
                author_id=current_user.id,
            )
            db.add(component)
            db.flush()  # Get the ID without committing
            created.append(enrich_library_component(component, db))
        except ValueError as e:
            # Validation errors - safe to expose
            failed.append({"name": item.name, "error": str(e)})
        except Exception:
            # Other errors - don't expose internal details
            failed.append({"name": item.name, "error": "Failed to create component"})

    db.commit()

    return LibraryComponentBatchResponse(
        created=created,
        failed=failed,
        total_created=len(created),
        total_failed=len(failed),
    )


@router.get("/library/{component_id}", response_model=LibraryComponentResponse)
async def get_library_component(
    component_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific library component by ID."""
    component = db.query(ComponentLibrary).filter(
        ComponentLibrary.id == component_id
    ).first()
    if not component:
        raise HTTPException(status_code=404, detail="Library component not found")
    return enrich_library_component(component, db)


@router.patch("/library/{component_id}", response_model=LibraryComponentResponse)
async def update_library_component(
    component_id: UUID,
    data: LibraryComponentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a library component (author only)."""
    component = db.query(ComponentLibrary).filter(
        ComponentLibrary.id == component_id
    ).first()
    if not component:
        raise HTTPException(status_code=404, detail="Library component not found")

    # Only author can update
    if component.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the author can update this component")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(component, field, value)

    db.commit()
    db.refresh(component)
    return enrich_library_component(component, db)


@router.delete("/library/{component_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_library_component(
    component_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a library component (author only).

    This will also remove all agent references to this component.
    """
    component = db.query(ComponentLibrary).filter(
        ComponentLibrary.id == component_id
    ).first()
    if not component:
        raise HTTPException(status_code=404, detail="Library component not found")

    # Only author can delete
    if component.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the author can delete this component")

    db.delete(component)
    db.commit()


# =============================================================================
# Agent Library Reference Endpoints
# =============================================================================

@router.get("/agents/{agent_id}/library-refs", response_model=AgentLibraryRefsResponse)
async def list_agent_library_refs(
    agent_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List library components referenced by an agent."""
    # Verify agent exists
    agent = db.query(Agent).filter(
        Agent.id == agent_id,
        Agent.deleted_at.is_(None)
    ).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    refs = db.query(AgentLibraryRef).filter(
        AgentLibraryRef.agent_id == agent_id
    ).all()

    # Enrich with library component details
    enriched_refs = []
    for ref in refs:
        library_comp = db.query(ComponentLibrary).filter(
            ComponentLibrary.id == ref.library_component_id
        ).first()
        enriched_refs.append({
            "id": ref.id,
            "agent_id": ref.agent_id,
            "library_component_id": ref.library_component_id,
            "library_component": enrich_library_component(library_comp, db) if library_comp else None,
            "added_at": ref.added_at,
            "added_by": ref.added_by,
        })

    return AgentLibraryRefsResponse(data=enriched_refs, total=len(enriched_refs))


@router.post("/agents/{agent_id}/library-refs", response_model=AgentLibraryRefResponse, status_code=status.HTTP_201_CREATED)
async def add_library_ref_to_agent(
    agent_id: UUID,
    data: AgentLibraryRefCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a library component reference to an agent."""
    # Verify agent exists
    agent = db.query(Agent).filter(
        Agent.id == agent_id,
        Agent.deleted_at.is_(None)
    ).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Verify library component exists
    library_comp = db.query(ComponentLibrary).filter(
        ComponentLibrary.id == data.library_component_id
    ).first()
    if not library_comp:
        raise HTTPException(status_code=404, detail="Library component not found")

    # Check if reference already exists
    existing_ref = db.query(AgentLibraryRef).filter(
        AgentLibraryRef.agent_id == agent_id,
        AgentLibraryRef.library_component_id == data.library_component_id
    ).first()
    if existing_ref:
        raise HTTPException(status_code=400, detail="Agent already references this library component")

    # Create reference
    ref = AgentLibraryRef(
        agent_id=agent_id,
        library_component_id=data.library_component_id,
        added_by=current_user.id,
    )
    db.add(ref)

    # Increment usage count
    library_comp.usage_count += 1

    db.commit()
    db.refresh(ref)

    return AgentLibraryRefResponse(
        id=ref.id,
        agent_id=ref.agent_id,
        library_component_id=ref.library_component_id,
        library_component=enrich_library_component(library_comp, db),
        added_at=ref.added_at,
        added_by=ref.added_by,
    )


@router.delete("/agents/{agent_id}/library-refs/{ref_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_library_ref_from_agent(
    agent_id: UUID,
    ref_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a library component reference from an agent."""
    # Verify agent exists
    agent = db.query(Agent).filter(
        Agent.id == agent_id,
        Agent.deleted_at.is_(None)
    ).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Find and delete the reference
    ref = db.query(AgentLibraryRef).filter(
        AgentLibraryRef.id == ref_id,
        AgentLibraryRef.agent_id == agent_id
    ).first()
    if not ref:
        raise HTTPException(status_code=404, detail="Library reference not found")

    # Decrement usage count
    library_comp = db.query(ComponentLibrary).filter(
        ComponentLibrary.id == ref.library_component_id
    ).first()
    if library_comp and library_comp.usage_count > 0:
        library_comp.usage_count -= 1

    db.delete(ref)
    db.commit()


# =============================================================================
# Publish Component to Library
# =============================================================================

@router.post(
    "/versions/{version_id}/components/{component_id}/publish",
    response_model=PublishToLibraryResponse,
    status_code=status.HTTP_201_CREATED,
)
async def publish_component_to_library(
    version_id: UUID,
    component_id: UUID,
    data: PublishToLibraryRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Publish an agent's component to the library.

    This copies the component to the library, making it available for
    other agents to reference.
    """
    # Find the component
    component = db.query(Component).filter(
        Component.id == component_id,
        Component.version_id == version_id
    ).first()
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")

    # Verify version belongs to a valid agent
    version = db.query(AgentVersion).filter(AgentVersion.id == version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    agent = db.query(Agent).filter(
        Agent.id == version.agent_id,
        Agent.deleted_at.is_(None)
    ).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    # Create library component
    library_comp = ComponentLibrary(
        type=component.type.value,
        name=data.name or component.name,
        description=data.description or component.description,
        content=component.content,
        config=component.config or {},
        source_path=component.source_path,
        author_id=current_user.id,
        tags=data.tags,
    )
    db.add(library_comp)
    db.commit()
    db.refresh(library_comp)

    return PublishToLibraryResponse(
        library_component=enrich_library_component(library_comp, db),
        message=f"Component '{library_comp.name}' published to library successfully",
    )
