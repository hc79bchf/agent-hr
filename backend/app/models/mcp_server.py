"""MCP Server registry model for managing MCP server connections."""

import uuid
from datetime import datetime
from enum import Enum

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship

from app.database import Base


class MCPAuthType(str, Enum):
    """Authentication type for MCP server connections."""
    NONE = "none"
    API_KEY = "api_key"
    OAUTH = "oauth"
    BEARER = "bearer"


class MCPServerStatus(str, Enum):
    """Health status of an MCP server."""
    ACTIVE = "active"
    INACTIVE = "inactive"
    UNHEALTHY = "unhealthy"


class MCPServer(Base):
    """Model for registered MCP servers.

    Tracks MCP server URLs, authentication, capabilities, and health status.
    Optionally linked to a ComponentRegistry entry.
    """
    __tablename__ = "mcp_servers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    server_url = Column(String(2048), nullable=False)
    protocol_version = Column(String(50), default="1.0")
    capabilities = Column(ARRAY(String), default=list)
    auth_type = Column(
        SQLEnum(MCPAuthType, values_callable=lambda x: [e.value for e in x]),
        default=MCPAuthType.NONE,
        nullable=False
    )
    auth_config = Column(JSONB, nullable=True)
    health_check_url = Column(String(2048), nullable=True)
    health_check_interval_seconds = Column(Integer, default=300)
    status = Column(
        SQLEnum(MCPServerStatus, values_callable=lambda x: [e.value for e in x]),
        default=MCPServerStatus.ACTIVE,
        nullable=False
    )
    last_health_check_at = Column(DateTime, nullable=True)
    last_health_status = Column(String(255), nullable=True)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    component_id = Column(UUID(as_uuid=True), ForeignKey("component_registry.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    owner = relationship("User", foreign_keys=[owner_id])
    component = relationship("ComponentRegistry", foreign_keys=[component_id])
