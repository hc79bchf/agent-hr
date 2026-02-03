from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.agent_user_grant import AccessLevel
from app.models.component_grant import ComponentAccessLevel
from app.models.component_access_request import RequestStatus


class ComponentGrantCreate(BaseModel):
    """Schema for granting component access to an agent."""

    component_id: UUID
    agent_id: UUID
    access_level: ComponentAccessLevel = ComponentAccessLevel.VIEWER
    expires_at: Optional[datetime] = None


class ComponentGrantUpdate(BaseModel):
    """Schema for updating a component grant."""

    access_level: Optional[ComponentAccessLevel] = None
    expires_at: Optional[datetime] = None


class ComponentGrantResponse(BaseModel):
    """Response schema for component grants."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    component_id: UUID
    agent_id: UUID
    access_level: ComponentAccessLevel
    granted_by: UUID
    granted_at: datetime
    expires_at: Optional[datetime]
    revoked_at: Optional[datetime]
    is_active: bool


class ComponentGrantListResponse(BaseModel):
    """Schema for paginated component grant list response."""

    data: list[ComponentGrantResponse]
    total: int


class AgentUserGrantCreate(BaseModel):
    """Schema for granting user access to an agent."""

    user_id: UUID
    access_level: AccessLevel
    expires_at: Optional[datetime] = None


class AgentUserGrantResponse(BaseModel):
    """Response schema for agent user grants."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    agent_id: UUID
    user_id: UUID
    access_level: AccessLevel
    granted_by: UUID
    granted_at: datetime
    expires_at: Optional[datetime]
    revoked_at: Optional[datetime]
    is_active: bool


class AgentUserGrantListResponse(BaseModel):
    """Schema for paginated agent user grant list response."""

    data: list[AgentUserGrantResponse]
    total: int


class ComponentAccessRequestCreate(BaseModel):
    """Schema for creating a component access request."""

    component_id: UUID
    agent_id: UUID
    requested_level: ComponentAccessLevel

    def model_post_init(self, __context) -> None:
        """Validate that requested level is not VIEWER (default access)."""
        if self.requested_level == ComponentAccessLevel.VIEWER:
            raise ValueError("Cannot request VIEWER level - this is the default access")


class ComponentAccessRequestResolve(BaseModel):
    """Schema for resolving (approve/deny) an access request."""

    approve: bool
    denial_reason: Optional[str] = None

    def model_post_init(self, __context) -> None:
        """Validate that denial_reason is provided when denying."""
        if not self.approve and not self.denial_reason:
            raise ValueError("denial_reason is required when denying a request")


class ComponentAccessRequestResponse(BaseModel):
    """Response schema for component access requests."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    component_id: UUID
    agent_id: UUID
    agent_name: Optional[str] = None
    requested_level: ComponentAccessLevel
    requested_by: UUID
    requester_name: Optional[str] = None
    requested_at: datetime
    status: RequestStatus
    resolved_by: Optional[UUID]
    resolved_at: Optional[datetime]
    denial_reason: Optional[str]
    is_pending: bool


class ComponentAccessRequestListResponse(BaseModel):
    """Schema for paginated component access request list response."""

    data: list[ComponentAccessRequestResponse]
    total: int
