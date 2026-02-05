import uuid
from datetime import datetime
from enum import Enum
from sqlalchemy import Column, String, DateTime, ForeignKey, Enum as SQLEnum, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from sqlalchemy.orm import relationship
from app.database import Base


class ComponentType(str, Enum):
    SKILL = "skill"
    TOOL = "tool"
    MEMORY = "memory"


class ComponentVisibility(str, Enum):
    PRIVATE = "private"
    ORGANIZATION = "organization"
    PUBLIC = "public"


class ComponentStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    DEPRECATED = "deprecated"
    RETIRED = "retired"


class EntitlementType(str, Enum):
    OPEN = "open"
    REQUEST_REQUIRED = "request_required"
    RESTRICTED = "restricted"


class ComponentRegistry(Base):
    __tablename__ = "component_registry"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type = Column(
        SQLEnum(ComponentType, values_callable=lambda x: [e.value for e in x]),
        nullable=False
    )
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    content = Column(Text, nullable=True)
    tags = Column(ARRAY(String), default=list)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True)
    manager_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    visibility = Column(
        SQLEnum(ComponentVisibility, values_callable=lambda x: [e.value for e in x]),
        default=ComponentVisibility.PRIVATE,
        nullable=False
    )
    component_metadata = Column(JSONB, default=dict)
    status = Column(
        SQLEnum(ComponentStatus, values_callable=lambda x: [e.value for e in x]),
        default=ComponentStatus.DRAFT,
        nullable=False
    )
    published_at = Column(DateTime, nullable=True)
    deprecation_reason = Column(String(500), nullable=True)
    entitlement_type = Column(
        SQLEnum(EntitlementType, values_callable=lambda x: [e.value for e in x]),
        default=EntitlementType.OPEN,
        nullable=False
    )
    version = Column(String(50), default="1.0.0")
    parameters_schema = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    deleted_at = Column(DateTime, nullable=True)

    owner = relationship("User", foreign_keys=[owner_id])
    organization = relationship("Organization", foreign_keys=[organization_id])
    manager = relationship("User", foreign_keys=[manager_id])

    def __init__(self, **kwargs):
        if "visibility" not in kwargs:
            kwargs["visibility"] = ComponentVisibility.PRIVATE
        super().__init__(**kwargs)


class ComponentSnapshot(Base):
    """Snapshot of a component's state for version history."""

    __tablename__ = "component_snapshots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    component_id = Column(UUID(as_uuid=True), ForeignKey("component_registry.id", ondelete="CASCADE"), nullable=False)
    version_label = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    content = Column(Text, nullable=True)
    tags = Column(ARRAY(String), default=list)
    component_metadata = Column(JSONB, default=dict)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    component = relationship("ComponentRegistry", foreign_keys=[component_id])
    creator = relationship("User", foreign_keys=[created_by])


class AgentRegistryRef(Base):
    """Links agents to component registry entries they reference."""

    __tablename__ = "agent_registry_refs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    registry_component_id = Column(UUID(as_uuid=True), ForeignKey("component_registry.id", ondelete="CASCADE"), nullable=False)
    added_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    added_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Unique constraint: agent can only reference a registry component once
    __table_args__ = (
        UniqueConstraint("agent_id", "registry_component_id", name="uq_agent_registry_ref"),
    )

    # Relationships
    agent = relationship("Agent", foreign_keys=[agent_id])
    registry_component = relationship("ComponentRegistry", foreign_keys=[registry_component_id])
    added_by_user = relationship("User", foreign_keys=[added_by])
