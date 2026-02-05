"""Component version model for semantic versioning."""

import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.database import Base


class ComponentVersion(Base):
    """Tracks version history of components with semantic versioning."""

    __tablename__ = "component_versions"
    __table_args__ = (
        UniqueConstraint("component_id", "version", name="uq_component_version"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    component_id = Column(UUID(as_uuid=True), ForeignKey("component_registry.id", ondelete="CASCADE"), nullable=False)
    version = Column(String(50), nullable=False)  # semver: "1.2.0"
    changelog = Column(Text, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    snapshot = Column(JSONB, nullable=True)
    parameters_schema_snapshot = Column(JSONB, nullable=True)
    mcp_config_snapshot = Column(JSONB, nullable=True)

    # Relationships
    component = relationship("ComponentRegistry", foreign_keys=[component_id])
    creator = relationship("User", foreign_keys=[created_by])
