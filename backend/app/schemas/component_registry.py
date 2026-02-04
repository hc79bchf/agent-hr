"""Schemas for ComponentRegistry - components with access control."""

from datetime import datetime
from typing import Optional, Dict, Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.component_registry import ComponentType, ComponentVisibility


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
