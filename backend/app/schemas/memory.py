"""Memory management schemas for agent knowledge base."""

from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional
from enum import Enum

from app.schemas.version import ComponentResponse, VersionResponse


class MemoryType(str, Enum):
    """Memory component types following cognitive memory model."""
    working = "working"        # Current task context, auto-cleared
    short_term = "short_term"  # Single session, auto-expired
    long_term = "long_term"    # Persistent across sessions
    procedural = "procedural"  # How-to knowledge, markdown-based


class SuggestionStatus(str, Enum):
    """Status of a memory suggestion."""
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class MemoryCreate(BaseModel):
    """Schema for creating a new memory entry."""

    name: str = Field(..., min_length=1, max_length=255, description="Title of the memory")
    content: str = Field(..., min_length=1, description="Markdown content of the memory")
    description: Optional[str] = Field(
        None,
        max_length=500,
        description="Brief description (auto-generated from first line if not provided)",
    )
    memory_type: MemoryType = Field(
        default=MemoryType.long_term,
        description="Type of memory: working, short_term, long_term, procedural"
    )


class MemoryUpdate(BaseModel):
    """Schema for updating an existing memory entry."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    content: Optional[str] = Field(None, min_length=1)
    description: Optional[str] = Field(None, max_length=500)
    memory_type: Optional[MemoryType] = Field(None, description="Type of memory")


class MemoryResponse(BaseModel):
    """Response schema for a single memory entry."""

    id: UUID
    name: str
    description: Optional[str]
    content: Optional[str]
    source_path: Optional[str]
    memory_type: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MemoryCreateResponse(BaseModel):
    """Response when creating a memory (includes new version info)."""

    memory: ComponentResponse
    new_version: VersionResponse


class MemoryUpdateResponse(BaseModel):
    """Response when updating a memory (includes new version info)."""

    memory: ComponentResponse
    new_version: VersionResponse


class MemoryDeleteResponse(BaseModel):
    """Response when deleting a memory."""

    deleted: bool
    new_version: VersionResponse


# =============================================================================
# Memory Suggestion Schemas
# =============================================================================


class MemorySuggestionCreate(BaseModel):
    """Schema for creating a memory suggestion (from agent during conversation)."""

    suggested_name: str = Field(..., min_length=1, max_length=255)
    suggested_content: str = Field(..., min_length=1)
    suggested_type: MemoryType = Field(default=MemoryType.long_term)
    source_message_id: Optional[UUID] = Field(
        None, description="ID of the message that triggered this suggestion"
    )


class MemorySuggestionResponse(BaseModel):
    """Schema for memory suggestion response."""

    id: UUID
    agent_id: UUID
    deployment_id: Optional[UUID] = None
    suggested_name: str
    suggested_content: str
    suggested_type: str
    source_message_id: Optional[UUID] = None
    status: str
    created_at: datetime
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[UUID] = None

    class Config:
        from_attributes = True


class MemorySuggestionReview(BaseModel):
    """Schema for reviewing (approve/reject) a memory suggestion."""

    status: SuggestionStatus = Field(
        ..., description="Must be 'approved' or 'rejected'"
    )


class MemorySuggestionListResponse(BaseModel):
    """List response for memory suggestions with pagination metadata."""

    data: list[MemorySuggestionResponse]
    total: int
