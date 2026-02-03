"""Config builder service for compiling agent configurations."""

from typing import Optional
from uuid import UUID
from sqlalchemy.orm import Session

from app.models import Component, ComponentType


class ConfigBuilder:
    """Builds agent configuration from version components."""

    def __init__(self, db: Session):
        """Initialize with database session.

        Args:
            db: SQLAlchemy database session.
        """
        self.db = db

    def build_config(self, version_id: UUID) -> dict:
        """Compile agent configuration from all components in a version.

        Args:
            version_id: The agent version UUID.

        Returns:
            Complete agent configuration dictionary with:
                - system_prompt: Combined skills as system prompt sections
                - tools: MCP tool definitions
                - memory: Memory items for context
                - skills: List of skill names
                - model: Model to use
        """
        components = (
            self.db.query(Component)
            .filter(Component.version_id == version_id)
            .all()
        )

        # Separate by type
        skills = [c for c in components if c.type == ComponentType.SKILL]
        mcp_tools = [c for c in components if c.type == ComponentType.MCP_TOOL]
        memory = [c for c in components if c.type == ComponentType.MEMORY]

        # Build system prompt from skills
        system_prompt = self._build_system_prompt(skills, memory)

        # Convert MCP tools to tool definitions
        tool_definitions = self._build_tools(mcp_tools)

        # Build memory context
        memory_items = self._build_memory(memory)

        return {
            "system_prompt": system_prompt,
            "tools": tool_definitions,
            "memory": memory_items,
            "skills": [s.name for s in skills],
            "model": "claude-sonnet-4-5-20250929",
        }

    def _build_system_prompt(
        self,
        skills: list[Component],
        memory: list[Component],
    ) -> str:
        """Build system prompt from skills and memory.

        Args:
            skills: List of skill components.
            memory: List of memory components.

        Returns:
            Combined system prompt string.
        """
        sections = []

        # Base instruction
        sections.append("You are an AI agent with specialized capabilities.")
        sections.append("")

        # Add skills
        if skills:
            sections.append("# Your Skills")
            sections.append("")
            for skill in skills:
                sections.append(f"## {skill.name}")
                if skill.description:
                    sections.append(f"*{skill.description}*")
                    sections.append("")
                if skill.content:
                    sections.append(skill.content)
                sections.append("")

        # Add relevant memory as context
        if memory:
            sections.append("# Background Knowledge")
            sections.append("")
            for mem in memory:
                if mem.name.upper() == "CLAUDE.MD":
                    # CLAUDE.md gets special treatment as primary context
                    sections.append(f"## Project Context")
                else:
                    sections.append(f"## {mem.name}")
                if mem.content:
                    # Truncate very long memory items
                    content = mem.content
                    if len(content) > 4000:
                        content = content[:4000] + "\n\n[Content truncated...]"
                    sections.append(content)
                sections.append("")

        return "\n".join(sections)

    def _build_tools(self, mcp_tools: list[Component]) -> list[dict]:
        """Build tool definitions from MCP tool components.

        Args:
            mcp_tools: List of MCP tool components.

        Returns:
            List of tool definition dictionaries.
        """
        definitions = []

        for tool in mcp_tools:
            if tool.config:
                # MCP tool config contains the server configuration
                # We extract tool definitions if available
                config = tool.config

                # If config has tools array, use those
                if "tools" in config:
                    definitions.extend(config["tools"])
                else:
                    # Create a basic tool definition from the component
                    definitions.append({
                        "name": tool.name,
                        "description": tool.description or f"MCP tool: {tool.name}",
                        "input_schema": config.get("input_schema", {
                            "type": "object",
                            "properties": {},
                        }),
                    })

        return definitions

    def _build_memory(self, memory: list[Component]) -> list[dict]:
        """Build memory items for agent context.

        Args:
            memory: List of memory components.

        Returns:
            List of memory item dictionaries.
        """
        return [
            {
                "key": mem.name,
                "content": mem.content or "",
                "description": mem.description,
            }
            for mem in memory
        ]
