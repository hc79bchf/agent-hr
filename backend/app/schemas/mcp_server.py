"""Schemas for MCP Server registry."""

from datetime import datetime
from typing import Optional, Dict, Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.mcp_server import MCPAuthType, MCPServerStatus


class MCPServerCreate(BaseModel):
    """Schema for registering a new MCP server."""

    name: str
    description: Optional[str] = None
    server_url: str
    protocol_version: str = "1.0"
    capabilities: list[str] = []
    auth_type: MCPAuthType = MCPAuthType.NONE
    auth_config: Optional[Dict[str, Any]] = None
    health_check_url: Optional[str] = None
    health_check_interval_seconds: int = 300
    component_id: Optional[UUID] = None

    @field_validator("server_url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        if not v.startswith(("http://", "https://")):
            raise ValueError("server_url must start with http:// or https://")
        return v


class MCPServerUpdate(BaseModel):
    """Schema for updating an MCP server."""

    name: Optional[str] = None
    description: Optional[str] = None
    server_url: Optional[str] = None
    protocol_version: Optional[str] = None
    capabilities: Optional[list[str]] = None
    auth_type: Optional[MCPAuthType] = None
    auth_config: Optional[Dict[str, Any]] = None
    health_check_url: Optional[str] = None
    health_check_interval_seconds: Optional[int] = None
    component_id: Optional[UUID] = None


class MCPServerResponse(BaseModel):
    """Response schema for MCP servers. auth_config is redacted."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: Optional[str] = None
    server_url: str
    protocol_version: str
    capabilities: list[str] = []
    auth_type: MCPAuthType
    auth_configured: bool = False  # True if auth_config is set, never expose actual config
    health_check_url: Optional[str] = None
    health_check_interval_seconds: int
    status: MCPServerStatus
    last_health_check_at: Optional[datetime] = None
    last_health_status: Optional[str] = None
    owner_id: UUID
    component_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime


class MCPServerListResponse(BaseModel):
    """Schema for paginated MCP server list."""

    data: list[MCPServerResponse]
    total: int


class MCPServerHealthResponse(BaseModel):
    """Response from a health check."""

    id: UUID
    name: str
    healthy: Optional[bool] = None
    status_code: Optional[int] = None
    response_time_ms: Optional[int] = None
    error: Optional[str] = None
    last_health_status: Optional[str] = None


class MCPServerConnectionResponse(BaseModel):
    """Connection config returned to agents."""

    id: UUID
    name: str
    server_url: str
    protocol_version: str
    capabilities: list[str] = []
    auth_type: MCPAuthType
