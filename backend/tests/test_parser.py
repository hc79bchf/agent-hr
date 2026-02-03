import pytest
from app.services.parser import ConfigParser


def test_parse_skill_file():
    parser = ConfigParser()
    content = """# Code Review Skill

This skill reviews code for issues.

## Usage
Run `/review` to start a code review.
"""
    result = parser.parse_skill(content, "code-review.md")

    assert result["name"] == "code-review"
    assert result["type"] == "skill"
    assert "reviews code" in result["description"].lower()


def test_parse_mcp_config():
    parser = ConfigParser()
    content = """{
        "mcpServers": {
            "github": {
                "command": "npx",
                "args": ["-y", "@modelcontextprotocol/server-github"]
            }
        }
    }"""
    result = parser.parse_mcp_config(content)

    assert len(result) == 1
    assert result[0]["name"] == "github"
    assert result[0]["type"] == "mcp_tool"


def test_parse_claude_md():
    parser = ConfigParser()
    content = """# Project Instructions

This is a Python project for managing agents.

## Key Points
- Use FastAPI
- Follow TDD
"""
    result = parser.parse_memory(content, "CLAUDE.md")

    assert result["name"] == "CLAUDE.md"
    assert result["type"] == "memory"
    assert "Python project" in result["content"]


def test_parse_skill_extracts_description():
    """Test that description is extracted from first paragraph after title."""
    parser = ConfigParser()
    content = """# Security Scanner

Analyzes code for security vulnerabilities and common attack patterns.

## Features
- SQL injection detection
- XSS detection
"""
    result = parser.parse_skill(content, "security-scanner.md")

    assert result["name"] == "security-scanner"
    assert "security vulnerabilities" in result["description"].lower()


def test_parse_mcp_config_multiple_servers():
    """Test parsing MCP config with multiple servers."""
    parser = ConfigParser()
    content = """{
        "mcpServers": {
            "github": {
                "command": "npx",
                "args": ["-y", "@modelcontextprotocol/server-github"]
            },
            "slack": {
                "command": "npx",
                "args": ["-y", "@modelcontextprotocol/server-slack"]
            }
        }
    }"""
    result = parser.parse_mcp_config(content)

    assert len(result) == 2
    names = [r["name"] for r in result]
    assert "github" in names
    assert "slack" in names


def test_parse_mcp_config_invalid_json():
    """Test that invalid JSON returns empty list."""
    parser = ConfigParser()
    content = "this is not valid json"
    result = parser.parse_mcp_config(content)

    assert result == []


def test_parse_memory_truncates_description():
    """Test that memory description is truncated to 200 chars."""
    parser = ConfigParser()
    long_text = "A" * 300
    content = f"""# Project

{long_text}
"""
    result = parser.parse_memory(content, "README.md")

    assert len(result["description"]) <= 200


def test_parse_uploaded_files_skills():
    """Test parsing uploaded files identifies skills from .claude/commands/."""
    parser = ConfigParser()
    files = {
        ".claude/commands/review.md": """# Review Command

Reviews pull requests for issues.
""",
        ".claude/commands/test.md": """# Test Command

Runs tests on the codebase.
"""
    }
    result = parser.parse_uploaded_files(files)

    assert len(result["skills"]) == 2
    skill_names = [s["name"] for s in result["skills"]]
    assert "review" in skill_names
    assert "test" in skill_names


def test_parse_uploaded_files_mcp_tools():
    """Test parsing uploaded files identifies MCP tools."""
    parser = ConfigParser()
    files = {
        "mcp.json": """{
            "mcpServers": {
                "filesystem": {
                    "command": "node",
                    "args": ["fs-server"]
                }
            }
        }"""
    }
    result = parser.parse_uploaded_files(files)

    assert len(result["mcp_tools"]) == 1
    assert result["mcp_tools"][0]["name"] == "filesystem"


def test_parse_uploaded_files_memory():
    """Test parsing uploaded files identifies memory files."""
    parser = ConfigParser()
    files = {
        "CLAUDE.md": """# Project

This is the main project file.
""",
        "docs/guide.md": """# Guide

Developer guide for the project.
"""
    }
    result = parser.parse_uploaded_files(files)

    assert len(result["memory"]) == 2
    memory_names = [m["name"] for m in result["memory"]]
    assert "CLAUDE.md" in memory_names
    assert "guide.md" in memory_names


def test_parse_uploaded_files_preserves_raw():
    """Test that raw files dictionary is preserved."""
    parser = ConfigParser()
    files = {"file1.txt": "content1", "file2.txt": "content2"}
    result = parser.parse_uploaded_files(files)

    assert result["raw"] == files


def test_parse_uploaded_files_agents_directory():
    """Test parsing files from .claude/agents/ directory."""
    parser = ConfigParser()
    files = {
        ".claude/agents/qa-agent.md": """# QA Agent

Automated testing and quality assurance agent.
"""
    }
    result = parser.parse_uploaded_files(files)

    # .claude/agents/*.md files are now parsed as agents, not skills
    assert len(result["agents"]) == 1
    assert result["agents"][0]["name"] == "qa-agent"
    assert result["agents"][0]["source_path"] == ".claude/agents/qa-agent.md"


def test_parse_uploaded_files_mixed_content():
    """Test parsing a mix of different file types."""
    parser = ConfigParser()
    files = {
        ".claude/commands/deploy.md": "# Deploy\n\nDeploys the application.",
        "mcp.json": '{"mcpServers": {"docker": {"command": "docker"}}}',
        "CLAUDE.md": "# Project\n\nProject instructions.",
        "README.md": "# README\n\nProject readme.",
        "src/main.py": "print('hello')",  # Non-parsed file
    }
    result = parser.parse_uploaded_files(files)

    assert len(result["skills"]) == 1
    assert len(result["mcp_tools"]) == 1
    assert len(result["memory"]) == 2  # CLAUDE.md and README.md
    assert "src/main.py" in result["raw"]  # Still in raw


def test_parse_uploaded_files_excludes_license_txt():
    """Test that LICENSE.txt is excluded from memory."""
    parser = ConfigParser()
    files = {
        "LICENSE.txt": "MIT License\n\nCopyright...",
        "memory/context.md": "# Context\n\nImportant context.",
    }
    result = parser.parse_uploaded_files(files)

    memory_names = [m["name"] for m in result["memory"]]
    assert "LICENSE.txt" not in memory_names
    assert "context.md" in memory_names


def test_parse_uploaded_files_excludes_readme_txt():
    """Test that README.txt is excluded from memory."""
    parser = ConfigParser()
    files = {
        "README.txt": "Read me first...",
        "notes.txt": "Important notes here.",
    }
    result = parser.parse_uploaded_files(files)

    memory_names = [m["name"] for m in result["memory"]]
    assert "README.txt" not in memory_names
    assert "notes.txt" in memory_names


def test_parse_uploaded_files_excludes_py_from_memory_folder():
    """Test that .py files in memory folder are excluded."""
    parser = ConfigParser()
    files = {
        "memory/helper.py": "def helper(): pass",
        "memory/context.md": "# Context\n\nThis is context.",
        "memories/loader.py": "class Loader: pass",
        "memories/knowledge.txt": "Knowledge content",
    }
    result = parser.parse_uploaded_files(files)

    memory_names = [m["name"] for m in result["memory"]]
    assert "helper.py" not in memory_names
    assert "loader.py" not in memory_names
    assert "context.md" in memory_names
    assert "knowledge.txt" in memory_names


def test_parse_uploaded_files_allows_valid_memory_txt():
    """Test that non-blocklisted .txt files are included as memory."""
    parser = ConfigParser()
    files = {
        "memory/guidelines.txt": "Follow these guidelines...",
        "docs/notes.txt": "Project notes here",
    }
    result = parser.parse_uploaded_files(files)

    memory_names = [m["name"] for m in result["memory"]]
    assert "guidelines.txt" in memory_names
    assert "notes.txt" in memory_names


def test_parse_agent_script_extracts_name():
    """Test that agent name is extracted from agent.py."""
    parser = ConfigParser()
    content = '''
import anthropic
from agent_sdk import Agent

agent = Agent(
    name="hr-assistant",
    instructions="You are an HR assistant that helps with employee questions.",
    model="claude-sonnet-4-5-20250929",
)
'''
    result = parser.parse_agent_script(content, "agent.py")

    assert result["name"] == "hr-assistant"
    assert result["type"] == "agent"


def test_parse_agent_script_extracts_description():
    """Test that agent description is extracted from instructions."""
    parser = ConfigParser()
    content = '''
agent = Agent(
    name="support-bot",
    instructions="You are a helpful support bot that assists customers with their inquiries about products and services.",
    model="claude-3-opus",
)
'''
    result = parser.parse_agent_script(content, "agent.py")

    assert "helpful support bot" in result["description"]


def test_parse_agent_script_extracts_model():
    """Test that model is extracted from agent.py."""
    parser = ConfigParser()
    content = '''
agent = Agent(
    name="analyst",
    instructions="Analyze data.",
    model="claude-sonnet-4-5-20250929",
)
'''
    result = parser.parse_agent_script(content, "agent.py")

    assert result["config"]["model"] == "claude-sonnet-4-5-20250929"


def test_parse_agent_script_multiline_instructions():
    """Test that multiline instructions are handled."""
    parser = ConfigParser()
    content = '''
agent = Agent(
    name="writer",
    instructions="""You are a creative writer.

You help users write stories and articles.
You always maintain a friendly tone.""",
    model="claude-3-opus",
)
'''
    result = parser.parse_agent_script(content, "agent.py")

    assert "creative writer" in result["description"]


def test_parse_agent_script_fallback_to_filename():
    """Test that filename is used when name cannot be parsed."""
    parser = ConfigParser()
    content = '''
# Some agent code without standard Agent() call
import something
do_something()
'''
    result = parser.parse_agent_script(content, "my-agent.py")

    assert result["name"] == "my-agent"
    assert result["type"] == "agent"


def test_parse_uploaded_files_agents_folder_agent_py():
    """Test that agents/agent.py is parsed as agent with metadata."""
    parser = ConfigParser()
    files = {
        "agents/agent.py": '''
agent = Agent(
    name="sales-helper",
    instructions="You help with sales inquiries.",
    model="claude-sonnet-4-5-20250929",
)
'''
    }
    result = parser.parse_uploaded_files(files)

    assert len(result["agents"]) == 1
    assert result["agents"][0]["name"] == "sales-helper"
    assert result["agents"][0]["config"]["model"] == "claude-sonnet-4-5-20250929"


def test_parse_uploaded_files_excludes_code_from_memory():
    """Test that code files (.js, .py, etc.) are never added as memory."""
    parser = ConfigParser()
    files = {
        # Nested code files in skills folders should NOT be memory
        # Test both path patterns: "skills/..." and ".claude/skills/..."
        "skills/brand-guidelines/templates/generator_template.js": "// template code",
        ".claude/skills/my-skill/helpers/utils.py": "# helper code",
        ".claude/skills/test/nested/deep/file.ts": "// typescript",
        # Only .md and .txt should be memory
        "docs/guide.md": "# Guide\n\nThis is a guide.",
        "notes.txt": "Some notes here.",
    }
    result = parser.parse_uploaded_files(files)

    # Check that no code files ended up in memory
    memory_names = [m["name"] for m in result["memory"]]
    assert "generator_template.js" not in memory_names
    assert "utils.py" not in memory_names
    assert "file.ts" not in memory_names

    # Only .md and .txt should be in memory
    assert "guide.md" in memory_names
    assert "notes.txt" in memory_names
    assert len(result["memory"]) == 2


def test_parse_uploaded_files_excludes_examples_folder():
    """Test that files in examples/ folders are excluded from parsing."""
    parser = ConfigParser()
    files = {
        # Example files should NOT be parsed as agents
        "examples/basic_usage.py": "# Basic usage example",
        "agent_foundation/examples/sdk_usage.py": "# SDK usage example",
        "my-project/examples/demo.js": "// Demo script",
        # Actual agent file should be parsed
        "agents/agent.py": '''
agent = Agent(
    name="real-agent",
    instructions="This is the real agent.",
    model="claude-sonnet-4-5-20250929",
)
''',
    }
    result = parser.parse_uploaded_files(files)

    # Only the real agent should be parsed, not examples
    assert len(result["agents"]) == 1
    assert result["agents"][0]["name"] == "real-agent"

    # Example files should be in raw but not parsed
    agent_names = [a["name"] for a in result["agents"]]
    assert "basic_usage.py" not in agent_names
    assert "sdk_usage.py" not in agent_names
    assert "demo.js" not in agent_names

    # Raw should still have all files
    assert "examples/basic_usage.py" in result["raw"]
    assert "agent_foundation/examples/sdk_usage.py" in result["raw"]


def test_parse_uploaded_files_only_agent_py_files():
    """Test that only *agent*.py files are parsed as agents, other Python files are skills."""
    parser = ConfigParser()
    files = {
        # Agent files matching *agent*.py pattern should be parsed as agents
        "agents/agent.py": '''
agent = Agent(
    name="main-agent",
    instructions="Main agent.",
    model="claude-sonnet-4-5-20250929",
)
''',
        "my_agent.py": '''
agent = Agent(
    name="my-custom-agent",
    instructions="Custom agent.",
    model="claude-3-opus",
)
''',
        "hr-agent.py": '''
agent = Agent(
    name="hr-assistant",
    instructions="HR assistant.",
)
''',
        # Non-agent Python files should be parsed as SKILLS (not agents)
        "loader.py": "# Loader script",
        "processor.py": "# Processor module",
    }
    result = parser.parse_uploaded_files(files)

    # Only *agent*.py files should be agents
    agent_names = [a["name"] for a in result["agents"]]
    assert "main-agent" in agent_names
    assert "my-custom-agent" in agent_names
    assert "hr-assistant" in agent_names
    assert len(result["agents"]) == 3

    # Non-agent Python files should be SKIPPED (only in raw)
    skill_names = [s["name"] for s in result["skills"]]
    assert "loader" not in skill_names
    assert "processor" not in skill_names


def test_parse_uploaded_files_python_not_in_recognized_folders_skipped():
    """Test that Python files not in recognized folders are skipped (only kept in raw)."""
    parser = ConfigParser()
    files = {
        # Files in tools folder → MCP tools
        "project/tools/helper.py": "# Tool helper",
        # Files in memory folder → skipped
        "project/memory/cache.py": "# Cache module",
        # Files in agents folder without 'agent' in name → skipped
        "project/agents/utils.py": "# Agent utils",
        # Other Python files → SKIPPED (only in raw)
        "project/core/engine.py": "# Engine module",
        "project/utils/helpers.py": "# Helpers",
        "main.py": "# Main entry",
    }
    result = parser.parse_uploaded_files(files)

    # Tools should include files from /tools/
    tool_names = [t["name"] for t in result["mcp_tools"]]
    assert "helper.py" in tool_names

    # Python files not in recognized folders should NOT be skills
    skill_names = [s["name"] for s in result["skills"]]
    assert "engine" not in skill_names
    assert "helpers" not in skill_names
    assert "main" not in skill_names

    # Memory folder code files should be skipped
    assert "cache.py" not in skill_names
    assert "cache" not in skill_names

    # No agents (no *agent*.py files)
    assert len(result["agents"]) == 0

    # All files should still be in raw
    assert "project/core/engine.py" in result["raw"]
    assert "project/utils/helpers.py" in result["raw"]
    assert "main.py" in result["raw"]
