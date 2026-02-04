"""Pydantic schemas for the component library."""

from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional
from app.schemas.agent import AuthorInfo


class LibraryComponentCreate(BaseModel):
    """Request body for creating a library component."""
    type: str = Field(..., pattern="^(skill|mcp_tool|memory)$")
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    content: Optional[str] = None
    config: dict = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)


class LibraryComponentUpdate(BaseModel):
    """Request body for updating a library component."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    content: Optional[str] = None
    config: Optional[dict] = None
    tags: Optional[list[str]] = None


class LibraryComponentResponse(BaseModel):
    """Response for a library component."""
    id: UUID
    type: str
    name: str
    description: Optional[str]
    content: Optional[str]
    config: dict
    source_path: Optional[str]
    author_id: UUID
    author: Optional[AuthorInfo] = None
    tags: list[str]
    usage_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LibraryComponentListResponse(BaseModel):
    """Paginated list of library components."""
    data: list[LibraryComponentResponse]
    total: int


class AgentLibraryRefCreate(BaseModel):
    """Request body for adding a library component to an agent."""
    library_component_id: UUID


class AgentLibraryRefResponse(BaseModel):
    """Response for an agent-library reference."""
    id: UUID
    agent_id: UUID
    library_component_id: UUID
    library_component: Optional[LibraryComponentResponse] = None
    added_at: datetime
    added_by: Optional[UUID]

    class Config:
        from_attributes = True


class AgentLibraryRefsResponse(BaseModel):
    """List of agent library references."""
    data: list[AgentLibraryRefResponse]
    total: int


class PublishToLibraryRequest(BaseModel):
    """Request body for publishing a component to the library."""
    name: Optional[str] = None  # Override component name
    description: Optional[str] = None  # Override description
    tags: list[str] = Field(default_factory=list)


class PublishToLibraryResponse(BaseModel):
    """Response after publishing a component to the library."""
    library_component: LibraryComponentResponse
    message: str = "Component published to library successfully"


class LibraryComponentBatchCreate(BaseModel):
    """Request body for creating multiple library components at once."""
    components: list[LibraryComponentCreate] = Field(..., min_length=1, max_length=100)


class LibraryComponentBatchFailure(BaseModel):
    """Information about a failed component creation."""
    name: str
    error: str


class LibraryComponentBatchResponse(BaseModel):
    """Response for batch component creation."""
    created: list[LibraryComponentResponse]
    failed: list[LibraryComponentBatchFailure]
    total_created: int
    total_failed: int
