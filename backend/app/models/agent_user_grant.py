import uuid
from datetime import datetime
from enum import Enum
from sqlalchemy import Column, DateTime, ForeignKey, UniqueConstraint, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class AccessLevel(str, Enum):
    """Access levels for user grants to agents.

    Hierarchy (ascending permissions):
    - VIEWER: Can view agent details only
    - USER: Can interact with the agent
    - CONTRIBUTOR: Can train/improve the agent
    - ADMIN: Full control including managing grants
    """
    VIEWER = "viewer"
    USER = "user"
    CONTRIBUTOR = "contributor"
    ADMIN = "admin"

    def can_view(self) -> bool:
        """All access levels can view."""
        return True

    def can_interact(self) -> bool:
        """User, Contributor, and Admin can interact with the agent."""
        return self in (AccessLevel.USER, AccessLevel.CONTRIBUTOR, AccessLevel.ADMIN)

    def can_train(self) -> bool:
        """Contributor and Admin can train/improve the agent."""
        return self in (AccessLevel.CONTRIBUTOR, AccessLevel.ADMIN)

    def can_manage_grants(self) -> bool:
        """Only Admin can manage grants for other users."""
        return self == AccessLevel.ADMIN


class AgentUserGrant(Base):
    """Represents a user's access grant to an agent.

    This model controls which users have access to which agents
    and at what level (viewer, user, contributor, admin).

    Grants can optionally have an expiration date and can be revoked.
    A grant is considered active if it has not been revoked and
    has not expired.
    """
    __tablename__ = "agent_user_grants"
    __table_args__ = (
        UniqueConstraint("agent_id", "user_id", name="uq_agent_user_grant"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    access_level = Column(
        SQLEnum(AccessLevel, values_callable=lambda x: [e.value for e in x]),
        nullable=False
    )
    granted_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    granted_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=True)
    revoked_at = Column(DateTime, nullable=True)

    # Relationships
    agent = relationship("Agent", foreign_keys=[agent_id])
    user = relationship("User", foreign_keys=[user_id])
    granter = relationship("User", foreign_keys=[granted_by])

    @property
    def is_active(self) -> bool:
        """Check if grant is currently active.

        A grant is active if:
        - It has not been revoked (revoked_at is None)
        - It has not expired (expires_at is None or in the future)

        Revocation takes precedence over expiration.
        """
        if self.revoked_at is not None:
            return False
        if self.expires_at is not None and self.expires_at < datetime.utcnow():
            return False
        return True
