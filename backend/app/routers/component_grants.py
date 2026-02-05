"""Component grants router for managing agent access to components."""

from datetime import datetime
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.component_registry import ComponentRegistry
from app.models.component_grant import ComponentGrant, ComponentAccessLevel
from app.schemas.grants import (
    ComponentGrantCreate,
    ComponentGrantUpdate,
    ComponentGrantResponse,
    ComponentGrantListResponse,
    GrantExtendRequest,
    GrantCheckResponse,
)
from app.dependencies import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/components/{component_id}/grants", tags=["component-grants"])


def get_component_or_404(component_id: UUID, db: Session) -> ComponentRegistry:
    """Get a component by ID or raise 404 if not found."""
    component = db.query(ComponentRegistry).filter(
        ComponentRegistry.id == component_id,
        ComponentRegistry.deleted_at.is_(None)
    ).first()
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")
    return component


@router.post("", response_model=ComponentGrantResponse, status_code=status.HTTP_201_CREATED)
def create_grant(
    component_id: UUID,
    data: ComponentGrantCreate,
    db: Session = Depends(get_db),
):
    """Grant an agent access to a component.

    Args:
        component_id: The component's UUID.
        data: Grant creation data (agent_id, access_level, expires_at).
        db: Database session.

    Returns:
        The created grant.

    Raises:
        HTTPException: If component not found or grant already exists.
    """
    component = get_component_or_404(component_id, db)

    # Check if grant already exists
    existing = db.query(ComponentGrant).filter(
        ComponentGrant.component_id == component_id,
        ComponentGrant.agent_id == data.agent_id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Grant already exists for this agent")

    grant = ComponentGrant(
        component_id=component_id,
        agent_id=data.agent_id,
        access_level=data.access_level,
        granted_by=component.owner_id,  # Use component owner as granter
        expires_at=data.expires_at,
    )
    db.add(grant)
    db.commit()
    db.refresh(grant)
    return grant


@router.get("", response_model=ComponentGrantListResponse)
def list_grants(component_id: UUID, db: Session = Depends(get_db)):
    """List all grants for a component.

    Args:
        component_id: The component's UUID.
        db: Database session.

    Returns:
        List of grants for the component.

    Raises:
        HTTPException: If the component is not found.
    """
    get_component_or_404(component_id, db)
    grants = db.query(ComponentGrant).filter(
        ComponentGrant.component_id == component_id
    ).all()
    return ComponentGrantListResponse(data=grants, total=len(grants))


@router.get("/check", response_model=GrantCheckResponse)
def check_access(
    component_id: UUID,
    agent_id: UUID,
    db: Session = Depends(get_db),
):
    """Check if an agent has active access to a component."""
    get_component_or_404(component_id, db)
    grant = db.query(ComponentGrant).filter(
        ComponentGrant.component_id == component_id,
        ComponentGrant.agent_id == agent_id,
    ).first()

    if not grant or not grant.is_active:
        return GrantCheckResponse(has_access=False)

    return GrantCheckResponse(
        has_access=True,
        access_level=grant.access_level,
        expires_at=grant.expires_at,
    )


@router.get("/{agent_id}", response_model=ComponentGrantResponse)
def get_grant(component_id: UUID, agent_id: UUID, db: Session = Depends(get_db)):
    """Get a specific grant for an agent.

    Args:
        component_id: The component's UUID.
        agent_id: The agent's UUID.
        db: Database session.

    Returns:
        The grant if found.

    Raises:
        HTTPException: If component or grant not found.
    """
    get_component_or_404(component_id, db)
    grant = db.query(ComponentGrant).filter(
        ComponentGrant.component_id == component_id,
        ComponentGrant.agent_id == agent_id,
    ).first()
    if not grant:
        raise HTTPException(status_code=404, detail="Grant not found")
    return grant


@router.patch("/{agent_id}", response_model=ComponentGrantResponse)
def update_grant(
    component_id: UUID,
    agent_id: UUID,
    data: ComponentGrantUpdate,
    db: Session = Depends(get_db),
):
    """Update an existing grant.

    Args:
        component_id: The component's UUID.
        agent_id: The agent's UUID.
        data: Update data (access_level, expires_at).
        db: Database session.

    Returns:
        The updated grant.

    Raises:
        HTTPException: If component or grant not found.
    """
    get_component_or_404(component_id, db)
    grant = db.query(ComponentGrant).filter(
        ComponentGrant.component_id == component_id,
        ComponentGrant.agent_id == agent_id,
    ).first()
    if not grant:
        raise HTTPException(status_code=404, detail="Grant not found")

    if data.access_level is not None:
        grant.access_level = data.access_level
    if data.expires_at is not None:
        grant.expires_at = data.expires_at

    db.commit()
    db.refresh(grant)
    return grant


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_grant(component_id: UUID, agent_id: UUID, db: Session = Depends(get_db)):
    """Revoke a grant (soft delete).

    Args:
        component_id: The component's UUID.
        agent_id: The agent's UUID to revoke.
        db: Database session.

    Raises:
        HTTPException: If component or grant not found.
    """
    get_component_or_404(component_id, db)
    grant = db.query(ComponentGrant).filter(
        ComponentGrant.component_id == component_id,
        ComponentGrant.agent_id == agent_id,
    ).first()
    if not grant:
        raise HTTPException(status_code=404, detail="Grant not found")

    grant.revoked_at = datetime.utcnow()
    db.commit()


@router.patch("/{agent_id}/extend", response_model=ComponentGrantResponse)
def extend_grant(
    component_id: UUID,
    agent_id: UUID,
    data: GrantExtendRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Extend a grant's expiration (component owner only)."""
    component = get_component_or_404(component_id, db)
    if component.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only component owner can extend grants")

    grant = db.query(ComponentGrant).filter(
        ComponentGrant.component_id == component_id,
        ComponentGrant.agent_id == agent_id,
    ).first()
    if not grant:
        raise HTTPException(status_code=404, detail="Grant not found")

    grant.expires_at = data.new_expires_at
    db.commit()
    db.refresh(grant)
    return grant
