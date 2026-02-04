import uuid
from datetime import datetime
from enum import Enum
from sqlalchemy import Column, DateTime, ForeignKey, UniqueConstraint, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class ComponentAccessLevel(str, Enum):
    """Access levels for component grants.

    VIEWER: Can view component metadata and documentation (default for all agents)
    EXECUTOR: Can use/execute the component (requires grant)
    CONTRIBUTOR: Can modify the component (requires grant)
    """
    VIEWER = "viewer"
    EXECUTOR = "executor"
    CONTRIBUTOR = "contributor"

    def can_view(self) -> bool:
        """All levels can view."""
        return True

    def can_execute(self) -> bool:
        """Executor and Contributor can execute."""
        return self in (ComponentAccessLevel.EXECUTOR, ComponentAccessLevel.CONTRIBUTOR)

    def can_modify(self) -> bool:
        """Only Contributor can modify."""
        return self == ComponentAccessLevel.CONTRIBUTOR


class ComponentGrant(Base):
    __tablename__ = "component_grants"
    __table_args__ = (
        UniqueConstraint("component_id", "agent_id", name="uq_component_agent_grant"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    component_id = Column(UUID(as_uuid=True), ForeignKey("component_registry.id"), nullable=False)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False)
    access_level = Column(
        SQLEnum(ComponentAccessLevel, values_callable=lambda x: [e.value for e in x]),
        default=ComponentAccessLevel.VIEWER,
        nullable=False
    )
    granted_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    granted_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=True)
    revoked_at = Column(DateTime, nullable=True)

    component = relationship("ComponentRegistry", foreign_keys=[component_id])
    agent = relationship("Agent", foreign_keys=[agent_id])
    granter = relationship("User", foreign_keys=[granted_by])

    def __init__(self, **kwargs):
        if "access_level" not in kwargs:
            kwargs["access_level"] = ComponentAccessLevel.VIEWER
        super().__init__(**kwargs)

    @property
    def is_active(self) -> bool:
        """Check if grant is currently active (not revoked and not expired)."""
        if self.revoked_at is not None:
            return False
        if self.expires_at is not None and self.expires_at < datetime.utcnow():
            return False
        return True
