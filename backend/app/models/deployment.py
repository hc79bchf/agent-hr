import uuid
from datetime import datetime
from enum import Enum
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class DeploymentStatus(str, Enum):
    PENDING = "pending"
    BUILDING = "building"
    STARTING = "starting"
    RUNNING = "running"
    STOPPING = "stopping"
    STOPPED = "stopped"
    FAILED = "failed"


class AgentDeployment(Base):
    __tablename__ = "agent_deployments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    version_id = Column(UUID(as_uuid=True), ForeignKey("agent_versions.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), default=DeploymentStatus.PENDING.value, nullable=False)
    container_id = Column(String(64), nullable=True)
    image_id = Column(String(128), nullable=True)
    port = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    started_at = Column(DateTime, nullable=True)
    stopped_at = Column(DateTime, nullable=True)

    # Relationships
    agent = relationship("Agent", foreign_keys=[agent_id])
    version = relationship("AgentVersion", foreign_keys=[version_id])
    creator = relationship("User", foreign_keys=[created_by])
