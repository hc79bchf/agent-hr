import uuid
from datetime import datetime
from enum import Enum
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Integer, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship
from app.database import Base


class AgentStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    DEPRECATED = "deprecated"


class ChangeType(str, Enum):
    UPLOAD = "upload"
    EDIT = "edit"
    ROLLBACK = "rollback"


class Agent(Base):
    __tablename__ = "agents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    current_version_id = Column(UUID(as_uuid=True), ForeignKey("agent_versions.id", use_alter=True), nullable=True)
    status = Column(SQLEnum(AgentStatus, values_callable=lambda x: [e.value for e in x]), default=AgentStatus.DRAFT, nullable=False)
    tags = Column(ARRAY(String), default=[])
    department = Column(String(255))
    usage_notes = Column(Text)
    # Organization metadata
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True)
    manager_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at = Column(DateTime, nullable=True)

    author = relationship("User", foreign_keys=[author_id])
    versions = relationship("AgentVersion", back_populates="agent", foreign_keys="AgentVersion.agent_id")
    memory_suggestions = relationship(
        "MemorySuggestion",
        back_populates="agent",
        cascade="all, delete-orphan"
    )
    organization = relationship("Organization", foreign_keys=[organization_id])
    manager = relationship("User", foreign_keys=[manager_id])


class AgentVersion(Base):
    __tablename__ = "agent_versions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False)
    version_number = Column(Integer, nullable=False)
    parent_version_id = Column(UUID(as_uuid=True), ForeignKey("agent_versions.id"), nullable=True)
    change_type = Column(SQLEnum(ChangeType, values_callable=lambda x: [e.value for e in x]), nullable=False)
    change_summary = Column(Text)
    raw_config = Column(JSONB, default={})
    parsed_config = Column(JSONB, default={})
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    agent = relationship("Agent", back_populates="versions", foreign_keys=[agent_id])
    parent_version = relationship("AgentVersion", remote_side=[id], foreign_keys=[parent_version_id])
    components = relationship("Component", back_populates="version")
    folders = relationship("ComponentFolder", back_populates="version", cascade="all, delete-orphan")
