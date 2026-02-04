"""Memory-related models."""

import uuid
from datetime import datetime
from enum import Enum
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class SuggestionStatus(str, Enum):
    """Status of a memory suggestion."""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class MemorySuggestion(Base):
    """Agent-suggested memory entries awaiting user approval."""
    __tablename__ = "memory_suggestions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(
        UUID(as_uuid=True),
        ForeignKey("agents.id", ondelete="CASCADE"),
        nullable=False
    )
    deployment_id = Column(
        UUID(as_uuid=True),
        ForeignKey("agent_deployments.id", ondelete="SET NULL"),
        nullable=True
    )

    suggested_name = Column(String(255), nullable=False)
    suggested_content = Column(Text, nullable=False)
    suggested_type = Column(
        String(20),
        default="long_term",
        doc="Memory type: working, short_term, long_term, procedural"
    )

    source_message_id = Column(UUID(as_uuid=True), nullable=True)
    status = Column(
        String(20),
        default=SuggestionStatus.PENDING.value,
        nullable=False
    )

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    reviewed_at = Column(DateTime, nullable=True)
    reviewed_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )

    # Relationships
    agent = relationship("Agent", back_populates="memory_suggestions")
    deployment = relationship("AgentDeployment", foreign_keys=[deployment_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by])
