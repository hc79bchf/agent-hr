"""Models for the component library - shared components across agents."""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.component import ComponentType


class ComponentLibrary(Base):
    """Central library for shared components (skills, tools, memory)."""

    __tablename__ = "component_library"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type = Column(String(20), nullable=False)  # skill, mcp_tool, memory
    name = Column(String(255), nullable=False)
    description = Column(Text)
    content = Column(Text)
    config = Column(JSONB, default={})
    source_path = Column(String(512))
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    tags = Column(ARRAY(String), default=[])
    usage_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    author = relationship("User", foreign_keys=[author_id])
    agent_refs = relationship("AgentLibraryRef", back_populates="library_component")


class AgentLibraryRef(Base):
    """Links agents to library components they reference."""

    __tablename__ = "agent_library_refs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    library_component_id = Column(UUID(as_uuid=True), ForeignKey("component_library.id", ondelete="CASCADE"), nullable=False)
    added_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    added_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Unique constraint: agent can only reference a library component once
    __table_args__ = (
        UniqueConstraint("agent_id", "library_component_id", name="uq_agent_library_ref"),
    )

    # Relationships
    agent = relationship("Agent", foreign_keys=[agent_id])
    library_component = relationship("ComponentLibrary", back_populates="agent_refs")
    added_by_user = relationship("User", foreign_keys=[added_by])
