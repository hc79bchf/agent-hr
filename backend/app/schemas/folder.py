"""Pydantic schemas for component folders."""
from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional


class ComponentFolderBase(BaseModel):
    """Base schema for component folders."""
    type: str  # 'skill', 'mcp_tool', 'memory', 'agent'
    name: str
    description: Optional[str] = None
    source_path: Optional[str] = None


class ComponentFolderCreate(ComponentFolderBase):
    """Schema for creating a component folder."""
    pass


class ComponentFolderUpdate(BaseModel):
    """Schema for updating a component folder."""
    name: Optional[str] = None
    description: Optional[str] = None


class ComponentInFolder(BaseModel):
    """Minimal component info for folder detail view."""
    id: UUID
    name: str
    description: Optional[str]
    source_path: Optional[str]
    memory_type: Optional[str] = None

    class Config:
        from_attributes = True


class ComponentFolderResponse(BaseModel):
    """Response schema for a component folder."""
    id: UUID
    version_id: UUID
    type: str
    name: str
    description: Optional[str]
    source_path: Optional[str]
    file_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ComponentFolderDetailResponse(ComponentFolderResponse):
    """Response schema for folder detail with components."""
    components: list[ComponentInFolder] = []


class FolderListResponse(BaseModel):
    """Response for listing folders."""
    data: list[ComponentFolderResponse]
    total: int


class FoldersByTypeResponse(BaseModel):
    """Response for folders grouped by type."""
    skills: list[ComponentFolderResponse] = []
    mcp_tools: list[ComponentFolderResponse] = []
    memory: list[ComponentFolderResponse] = []
    agents: list[ComponentFolderResponse] = []
