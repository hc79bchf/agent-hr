"""Pydantic schemas for deployment endpoints."""

from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel


class DeployRequest(BaseModel):
    """Request body for deploying an agent."""

    version_id: Optional[UUID] = None  # Uses current version if not specified


class DeploymentResponse(BaseModel):
    """Response for a single deployment."""

    id: UUID
    agent_id: UUID
    version_id: UUID
    status: str
    container_id: Optional[str] = None
    image_id: Optional[str] = None
    port: Optional[int] = None
    error_message: Optional[str] = None
    created_by: Optional[UUID] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    stopped_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DeploymentWithContainerResponse(DeploymentResponse):
    """Deployment response with container status info."""

    container: Optional[dict] = None


class DeploymentListResponse(BaseModel):
    """Response for listing deployments."""

    data: list[DeploymentResponse]
    total: int


class DeployResponse(BaseModel):
    """Response after initiating deployment."""

    deployment: DeploymentResponse
    message: str


class ChatRequest(BaseModel):
    """Request body for chat endpoint."""

    message: str
    conversation_id: Optional[str] = None


class ChatResponse(BaseModel):
    """Response from chat endpoint."""

    response: str
    conversation_id: str
