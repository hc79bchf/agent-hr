import uuid
from enum import Enum
from sqlalchemy import Column, String, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.database import Base


class ComponentType(str, Enum):
    SKILL = "skill"
    MCP_TOOL = "mcp_tool"
    MEMORY = "memory"
    AGENT = "agent"


class MemoryType(str, Enum):
    """Memory component types following cognitive memory model."""
    WORKING = "working"        # Current task context, auto-cleared
    SHORT_TERM = "short_term"  # Single session, auto-expired
    LONG_TERM = "long_term"    # Persistent across sessions
    PROCEDURAL = "procedural"  # How-to knowledge, markdown-based


class Component(Base):
    __tablename__ = "components"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    version_id = Column(UUID(as_uuid=True), ForeignKey("agent_versions.id"), nullable=False)
    folder_id = Column(UUID(as_uuid=True), ForeignKey("component_folders.id", ondelete="SET NULL"), nullable=True)
    type = Column(SQLEnum(ComponentType, values_callable=lambda x: [e.value for e in x]), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    content = Column(Text)
    config = Column(JSONB, default={})
    source_path = Column(String(512))
    memory_type = Column(
        String(20),
        nullable=True,
        doc="For memory components: working, short_term, long_term, procedural"
    )

    version = relationship("AgentVersion", back_populates="components")
    folder = relationship("ComponentFolder", back_populates="components")
