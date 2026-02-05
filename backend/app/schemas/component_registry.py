"""Schemas for ComponentRegistry - components with access control."""

import re
from datetime import datetime
from typing import Optional, Dict, Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.component_registry import ComponentType, ComponentVisibility, ComponentStatus, EntitlementType

SEMVER_PATTERN = re.compile(r'^\d+\.\d+\.\d+$')


def validate_semver(v: str) -> str:
    if not SEMVER_PATTERN.match(v):
        raise ValueError("Version must be semver format: X.Y.Z")
    return v


def semver_gt(new: str, current: str) -> bool:
    """Return True if new > current in semver comparison."""
    return tuple(int(x) for x in new.split('.')) > tuple(int(x) for x in current.split('.'))


class UserInfo(BaseModel):
    """Basic user info for embedding in responses."""

    id: UUID
    name: str
    email: str


class ComponentRegistryCreate(BaseModel):
    """Schema for creating a component in the registry."""

    type: ComponentType
    name: str
    description: Optional[str] = None
    content: Optional[str] = None
    tags: list[str] = []
    organization_id: Optional[UUID] = None
    manager_id: Optional[UUID] = None
    visibility: ComponentVisibility = ComponentVisibility.PRIVATE
    component_metadata: Dict[str, Any] = {}
    status: Optional[ComponentStatus] = None  # Defaults to DRAFT in model
    entitlement_type: Optional[EntitlementType] = None  # Defaults to OPEN in model


class ComponentRegistryUpdate(BaseModel):
    """Schema for updating a component in the registry."""

    name: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[list[str]] = None
    manager_id: Optional[UUID] = None
    visibility: Optional[ComponentVisibility] = None
    component_metadata: Optional[Dict[str, Any]] = None


class ComponentOwnershipUpdate(BaseModel):
    """Schema for updating component ownership (owner or manager)."""

    owner_id: Optional[UUID] = None
    manager_id: Optional[UUID] = None


class ComponentRegistryResponse(BaseModel):
    """Response schema for component registry entries."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    type: ComponentType
    name: str
    description: Optional[str] = None
    content: Optional[str] = None
    tags: list[str] = []
    owner_id: UUID
    organization_id: Optional[UUID]
    manager_id: Optional[UUID]
    visibility: ComponentVisibility
    component_metadata: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    status: Optional[ComponentStatus] = None
    published_at: Optional[datetime] = None
    deprecation_reason: Optional[str] = None
    entitlement_type: Optional[EntitlementType] = None
    grant_count: Optional[int] = None
    active_request_count: Optional[int] = None
    version: Optional[str] = None
    # Enriched fields
    owner: Optional[UserInfo] = None
    manager: Optional[UserInfo] = None


class ComponentRegistryListResponse(BaseModel):
    """Schema for paginated component registry list response."""

    data: list[ComponentRegistryResponse]
    total: int


# Snapshot schemas
class ComponentSnapshotCreate(BaseModel):
    """Schema for creating a component snapshot."""

    version_label: str


class ComponentSnapshotResponse(BaseModel):
    """Response schema for component snapshots."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    component_id: UUID
    version_label: str
    name: str
    description: Optional[str] = None
    content: Optional[str] = None
    tags: list[str] = []
    component_metadata: Dict[str, Any]
    created_by: UUID
    created_at: datetime
    # Enriched field
    creator: Optional[UserInfo] = None


class ComponentSnapshotListResponse(BaseModel):
    """Schema for paginated snapshot list response."""

    data: list[ComponentSnapshotResponse]
    total: int


class ComponentPublishRequest(BaseModel):
    """No body needed - just POST to publish."""
    pass


class ComponentDeprecateRequest(BaseModel):
    """Schema for deprecating a component."""
    reason: Optional[str] = None


class ComponentVersionCreate(BaseModel):
    """Schema for creating a new component version."""
    version: str
    changelog: Optional[str] = None

    @field_validator("version")
    @classmethod
    def check_semver(cls, v: str) -> str:
        return validate_semver(v)


class ComponentVersionResponse(BaseModel):
    """Response schema for component versions."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    component_id: UUID
    version: str
    changelog: Optional[str] = None
    created_by: UUID
    created_at: datetime
    creator: Optional[UserInfo] = None


class ComponentVersionListResponse(BaseModel):
    """Schema for paginated version list."""
    data: list[ComponentVersionResponse]
    total: int


class ChangelogEntry(BaseModel):
    """A single changelog entry."""
    version: str
    changelog: Optional[str] = None
    created_at: datetime


class ComponentChangelogResponse(BaseModel):
    """Aggregated changelog across versions."""
    component_id: UUID
    entries: list[ChangelogEntry]
