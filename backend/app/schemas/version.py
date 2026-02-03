from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional
from app.models.agent import ChangeType
from app.models.component import ComponentType


class ComponentResponse(BaseModel):
    id: UUID
    type: ComponentType
    name: str
    description: Optional[str]
    content: Optional[str]
    source_path: Optional[str]

    class Config:
        from_attributes = True


class VersionResponse(BaseModel):
    id: UUID
    agent_id: UUID
    version_number: int
    change_type: ChangeType
    change_summary: Optional[str]
    created_by: UUID
    created_at: datetime
    components: list[ComponentResponse] = []

    class Config:
        from_attributes = True


class VersionListResponse(BaseModel):
    data: list[VersionResponse]
    total: int


class ComponentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None


class ComponentEditResponse(BaseModel):
    component: ComponentResponse
    new_version: VersionResponse


# Version Comparison Schemas

class ComponentDiff(BaseModel):
    """Represents a single component difference between versions."""
    name: str
    type: str
    change_type: str  # added, removed, modified
    content_a: Optional[str] = None
    content_b: Optional[str] = None


class VersionSummary(BaseModel):
    """Brief version info for comparison header."""
    id: UUID
    version_number: int
    change_type: str
    created_at: datetime


class DiffSummary(BaseModel):
    """Count of changes by type."""
    added: int = 0
    removed: int = 0
    modified: int = 0


class VersionCompareResponse(BaseModel):
    """Response for version comparison endpoint."""
    version_a: VersionSummary
    version_b: VersionSummary
    skills: list[ComponentDiff]
    mcp_tools: list[ComponentDiff]
    memory: list[ComponentDiff]
    agents: list[ComponentDiff]
    summary: dict[str, DiffSummary]
