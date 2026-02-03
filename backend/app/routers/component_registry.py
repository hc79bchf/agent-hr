"""Component Registry router for managing components with access control."""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.component_registry import ComponentRegistry, ComponentSnapshot, ComponentType, ComponentVisibility
from app.schemas.component_registry import (
    ComponentRegistryCreate,
    ComponentRegistryUpdate,
    ComponentOwnershipUpdate,
    ComponentRegistryResponse,
    ComponentRegistryListResponse,
    ComponentSnapshotCreate,
    ComponentSnapshotResponse,
    ComponentSnapshotListResponse,
    UserInfo,
)

router = APIRouter(prefix="/api/component-registry", tags=["component-registry"])


def enrich_component(component: ComponentRegistry, db: Session) -> dict:
    """Add owner and manager info to component response."""
    owner = db.query(User).filter(User.id == component.owner_id).first()
    owner_info = None
    if owner:
        owner_info = UserInfo(id=owner.id, name=owner.name, email=owner.email)

    manager_info = None
    if component.manager_id:
        manager = db.query(User).filter(User.id == component.manager_id).first()
        if manager:
            manager_info = UserInfo(id=manager.id, name=manager.name, email=manager.email)

    return {
        **{c.name: getattr(component, c.name) for c in component.__table__.columns},
        "owner": owner_info,
        "manager": manager_info,
    }


@router.get("", response_model=ComponentRegistryListResponse)
async def list_components(
    type: Optional[str] = Query(None, pattern="^(skill|tool|memory)$"),
    visibility: Optional[str] = Query(None, pattern="^(private|organization|public)$"),
    owner_id: Optional[UUID] = None,
    organization_id: Optional[UUID] = None,
    search: Optional[str] = Query(None, description="Search by name or description"),
    tag: Optional[str] = Query(None, description="Filter by tag"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List components in the registry with optional filtering.

    Args:
        type: Filter by component type (skill, tool, memory).
        visibility: Filter by visibility level.
        owner_id: Filter by owner.
        organization_id: Filter by organization.
        search: Search by name or description.
        tag: Filter by tag.
        skip: Number of records to skip (pagination).
        limit: Maximum number of records to return.
    """
    query = db.query(ComponentRegistry).filter(ComponentRegistry.deleted_at.is_(None))

    if type:
        query = query.filter(ComponentRegistry.type == type)
    if visibility:
        query = query.filter(ComponentRegistry.visibility == visibility)
    if owner_id:
        query = query.filter(ComponentRegistry.owner_id == owner_id)
    if organization_id:
        query = query.filter(ComponentRegistry.organization_id == organization_id)
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (ComponentRegistry.name.ilike(search_pattern)) |
            (ComponentRegistry.description.ilike(search_pattern))
        )
    if tag:
        query = query.filter(ComponentRegistry.tags.any(tag))

    total = query.count()
    components = query.order_by(ComponentRegistry.created_at.desc()).offset(skip).limit(limit).all()

    enriched = [enrich_component(comp, db) for comp in components]
    return ComponentRegistryListResponse(data=enriched, total=total)


@router.post("", response_model=ComponentRegistryResponse, status_code=status.HTTP_201_CREATED)
async def create_component(
    data: ComponentRegistryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new component in the registry.

    The current user becomes the owner by default.
    """
    # Validate manager_id if provided
    if data.manager_id:
        manager = db.query(User).filter(User.id == data.manager_id).first()
        if not manager:
            raise HTTPException(status_code=400, detail="Manager user not found")

    component = ComponentRegistry(
        type=data.type,
        name=data.name,
        description=data.description,
        content=data.content,
        tags=data.tags or [],
        owner_id=current_user.id,
        organization_id=data.organization_id,
        manager_id=data.manager_id,
        visibility=data.visibility,
        component_metadata=data.component_metadata,
    )
    db.add(component)
    db.commit()
    db.refresh(component)
    return enrich_component(component, db)


@router.get("/{component_id}", response_model=ComponentRegistryResponse)
async def get_component(
    component_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific component by ID."""
    component = db.query(ComponentRegistry).filter(
        ComponentRegistry.id == component_id,
        ComponentRegistry.deleted_at.is_(None)
    ).first()
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")
    return enrich_component(component, db)


@router.patch("/{component_id}", response_model=ComponentRegistryResponse)
async def update_component(
    component_id: UUID,
    data: ComponentRegistryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a component (owner or manager only)."""
    component = db.query(ComponentRegistry).filter(
        ComponentRegistry.id == component_id,
        ComponentRegistry.deleted_at.is_(None)
    ).first()
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")

    # Only owner or manager can update
    if component.owner_id != current_user.id and component.manager_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner or manager can update this component")

    # Validate manager_id if being updated
    if data.manager_id is not None:
        manager = db.query(User).filter(User.id == data.manager_id).first()
        if not manager:
            raise HTTPException(status_code=400, detail="Manager user not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(component, field, value)

    db.commit()
    db.refresh(component)
    return enrich_component(component, db)


@router.patch("/{component_id}/ownership", response_model=ComponentRegistryResponse)
async def update_ownership(
    component_id: UUID,
    data: ComponentOwnershipUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update component ownership (owner only can transfer ownership).

    Note: manager_id can be updated by either owner or current manager.
    """
    component = db.query(ComponentRegistry).filter(
        ComponentRegistry.id == component_id,
        ComponentRegistry.deleted_at.is_(None)
    ).first()
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")

    # Only owner can transfer ownership
    if data.owner_id is not None and component.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can transfer ownership")

    # Owner or manager can update manager
    if data.manager_id is not None:
        if component.owner_id != current_user.id and component.manager_id != current_user.id:
            raise HTTPException(status_code=403, detail="Only owner or manager can assign a new manager")

    # Validate new owner if provided
    if data.owner_id is not None:
        new_owner = db.query(User).filter(User.id == data.owner_id).first()
        if not new_owner:
            raise HTTPException(status_code=400, detail="New owner user not found")
        component.owner_id = data.owner_id

    # Validate new manager if provided
    if data.manager_id is not None:
        if data.manager_id != UUID(int=0):  # Allow setting to null with zero UUID
            new_manager = db.query(User).filter(User.id == data.manager_id).first()
            if not new_manager:
                raise HTTPException(status_code=400, detail="New manager user not found")
            component.manager_id = data.manager_id
        else:
            component.manager_id = None

    db.commit()
    db.refresh(component)
    return enrich_component(component, db)


@router.delete("/{component_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_component(
    component_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Soft delete a component (owner only)."""
    component = db.query(ComponentRegistry).filter(
        ComponentRegistry.id == component_id,
        ComponentRegistry.deleted_at.is_(None)
    ).first()
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")

    # Only owner can delete
    if component.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can delete this component")

    from datetime import datetime
    component.deleted_at = datetime.utcnow()
    db.commit()


def enrich_snapshot(snapshot: ComponentSnapshot, db: Session) -> dict:
    """Add creator info to snapshot response."""
    creator_info = None
    if snapshot.created_by:
        creator = db.query(User).filter(User.id == snapshot.created_by).first()
        if creator:
            creator_info = UserInfo(id=creator.id, name=creator.name, email=creator.email)

    return {
        **{c.name: getattr(snapshot, c.name) for c in snapshot.__table__.columns},
        "creator": creator_info,
    }


# ============== Snapshot Endpoints ==============


@router.get("/{component_id}/snapshots", response_model=ComponentSnapshotListResponse)
async def list_snapshots(
    component_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all snapshots for a component (owner only)."""
    component = db.query(ComponentRegistry).filter(
        ComponentRegistry.id == component_id,
        ComponentRegistry.deleted_at.is_(None)
    ).first()
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")

    # Only owner can view snapshots
    if component.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can view snapshots")

    snapshots = db.query(ComponentSnapshot).filter(
        ComponentSnapshot.component_id == component_id
    ).order_by(ComponentSnapshot.created_at.desc()).all()

    enriched = [enrich_snapshot(snap, db) for snap in snapshots]
    return ComponentSnapshotListResponse(data=enriched, total=len(enriched))


@router.post("/{component_id}/snapshots", response_model=ComponentSnapshotResponse, status_code=status.HTTP_201_CREATED)
async def create_snapshot(
    component_id: UUID,
    data: ComponentSnapshotCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a snapshot of the current component state (owner only)."""
    component = db.query(ComponentRegistry).filter(
        ComponentRegistry.id == component_id,
        ComponentRegistry.deleted_at.is_(None)
    ).first()
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")

    # Only owner can create snapshots
    if component.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can create snapshots")

    snapshot = ComponentSnapshot(
        component_id=component_id,
        version_label=data.version_label,
        name=component.name,
        description=component.description,
        content=component.content,
        tags=component.tags or [],
        component_metadata=component.component_metadata or {},
        created_by=current_user.id,
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return enrich_snapshot(snapshot, db)


@router.get("/{component_id}/snapshots/{snapshot_id}", response_model=ComponentSnapshotResponse)
async def get_snapshot(
    component_id: UUID,
    snapshot_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific snapshot (owner only)."""
    component = db.query(ComponentRegistry).filter(
        ComponentRegistry.id == component_id,
        ComponentRegistry.deleted_at.is_(None)
    ).first()
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")

    # Only owner can view snapshots
    if component.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can view snapshots")

    snapshot = db.query(ComponentSnapshot).filter(
        ComponentSnapshot.id == snapshot_id,
        ComponentSnapshot.component_id == component_id
    ).first()
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")

    return enrich_snapshot(snapshot, db)


@router.post("/{component_id}/snapshots/{snapshot_id}/restore", response_model=ComponentRegistryResponse)
async def restore_snapshot(
    component_id: UUID,
    snapshot_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Restore a component to a previous snapshot state (owner only).

    This overwrites the component's current content with the snapshot's content.
    """
    component = db.query(ComponentRegistry).filter(
        ComponentRegistry.id == component_id,
        ComponentRegistry.deleted_at.is_(None)
    ).first()
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")

    # Only owner can restore snapshots
    if component.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can restore snapshots")

    snapshot = db.query(ComponentSnapshot).filter(
        ComponentSnapshot.id == snapshot_id,
        ComponentSnapshot.component_id == component_id
    ).first()
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")

    # Restore component fields from snapshot
    component.name = snapshot.name
    component.description = snapshot.description
    component.content = snapshot.content
    component.tags = snapshot.tags or []
    component.component_metadata = snapshot.component_metadata or {}

    db.commit()
    db.refresh(component)
    return enrich_component(component, db)


@router.delete("/{component_id}/snapshots/{snapshot_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_snapshot(
    component_id: UUID,
    snapshot_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a snapshot (owner only)."""
    component = db.query(ComponentRegistry).filter(
        ComponentRegistry.id == component_id,
        ComponentRegistry.deleted_at.is_(None)
    ).first()
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")

    # Only owner can delete snapshots
    if component.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can delete snapshots")

    snapshot = db.query(ComponentSnapshot).filter(
        ComponentSnapshot.id == snapshot_id,
        ComponentSnapshot.component_id == component_id
    ).first()
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")

    db.delete(snapshot)
    db.commit()
