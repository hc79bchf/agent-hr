"""Router for managing agent-component registry references."""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.agent import Agent
from app.models.component_registry import ComponentRegistry, AgentRegistryRef
from app.models.component_grant import ComponentGrant, ComponentAccessLevel


router = APIRouter(prefix="/api/agents/{agent_id}/registry-refs", tags=["agent-registry-refs"])


class AgentRegistryRefCreate(BaseModel):
    """Schema for creating an agent registry reference."""
    registry_component_id: UUID


class RegistryComponentInfo(BaseModel):
    """Embedded component info for responses."""
    id: UUID
    type: str
    name: str
    description: str | None = None
    tags: list[str] = []

    class Config:
        from_attributes = True


class AgentRegistryRefResponse(BaseModel):
    """Response schema for agent registry references."""
    id: UUID
    agent_id: UUID
    registry_component_id: UUID
    added_at: datetime
    added_by: UUID | None = None
    registry_component: RegistryComponentInfo | None = None

    class Config:
        from_attributes = True


class AgentRegistryRefListResponse(BaseModel):
    """Response schema for list of agent registry references."""
    data: list[AgentRegistryRefResponse]
    total: int


class AgentComponentGrantResponse(BaseModel):
    """Response schema for agent component grants."""
    id: UUID
    component_id: UUID
    agent_id: UUID
    access_level: str
    granted_at: datetime
    is_active: bool

    class Config:
        from_attributes = True


class AgentComponentGrantsListResponse(BaseModel):
    """Response schema for list of agent component grants."""
    data: list[AgentComponentGrantResponse]
    total: int


def get_agent_or_404(agent_id: UUID, db: Session) -> Agent:
    """Get an agent by ID or raise 404."""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


def get_component_or_404(component_id: UUID, db: Session) -> ComponentRegistry:
    """Get a component by ID or raise 404."""
    component = db.query(ComponentRegistry).filter(
        ComponentRegistry.id == component_id,
        ComponentRegistry.deleted_at.is_(None)
    ).first()
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")
    return component


@router.get("", response_model=AgentRegistryRefListResponse)
def list_agent_registry_refs(agent_id: UUID, db: Session = Depends(get_db)):
    """List all registry component references for an agent.

    Args:
        agent_id: The agent's UUID.
        db: Database session.

    Returns:
        List of registry references with component info.
    """
    get_agent_or_404(agent_id, db)

    refs = db.query(AgentRegistryRef).filter(
        AgentRegistryRef.agent_id == agent_id
    ).all()

    # Enrich with component info
    result = []
    for ref in refs:
        component = db.query(ComponentRegistry).filter(
            ComponentRegistry.id == ref.registry_component_id
        ).first()

        ref_data = {
            "id": ref.id,
            "agent_id": ref.agent_id,
            "registry_component_id": ref.registry_component_id,
            "added_at": ref.added_at,
            "added_by": ref.added_by,
            "registry_component": {
                "id": component.id,
                "type": component.type.value if component else "unknown",
                "name": component.name if component else "Unknown",
                "description": component.description if component else None,
                "tags": component.tags if component else [],
            } if component else None
        }
        result.append(ref_data)

    return AgentRegistryRefListResponse(data=result, total=len(result))


@router.post("", response_model=AgentRegistryRefResponse, status_code=status.HTTP_201_CREATED)
def add_registry_ref(
    agent_id: UUID,
    data: AgentRegistryRefCreate,
    db: Session = Depends(get_db),
):
    """Add a registry component reference to an agent.

    Args:
        agent_id: The agent's UUID.
        data: Request data with registry_component_id.
        db: Database session.

    Returns:
        The created reference.

    Raises:
        HTTPException: If agent/component not found or already linked.
    """
    get_agent_or_404(agent_id, db)
    component = get_component_or_404(data.registry_component_id, db)

    # Check if already linked
    existing = db.query(AgentRegistryRef).filter(
        AgentRegistryRef.agent_id == agent_id,
        AgentRegistryRef.registry_component_id == data.registry_component_id,
    ).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail="Component is already linked to this agent"
        )

    ref = AgentRegistryRef(
        agent_id=agent_id,
        registry_component_id=data.registry_component_id,
    )
    db.add(ref)
    db.commit()
    db.refresh(ref)

    return AgentRegistryRefResponse(
        id=ref.id,
        agent_id=ref.agent_id,
        registry_component_id=ref.registry_component_id,
        added_at=ref.added_at,
        added_by=ref.added_by,
        registry_component={
            "id": component.id,
            "type": component.type.value,
            "name": component.name,
            "description": component.description,
            "tags": component.tags or [],
        }
    )


@router.delete("/{ref_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_registry_ref(
    agent_id: UUID,
    ref_id: UUID,
    db: Session = Depends(get_db),
):
    """Remove a registry component reference from an agent.

    Args:
        agent_id: The agent's UUID.
        ref_id: The reference's UUID.
        db: Database session.

    Raises:
        HTTPException: If reference not found.
    """
    ref = db.query(AgentRegistryRef).filter(
        AgentRegistryRef.id == ref_id,
        AgentRegistryRef.agent_id == agent_id,
    ).first()
    if not ref:
        raise HTTPException(status_code=404, detail="Reference not found")

    db.delete(ref)
    db.commit()


# Create a separate router for agent grants (different prefix)
grants_router = APIRouter(prefix="/api/agents/{agent_id}/component-grants", tags=["agent-component-grants"])


@grants_router.get("", response_model=AgentComponentGrantsListResponse)
def list_agent_component_grants(agent_id: UUID, db: Session = Depends(get_db)):
    """List all component grants for an agent.

    Returns grants that give this agent access to components in the registry.
    Used to determine which components the agent can add/use vs view-only.

    Args:
        agent_id: The agent's UUID.
        db: Database session.

    Returns:
        List of component grants for the agent.
    """
    get_agent_or_404(agent_id, db)

    grants = db.query(ComponentGrant).filter(
        ComponentGrant.agent_id == agent_id,
        ComponentGrant.revoked_at.is_(None),
    ).all()

    # Build response with is_active computed
    result = []
    for grant in grants:
        result.append({
            "id": grant.id,
            "component_id": grant.component_id,
            "agent_id": grant.agent_id,
            "access_level": grant.access_level.value if hasattr(grant.access_level, 'value') else grant.access_level,
            "granted_at": grant.granted_at,
            "is_active": grant.is_active,
        })

    return AgentComponentGrantsListResponse(data=result, total=len(result))
