"""Config parser service for parsing Claude Code configuration files."""

import json
import re
from pathlib import Path


# Files to exclude from memory parsing
EXCLUDED_TXT_FILES = {
    'license.txt', 'readme.txt', 'requirements.txt',
    'changelog.txt', 'changes.txt', 'authors.txt',
    'contributors.txt', 'notice.txt', 'copying.txt',
    'manifest.txt', 'version.txt', 'todo.txt',
}


class ConfigParser:
    """Parser for Claude Code configuration files.

    Parses skills, MCP tools, and memory files from uploaded Claude Code
    configurations.
    """

    def parse_skill(self, content: str, filename: str) -> dict:
        """Parse a skill markdown file.

        Args:
            content: The raw markdown content of the skill file.
            filename: The filename (used to derive the skill name).

        Returns:
            A dictionary containing:
                - name: Skill name derived from filename
                - type: Always "skill"
                - description: First paragraph after the title
                - content: Full file content
                - config: Empty dict (skills don't have config)
        """
        name = Path(filename).stem

        # Extract first paragraph after title as description
        lines = content.strip().split('\n')
        description = ""
        in_description = False

        for line in lines:
            if line.startswith('#'):
                in_description = True
                continue
            if in_description and line.strip():
                description = line.strip()
                break

        return {
            "name": name,
            "type": "skill",
            "description": description,
            "content": content,
            "config": {},
        }

    def parse_mcp_config(self, content: str) -> list[dict]:
        """Parse MCP server configuration.

        Args:
            content: Raw JSON content of the MCP config file.

        Returns:
            A list of dictionaries, one for each MCP server, containing:
                - name: Server name
                - type: Always "mcp_tool"
                - description: Generated description
                - content: JSON string of server config
                - config: Original config dict
        """
        try:
            data = json.loads(content)
        except json.JSONDecodeError:
            return []

        servers = data.get("mcpServers", {})
        results = []

        for name, config in servers.items():
            results.append({
                "name": name,
                "type": "mcp_tool",
                "description": f"MCP server: {name}",
                "content": json.dumps(config, indent=2),
                "config": config,
            })

        return results

    def parse_memory(self, content: str, filename: str) -> dict:
        """Parse a memory/context file.

        Args:
            content: The raw content of the memory file.
            filename: The filename (used as the memory name).

        Returns:
            A dictionary containing:
                - name: Filename
                - type: Always "memory"
                - description: First non-header line (truncated to 200 chars)
                - content: Full file content
                - config: Empty dict
        """
        name = filename

        # Extract first meaningful content as description
        lines = content.strip().split('\n')
        description = ""
        for line in lines:
            stripped = line.strip()
            if stripped and not stripped.startswith('#'):
                description = stripped[:200]
                break

        return {
            "name": name,
            "type": "memory",
            "description": description,
            "content": content,
            "config": {},
        }

    def parse_agent(self, content: str, filename: str) -> dict:
        """Parse an agent definition file.

        Args:
            content: The raw content of the agent file.
            filename: The filename (used to derive the agent name).

        Returns:
            A dictionary containing:
                - name: Agent name derived from filename
                - type: Always "agent"
                - description: First paragraph after the title
                - content: Full file content
                - config: Empty dict
        """
        name = Path(filename).stem

        # Extract first paragraph after title as description
        lines = content.strip().split('\n')
        description = ""
        in_description = False

        for line in lines:
            if line.startswith('#'):
                in_description = True
                continue
            if in_description and line.strip():
                description = line.strip()
                break

        return {
            "name": name,
            "type": "agent",
            "description": description,
            "content": content,
            "config": {},
        }

    def parse_agent_script(self, content: str, filename: str) -> dict:
        """Parse an agent Python script to extract metadata.

        Args:
            content: The raw content of the agent.py file.
            filename: The filename (used to derive agent name as fallback).

        Returns:
            A dictionary containing:
                - name: Agent name from name= parameter or filename
                - type: Always "agent"
                - description: From instructions= parameter (first 200 chars)
                - content: Full file content
                - config: Contains model if found
        """
        name = Path(filename).stem
        description = ""
        model = None

        # Try to extract name from name="..." or name='...'
        name_match = re.search(r'name\s*=\s*["\']([^"\']+)["\']', content)
        if name_match:
            name = name_match.group(1)

        # Try to extract instructions for description
        # Handle multiline triple-quoted strings first
        instructions_match = re.search(
            r'instructions\s*=\s*"""(.*?)"""',
            content,
            re.DOTALL
        )
        if not instructions_match:
            instructions_match = re.search(
                r"instructions\s*=\s*'''(.*?)'''",
                content,
                re.DOTALL
            )
        if not instructions_match:
            # Try single-line strings
            instructions_match = re.search(
                r'instructions\s*=\s*["\']([^"\']+)["\']',
                content
            )

        if instructions_match:
            # Clean up the instructions text
            instructions = instructions_match.group(1).strip()
            # Take first 200 chars for description
            description = ' '.join(instructions.split())[:200]

        # Try to extract model
        model_match = re.search(r'model\s*=\s*["\']([^"\']+)["\']', content)
        if model_match:
            model = model_match.group(1)

        config = {}
        if model:
            config["model"] = model

        return {
            "name": name,
            "type": "agent",
            "description": description,
            "content": content,
            "config": config,
        }

    def parse_uploaded_files(self, files: dict[str, str]) -> dict:
        """Parse a dictionary of uploaded files and return structured components.

        Args:
            files: Dictionary mapping filepath to file content.

        Returns:
            Dictionary containing:
                - skills: List of parsed skill dictionaries
                - mcp_tools: List of parsed MCP tool dictionaries
                - memory: List of parsed memory dictionaries
                - agents: List of parsed agent dictionaries
                - raw: Original files dictionary
        """
        result = {
            "skills": [],
            "mcp_tools": [],
            "memory": [],
            "agents": [],
            "raw": files,
        }

        for filepath, content in files.items():
            path = Path(filepath)
            lower_path = filepath.lower()

            # Skills from .claude/commands/
            if ".claude/commands" in filepath and path.suffix == ".md":
                skill = self.parse_skill(content, path.name)
                skill["source_path"] = filepath
                result["skills"].append(skill)

            # SKILL.md files in /skills/ folders are skill definitions
            elif path.name.upper() == "SKILL.MD" and "/skills/" in lower_path:
                # Use parent folder name as skill name (e.g., brand-guidelines)
                skill_name = path.parent.name
                skill = self.parse_skill(content, skill_name + ".md")
                skill["source_path"] = filepath
                result["skills"].append(skill)

            # Agent definitions from .claude/agents/
            elif ".claude/agents" in filepath and path.suffix == ".md":
                agent = self.parse_agent(content, path.name)
                agent["source_path"] = filepath
                result["agents"].append(agent)

            # MCP config
            elif path.name in ["mcp.json", "mcp_config.json", ".mcp.json"]:
                tools = self.parse_mcp_config(content)
                for tool in tools:
                    tool["source_path"] = filepath
                result["mcp_tools"].extend(tools)

            # CLAUDE.md as memory
            elif path.name == "CLAUDE.md":
                memory = self.parse_memory(content, path.name)
                memory["source_path"] = filepath
                result["memory"].append(memory)

            # Other markdown files as memory (except SKILL.md in skills folders - already handled)
            elif path.suffix in [".md", ".txt"]:
                # Skip SKILL.md files in skills folders - they're already parsed as skills
                if path.name.upper() == "SKILL.MD" and "/skills/" in lower_path:
                    continue
                # Skip blocklisted .txt files (LICENSE.txt, README.txt, etc.)
                if path.suffix == ".txt" and path.name.lower() in EXCLUDED_TXT_FILES:
                    continue
                memory = self.parse_memory(content, path.name)
                memory["source_path"] = filepath
                result["memory"].append(memory)

            # Code files - categorize based on folder structure
            elif path.suffix in [".py", ".js", ".ts", ".jsx", ".tsx", ".json", ".yaml", ".yml", ".sh", ".bash", ".css", ".html"]:
                # Skip node_modules, __pycache__, __init__.py, etc.
                if any(skip in filepath for skip in ["node_modules", "__pycache__", ".git", "dist", "build"]):
                    continue
                # Skip __init__.py files - they're module markers, not skills/components
                if path.name == "__init__.py":
                    continue
                # Skip files in examples/ folders - they're documentation, not actual components
                if "/examples/" in filepath.lower() or filepath.lower().startswith("examples/"):
                    continue

                lower_path = filepath.lower()

                # Files in tools/ folder → MCP tools
                if "/tools/" in lower_path or "\\tools\\" in lower_path or lower_path.startswith("tools/") or "mcp" in lower_path:
                    tool = self.parse_code_file(content, path.name, path.suffix)
                    tool["type"] = "mcp_tool"
                    tool["source_path"] = filepath
                    result["mcp_tools"].append(tool)
                # Files in memory/ folder → skip code files, they're helpers not memories
                elif "/memory/" in lower_path or "\\memory\\" in lower_path or "/memories/" in lower_path:
                    # Skip code files in memory folder - they're helpers, not actual memories
                    continue
                # Files in agents/ folder → only parse *agent*.py files for agent metadata
                elif "/agents/" in lower_path or "\\agents\\" in lower_path or lower_path.startswith("agents/"):
                    # Only parse files matching *agent*.py pattern (e.g., agent.py, my_agent.py, hr-agent.py)
                    if path.suffix == ".py" and "agent" in path.stem.lower():
                        agent = self.parse_agent_script(content, path.name)
                        agent["source_path"] = filepath
                        result["agents"].append(agent)
                    # Skip other files in agents/ folder (helpers, utils, etc.)
                # Files in skills/ or commands/ folder → skills (only direct children, not nested)
                # Handle both "skills/..." and ".../skills/..." patterns
                elif "/skills/" in lower_path or "\\skills\\" in lower_path or lower_path.startswith("skills/") or "/commands/" in lower_path or "\\commands\\" in lower_path or lower_path.startswith("commands/"):
                    # Count depth from skills/ folder to determine if this is a skill
                    # e.g., "skills/loader.py" → skill (1 level deep)
                    # e.g., "skills/my-skill/helper.py" → could be skill helper (2 levels deep)
                    # e.g., "skills/my-skill/templates/file.js" → NOT a skill (3+ levels deep)
                    if "/skills/" in lower_path:
                        parts_after_skills = lower_path.split("/skills/")[-1].split("/")
                    elif "\\skills\\" in lower_path:
                        parts_after_skills = lower_path.split("\\skills\\")[-1].split("\\")
                    else:
                        parts_after_skills = lower_path.split("skills/")[-1].split("/")
                    depth = len(parts_after_skills)
                    if depth <= 2:  # Direct file or file in skill's own folder
                        # Use stem (no extension) as skill name for cleaner display
                        skill_name = path.stem
                        skill = self.parse_code_file(content, skill_name, path.suffix)
                        skill["name"] = skill_name  # Override the filename with stem
                        skill["type"] = "skill"
                        skill["source_path"] = filepath
                        result["skills"].append(skill)
                    # Deeply nested code files are skipped (kept only in raw)
                    # Memory should only be .md and .txt files
                # *agent*.py files → agents (check this BEFORE default handling)
                elif path.suffix == ".py" and "agent" in path.stem.lower():
                    agent = self.parse_agent_script(content, path.name)
                    agent["source_path"] = filepath
                    result["agents"].append(agent)
                # Python files NOT in recognized folders (skills/, commands/, tools/, agents/)
                # are utility/library code - skip them (keep only in raw)
                # Other code files (.js, .ts, etc.) not in recognized folders are also skipped

        return result

    def parse_code_file(self, content: str, filename: str, suffix: str) -> dict:
        """Parse a code file as a memory/source item.

        Args:
            content: The raw content of the code file.
            filename: The filename.
            suffix: The file extension.

        Returns:
            A dictionary containing:
                - name: Filename
                - type: Always "memory" (for compatibility)
                - description: Auto-generated description with file type
                - content: Full file content
                - config: Contains file_type metadata
        """
        file_types = {
            ".py": "Python",
            ".js": "JavaScript",
            ".ts": "TypeScript",
            ".jsx": "React JSX",
            ".tsx": "React TSX",
            ".json": "JSON",
            ".yaml": "YAML",
            ".yml": "YAML",
            ".sh": "Shell",
            ".bash": "Bash",
            ".css": "CSS",
            ".html": "HTML",
        }
        file_type = file_types.get(suffix, "Code")

        # Extract first docstring or comment as description
        description = f"{file_type} file: {filename}"
        lines = content.strip().split('\n')

        # Try to extract a meaningful description from the first comment/docstring
        if suffix == ".py":
            # Look for module docstring
            if lines and (lines[0].startswith('"""') or lines[0].startswith("'''")):
                quote = lines[0][:3]
                if quote in lines[0][3:]:
                    # Single line docstring
                    description = lines[0][3:lines[0].index(quote, 3)].strip()
                else:
                    # Multi-line docstring
                    for i, line in enumerate(lines[1:], 1):
                        if quote in line:
                            docstring_lines = [lines[0][3:]] + lines[1:i]
                            description = ' '.join(l.strip() for l in docstring_lines)[:200]
                            break
            elif lines and lines[0].startswith('#'):
                description = lines[0][1:].strip()[:200]
        elif suffix in [".js", ".ts", ".jsx", ".tsx"]:
            # Look for leading comment
            if lines and lines[0].startswith('//'):
                description = lines[0][2:].strip()[:200]
            elif lines and lines[0].startswith('/*'):
                description = lines[0][2:].strip().rstrip('*/').strip()[:200]

        return {
            "name": filename,
            "type": "memory",
            "description": description,
            "content": content,
            "config": {"file_type": file_type},
        }
