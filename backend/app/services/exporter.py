"""Export service for creating downloadable agent configuration archives."""

import io
import json
import re
import zipfile
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.agent import Agent, AgentVersion
from app.models.component import Component, ComponentType


class ExportService:
    """Service for exporting agent configurations as zip archives."""

    def __init__(self, db: Session):
        """Initialize the export service.

        Args:
            db: Database session.
        """
        self.db = db

    def export_agent(
        self,
        agent_id: UUID,
        excluded_component_ids: Optional[list[UUID]] = None,
    ) -> tuple[io.BytesIO, str]:
        """Export an agent's current version as a zip archive.

        Args:
            agent_id: The agent's UUID.
            excluded_component_ids: List of component IDs to exclude from the export.

        Returns:
            A tuple of (zip file buffer, filename).

        Raises:
            ValueError: If the agent doesn't exist or has no current version.
        """
        excluded_component_ids = excluded_component_ids or []

        # Fetch the agent
        agent = self.db.query(Agent).filter(
            Agent.id == agent_id,
            Agent.deleted_at.is_(None)
        ).first()

        if not agent:
            raise ValueError("Agent not found")

        if not agent.current_version_id:
            raise ValueError("Agent has no current version")

        # Fetch the current version with components
        version = self.db.query(AgentVersion).filter(
            AgentVersion.id == agent.current_version_id
        ).first()

        if not version:
            raise ValueError("Agent version not found")

        # Fetch components for this version, excluding specified ones
        components = self.db.query(Component).filter(
            Component.version_id == version.id
        ).all()

        # Filter out excluded components
        excluded_ids_set = set(str(cid) for cid in excluded_component_ids)
        filtered_components = [
            c for c in components
            if str(c.id) not in excluded_ids_set
        ]

        # Build the zip archive
        zip_buffer = self._build_zip(filtered_components)

        # Generate filename
        filename = self._generate_filename(agent.name)

        return zip_buffer, filename

    def _build_zip(self, components: list[Component]) -> io.BytesIO:
        """Build a zip archive from components.

        Args:
            components: List of components to include.

        Returns:
            BytesIO buffer containing the zip file.
        """
        buffer = io.BytesIO()

        # Group MCP tools to rebuild mcp.json
        mcp_tools = [c for c in components if c.type == ComponentType.MCP_TOOL]
        other_components = [c for c in components if c.type != ComponentType.MCP_TOOL]

        with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
            # Write non-MCP components using their source_path
            for component in other_components:
                if component.source_path and component.content:
                    zf.writestr(component.source_path, component.content)

            # Rebuild mcp.json from MCP tool components
            if mcp_tools:
                mcp_config = self._rebuild_mcp_config(mcp_tools)
                if mcp_config:
                    zf.writestr("mcp.json", json.dumps(mcp_config, indent=2))

        buffer.seek(0)
        return buffer

    def _rebuild_mcp_config(self, mcp_tools: list[Component]) -> dict:
        """Rebuild mcp.json from MCP tool components.

        Args:
            mcp_tools: List of MCP tool components.

        Returns:
            Dictionary representation of mcp.json.
        """
        mcp_servers = {}

        for tool in mcp_tools:
            # The tool name is used as the server key
            tool_name = tool.name
            # The config contains the tool configuration
            tool_config = tool.config or {}

            # If we have the original content stored, try to use it
            if tool.content:
                try:
                    content = json.loads(tool.content)
                    if "mcpServers" in content and tool_name in content["mcpServers"]:
                        mcp_servers[tool_name] = content["mcpServers"][tool_name]
                        continue
                except (json.JSONDecodeError, KeyError):
                    pass

            # Fall back to using the config
            if tool_config:
                mcp_servers[tool_name] = tool_config

        if mcp_servers:
            return {"mcpServers": mcp_servers}
        return {}

    def _generate_filename(self, agent_name: str) -> str:
        """Generate a safe filename for the export.

        Args:
            agent_name: The agent's name.

        Returns:
            Sanitized filename with .zip extension.
        """
        # Sanitize the agent name for use in filename
        safe_name = re.sub(r'[^\w\s-]', '', agent_name.lower())
        safe_name = re.sub(r'[\s_]+', '-', safe_name)
        safe_name = safe_name.strip('-')

        if not safe_name:
            safe_name = "agent-export"

        return f"{safe_name}.zip"
