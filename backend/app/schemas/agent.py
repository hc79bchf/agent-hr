from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional
from app.models.agent import AgentStatus


class AgentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    tags: list[str] = []
    department: Optional[str] = None
    usage_notes: Optional[str] = None


class AgentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[AgentStatus] = None
    tags: Optional[list[str]] = None
    department: Optional[str] = None
    usage_notes: Optional[str] = None
    organization_id: Optional[UUID] = None
    manager_id: Optional[UUID] = None


class AuthorInfo(BaseModel):
    """Nested author information."""
    id: UUID
    name: str
    email: str

    class Config:
        from_attributes = True


class OrganizationInfo(BaseModel):
    """Nested organization information."""
    id: UUID
    name: str

    class Config:
        from_attributes = True


class ManagerInfo(BaseModel):
    """Nested manager information."""
    id: UUID
    name: str
    email: str

    class Config:
        from_attributes = True


class AgentResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    author_id: UUID
    author: Optional[AuthorInfo] = None
    current_version_id: Optional[UUID]
    status: AgentStatus
    tags: list[str]
    department: Optional[str]
    usage_notes: Optional[str]
    organization_id: Optional[UUID] = None
    organization: Optional[OrganizationInfo] = None
    manager_id: Optional[UUID] = None
    manager: Optional[ManagerInfo] = None
    version_count: int = 0
    is_running: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AgentListResponse(BaseModel):
    data: list[AgentResponse]
    total: int
