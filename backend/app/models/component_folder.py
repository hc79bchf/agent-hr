"""Component folder model for grouping related components."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base


class ComponentFolder(Base):
    """Represents a folder grouping related components within an agent version."""
    __tablename__ = "component_folders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    version_id = Column(UUID(as_uuid=True), ForeignKey("agent_versions.id", ondelete="CASCADE"), nullable=False)
    type = Column(String(20), nullable=False)  # 'skill', 'mcp_tool', 'memory', 'agent'
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    source_path = Column(String(500), nullable=True)  # Original folder path from upload
    file_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    version = relationship("AgentVersion", back_populates="folders")
    components = relationship("Component", back_populates="folder", lazy="dynamic")

    __table_args__ = (
        UniqueConstraint('version_id', 'type', 'name', name='uq_component_folders_version_type_name'),
    )

    def update_file_count(self):
        """Update the file_count based on associated components."""
        self.file_count = self.components.count()
