from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class OrganizationCreate(BaseModel):
    """Schema for creating a new organization."""

    name: str
    parent_id: Optional[UUID] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class OrganizationUpdate(BaseModel):
    """Schema for updating an organization."""

    name: Optional[str] = None
    parent_id: Optional[UUID] = None
    metadata: Optional[dict[str, Any]] = None


class OrganizationResponse(BaseModel):
    """Schema for organization response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    parent_id: Optional[UUID]
    metadata: dict[str, Any] = Field(validation_alias="org_metadata")
    created_at: datetime
    updated_at: datetime


class OrganizationListResponse(BaseModel):
    """Schema for paginated organization list response."""

    data: list[OrganizationResponse]
    total: int
