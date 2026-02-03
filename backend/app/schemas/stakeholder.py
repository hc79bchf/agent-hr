from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.agent_stakeholder import StakeholderRole


class StakeholderCreate(BaseModel):
    """Schema for creating a new stakeholder relationship."""

    user_id: UUID
    role: StakeholderRole


class StakeholderUpdate(BaseModel):
    """Schema for updating a stakeholder's role."""

    role: StakeholderRole


class UserInfo(BaseModel):
    """Nested user information for stakeholder response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    email: str


class StakeholderResponse(BaseModel):
    """Schema for stakeholder response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    agent_id: UUID
    user_id: UUID
    role: StakeholderRole
    granted_by: UUID
    granted_at: datetime
    user: Optional[UserInfo] = None


class StakeholderListResponse(BaseModel):
    """Schema for paginated stakeholder list response."""

    data: list[StakeholderResponse]
    total: int
