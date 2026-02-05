"""Component Registry router for managing components with access control."""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func as sa_func
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.component_registry import ComponentRegistry, ComponentSnapshot, ComponentType, ComponentVisibility, ComponentStatus, EntitlementType
from app.models.component_version import ComponentVersion
from app.schemas.component_registry import (
    ComponentRegistryCreate,
    ComponentRegistryUpdate,
    ComponentOwnershipUpdate,
    ComponentRegistryResponse,
    ComponentRegistryListResponse,
    ComponentSnapshotCreate,
    ComponentSnapshotResponse,
    ComponentSnapshotListResponse,
    ComponentPublishRequest,
    ComponentDeprecateRequest,
    ComponentVersionCreate,
    ComponentVersionResponse,
    ComponentVersionListResponse,
    ComponentChangelogResponse,
    ChangelogEntry,
    semver_gt,
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
    type: Optional[str] = Query(None, description="Filter by type: skill, tool, memory"),
    types: Optional[str] = Query(None, description="Comma-separated types: skill,tool"),
    visibility: Optional[str] = Query(None, pattern="^(private|organization|public)$"),
    owner_id: Optional[UUID] = None,
    organization_id: Optional[UUID] = None,
    search: Optional[str] = Query(None, description="Search by name or description"),
    tag: Optional[str] = Query(None, description="Filter by single tag"),
    tags: Optional[str] = Query(None, description="Comma-separated tags, matches ANY"),
    status: Optional[str] = Query(None, description="Filter by status: draft, published, deprecated, retired"),
    entitlement_type: Optional[str] = Query(None, description="Filter: open, request_required, restricted"),
    sort_by: str = Query("created_at", pattern="^(name|created_at|updated_at)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List components with faceted filtering, sorting, and pagination."""
    query = db.query(ComponentRegistry).filter(ComponentRegistry.deleted_at.is_(None))

    # Type filters
    if type:
        query = query.filter(ComponentRegistry.type == type)
    elif types:
        type_list = [t.strip() for t in types.split(",") if t.strip()]
        if type_list:
            query = query.filter(ComponentRegistry.type.in_(type_list))

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

    # Tag filters
    if tag:
        query = query.filter(ComponentRegistry.tags.any(tag))
    elif tags:
        tag_list = [t.strip() for t in tags.split(",") if t.strip()]
        if tag_list:
            query = query.filter(ComponentRegistry.tags.overlap(tag_list))

    # Status filter (default: show published + own drafts)
    if status:
        query = query.filter(ComponentRegistry.status == status)
    else:
        query = query.filter(
            (ComponentRegistry.status == ComponentStatus.PUBLISHED) |
            (ComponentRegistry.owner_id == current_user.id)
        )

    # Entitlement type filter
    if entitlement_type:
        query = query.filter(ComponentRegistry.entitlement_type == entitlement_type)

    total = query.count()

    # Dynamic sorting
    sort_column = getattr(ComponentRegistry, sort_by, ComponentRegistry.created_at)
    if sort_order == "asc":
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())

    components = query.offset(skip).limit(limit).all()
    enriched = [enrich_component(comp, db) for comp in components]
    return ComponentRegistryListResponse(data=enriched, total=total)


@router.get("/popular", response_model=ComponentRegistryListResponse)
async def list_popular(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List most popular published components by active grant count."""
    from app.models.component_grant import ComponentGrant

    grant_counts = (
        db.query(
            ComponentGrant.component_id,
            sa_func.count(ComponentGrant.id).label("grant_count")
        )
        .filter(ComponentGrant.revoked_at.is_(None))
        .group_by(ComponentGrant.component_id)
        .subquery()
    )

    components = (
        db.query(ComponentRegistry)
        .outerjoin(grant_counts, ComponentRegistry.id == grant_counts.c.component_id)
        .filter(
            ComponentRegistry.deleted_at.is_(None),
            ComponentRegistry.status == ComponentStatus.PUBLISHED,
        )
        .order_by(sa_func.coalesce(grant_counts.c.grant_count, 0).desc())
        .limit(limit)
        .all()
    )

    enriched = [enrich_component(comp, db) for comp in components]
    return ComponentRegistryListResponse(data=enriched, total=len(enriched))


@router.get("/recent", response_model=ComponentRegistryListResponse)
async def list_recent(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List most recently published components."""
    components = (
        db.query(ComponentRegistry)
        .filter(
            ComponentRegistry.deleted_at.is_(None),
            ComponentRegistry.status == ComponentStatus.PUBLISHED,
        )
        .order_by(ComponentRegistry.published_at.desc())
        .limit(limit)
        .all()
    )

    enriched = [enrich_component(comp, db) for comp in components]
    return ComponentRegistryListResponse(data=enriched, total=len(enriched))


@router.get("/mine", response_model=ComponentRegistryListResponse)
async def list_mine(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List components owned by current user (all statuses including drafts)."""
    query = (
        db.query(ComponentRegistry)
        .filter(
            ComponentRegistry.deleted_at.is_(None),
            ComponentRegistry.owner_id == current_user.id,
        )
        .order_by(ComponentRegistry.updated_at.desc())
    )

    total = query.count()
    components = query.offset(skip).limit(limit).all()
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
        status=data.status or ComponentStatus.DRAFT,
        entitlement_type=data.entitlement_type or EntitlementType.OPEN,
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


@router.post("/{component_id}/publish", response_model=ComponentRegistryResponse)
async def publish_component(
    component_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Publish a component to the marketplace (owner only).

    Component must have a description to be published.
    """
    component = db.query(ComponentRegistry).filter(
        ComponentRegistry.id == component_id,
        ComponentRegistry.deleted_at.is_(None)
    ).first()
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")

    if component.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can publish")

    if not component.description:
        raise HTTPException(status_code=400, detail="Component must have a description to publish")

    if component.status == ComponentStatus.PUBLISHED:
        raise HTTPException(status_code=400, detail="Component is already published")

    from datetime import datetime
    component.status = ComponentStatus.PUBLISHED
    component.published_at = datetime.utcnow()
    db.commit()
    db.refresh(component)
    return enrich_component(component, db)


@router.post("/{component_id}/deprecate", response_model=ComponentRegistryResponse)
async def deprecate_component(
    component_id: UUID,
    data: ComponentDeprecateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Deprecate a component (owner only)."""
    component = db.query(ComponentRegistry).filter(
        ComponentRegistry.id == component_id,
        ComponentRegistry.deleted_at.is_(None)
    ).first()
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")

    if component.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can deprecate")

    component.status = ComponentStatus.DEPRECATED
    component.deprecation_reason = data.reason
    db.commit()
    db.refresh(component)
    return enrich_component(component, db)


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


# ============== Version Endpoints ==============


def enrich_version(version: ComponentVersion, db: Session) -> dict:
    """Add creator info to version response."""
    creator_info = None
    if version.created_by:
        creator = db.query(User).filter(User.id == version.created_by).first()
        if creator:
            creator_info = UserInfo(id=creator.id, name=creator.name, email=creator.email)
    return {
        **{c.name: getattr(version, c.name) for c in version.__table__.columns},
        "creator": creator_info,
    }


@router.post("/{component_id}/versions", response_model=ComponentVersionResponse, status_code=status.HTTP_201_CREATED)
async def create_version(
    component_id: UUID,
    data: ComponentVersionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new version of a component (owner only).

    Snapshots current state and bumps version. New version must be greater than current.
    """
    component = db.query(ComponentRegistry).filter(
        ComponentRegistry.id == component_id,
        ComponentRegistry.deleted_at.is_(None)
    ).first()
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")
    if component.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can create versions")

    # Validate version is greater than current
    current_version = component.version or "0.0.0"
    if not semver_gt(data.version, current_version):
        raise HTTPException(
            status_code=400,
            detail=f"New version {data.version} must be greater than current {current_version}"
        )

    # Snapshot current state
    version = ComponentVersion(
        component_id=component_id,
        version=data.version,
        changelog=data.changelog,
        created_by=current_user.id,
        snapshot={
            "name": component.name,
            "description": component.description,
            "content": component.content,
            "tags": component.tags or [],
            "component_metadata": component.component_metadata or {},
        },
        parameters_schema_snapshot=component.parameters_schema,
    )
    db.add(version)

    # Update component version
    component.version = data.version
    db.commit()
    db.refresh(version)
    return enrich_version(version, db)


@router.get("/{component_id}/versions", response_model=ComponentVersionListResponse)
async def list_versions(
    component_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all versions of a component."""
    component = db.query(ComponentRegistry).filter(
        ComponentRegistry.id == component_id,
        ComponentRegistry.deleted_at.is_(None)
    ).first()
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")

    versions = db.query(ComponentVersion).filter(
        ComponentVersion.component_id == component_id
    ).order_by(ComponentVersion.created_at.desc()).all()

    enriched = [enrich_version(v, db) for v in versions]
    return ComponentVersionListResponse(data=enriched, total=len(enriched))


@router.get("/{component_id}/versions/latest", response_model=ComponentVersionResponse)
async def get_latest_version(
    component_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the latest version of a component."""
    component = db.query(ComponentRegistry).filter(
        ComponentRegistry.id == component_id,
        ComponentRegistry.deleted_at.is_(None)
    ).first()
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")

    version = db.query(ComponentVersion).filter(
        ComponentVersion.component_id == component_id
    ).order_by(ComponentVersion.created_at.desc()).first()
    if not version:
        raise HTTPException(status_code=404, detail="No versions found")
    return enrich_version(version, db)


@router.get("/{component_id}/versions/{version_string}", response_model=ComponentVersionResponse)
async def get_version(
    component_id: UUID,
    version_string: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific version of a component."""
    version = db.query(ComponentVersion).filter(
        ComponentVersion.component_id == component_id,
        ComponentVersion.version == version_string,
    ).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    return enrich_version(version, db)


@router.get("/{component_id}/changelog", response_model=ComponentChangelogResponse)
async def get_changelog(
    component_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get aggregated changelog for a component."""
    component = db.query(ComponentRegistry).filter(
        ComponentRegistry.id == component_id,
        ComponentRegistry.deleted_at.is_(None)
    ).first()
    if not component:
        raise HTTPException(status_code=404, detail="Component not found")

    versions = db.query(ComponentVersion).filter(
        ComponentVersion.component_id == component_id
    ).order_by(ComponentVersion.created_at.desc()).all()

    entries = [
        ChangelogEntry(version=v.version, changelog=v.changelog, created_at=v.created_at)
        for v in versions
    ]
    return ComponentChangelogResponse(component_id=component_id, entries=entries)
