import uuid
from datetime import datetime
from enum import Enum
from sqlalchemy import Column, String, DateTime, ForeignKey, UniqueConstraint, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.component_grant import ComponentAccessLevel


class RequestStatus(str, Enum):
    """Status of a component access request."""
    PENDING = "pending"
    APPROVED = "approved"
    DENIED = "denied"


class ComponentAccessRequest(Base):
    """Model for access requests to components.

    Agent owners can request elevated access (executor/contributor) to components.
    Component owners can approve or deny these requests.
    """
    __tablename__ = "component_access_requests"
    __table_args__ = (
        UniqueConstraint(
            "component_id", "agent_id", "status",
            name="uq_component_agent_pending_request"
        ),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    component_id = Column(UUID(as_uuid=True), ForeignKey("component_registry.id"), nullable=False)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id"), nullable=False)
    requested_level = Column(
        SQLEnum(ComponentAccessLevel, values_callable=lambda x: [e.value for e in x]),
        nullable=False
    )
    requested_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    requested_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    status = Column(
        SQLEnum(RequestStatus, values_callable=lambda x: [e.value for e in x]),
        default=RequestStatus.PENDING,
        nullable=False
    )
    resolved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    denial_reason = Column(String(1000), nullable=True)

    component = relationship("ComponentRegistry", foreign_keys=[component_id])
    agent = relationship("Agent", foreign_keys=[agent_id])
    requester = relationship("User", foreign_keys=[requested_by])
    resolver = relationship("User", foreign_keys=[resolved_by])

    def __init__(self, **kwargs):
        if "status" not in kwargs:
            kwargs["status"] = RequestStatus.PENDING
        super().__init__(**kwargs)

    @property
    def is_pending(self) -> bool:
        """Check if request is still pending."""
        return self.status == RequestStatus.PENDING
