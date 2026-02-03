"""Tests for the export router."""

import io
import zipfile
import pytest


def get_auth_header(client):
    """Register and login a test user, return auth header."""
    client.post("/api/auth/register", json={
        "email": "export_test@example.com",
        "name": "Export Tester",
        "password": "password123"
    })
    response = client.post("/api/auth/login", json={
        "email": "export_test@example.com",
        "password": "password123"
    })
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def create_test_zip():
    """Create a zip file with test content."""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(".claude/commands/test-skill.md", "# Test Skill\n\nThis is a test skill.")
        zf.writestr(".claude/commands/another-skill.md", "# Another Skill\n\nAnother skill description.")
        zf.writestr("mcp.json", '{"mcpServers": {"test-tool": {"command": "test"}}}')
        zf.writestr("CLAUDE.md", "# Project\n\nTest project instructions.")
    buffer.seek(0)
    return buffer


def test_export_all_components(client):
    """Test exporting an agent with no exclusions (all components included)."""
    headers = get_auth_header(client)

    # Create agent
    agent_response = client.post("/api/agents", json={"name": "Export Test Agent"}, headers=headers)
    agent_id = agent_response.json()["id"]

    # Upload files to create version with components
    zip_file = create_test_zip()
    upload_response = client.post(
        f"/api/agents/{agent_id}/upload",
        files={"file": ("config.zip", zip_file, "application/zip")},
        headers=headers
    )
    assert upload_response.status_code == 201

    # Export with no exclusions
    response = client.post(
        f"/api/agents/{agent_id}/export",
        json={"excluded_component_ids": []},
        headers=headers
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    assert "attachment" in response.headers.get("content-disposition", "")

    # Verify zip contents
    zip_buffer = io.BytesIO(response.content)
    with zipfile.ZipFile(zip_buffer, 'r') as zf:
        names = zf.namelist()
        # Should contain all original files
        assert ".claude/commands/test-skill.md" in names
        assert ".claude/commands/another-skill.md" in names
        assert "mcp.json" in names
        assert "CLAUDE.md" in names


def test_export_with_exclusions(client):
    """Test exporting an agent with some components excluded."""
    headers = get_auth_header(client)

    # Create agent
    agent_response = client.post("/api/agents", json={"name": "Export Exclusion Test"}, headers=headers)
    agent_id = agent_response.json()["id"]

    # Upload files
    zip_file = create_test_zip()
    upload_response = client.post(
        f"/api/agents/{agent_id}/upload",
        files={"file": ("config.zip", zip_file, "application/zip")},
        headers=headers
    )
    assert upload_response.status_code == 201
    version_data = upload_response.json()

    # Get component IDs - exclude the first skill
    components = version_data["components"]
    skills = [c for c in components if c["type"] == "skill"]
    assert len(skills) >= 1
    excluded_id = skills[0]["id"]
    excluded_source_path = skills[0]["source_path"]

    # Export with one skill excluded
    response = client.post(
        f"/api/agents/{agent_id}/export",
        json={"excluded_component_ids": [excluded_id]},
        headers=headers
    )

    assert response.status_code == 200

    # Verify zip does not contain excluded component
    zip_buffer = io.BytesIO(response.content)
    with zipfile.ZipFile(zip_buffer, 'r') as zf:
        names = zf.namelist()
        # Excluded skill should not be present
        assert excluded_source_path not in names
        # Other components should still be present
        assert "CLAUDE.md" in names


def test_export_nonexistent_agent(client):
    """Test that exporting a nonexistent agent returns 404."""
    headers = get_auth_header(client)

    response = client.post(
        "/api/agents/00000000-0000-0000-0000-000000000000/export",
        json={"excluded_component_ids": []},
        headers=headers
    )

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_export_agent_without_version(client):
    """Test that exporting an agent with no current version returns 400."""
    headers = get_auth_header(client)

    # Create agent without uploading any files (no version)
    agent_response = client.post(
        "/api/agents",
        json={"name": "No Version Agent"},
        headers=headers
    )
    agent_id = agent_response.json()["id"]

    response = client.post(
        f"/api/agents/{agent_id}/export",
        json={"excluded_component_ids": []},
        headers=headers
    )

    assert response.status_code == 400
    assert "no current version" in response.json()["detail"].lower()


def test_export_requires_auth(client):
    """Test that export requires authentication."""
    response = client.post(
        "/api/agents/00000000-0000-0000-0000-000000000000/export",
        json={"excluded_component_ids": []},
    )

    assert response.status_code == 401


def test_export_preserves_folder_structure(client):
    """Test that export preserves the original folder structure based on source_path."""
    headers = get_auth_header(client)

    # Create agent
    agent_response = client.post("/api/agents", json={"name": "Structure Test Agent"}, headers=headers)
    agent_id = agent_response.json()["id"]

    # Create a zip with nested structure
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(".claude/commands/deploy.md", "# Deploy\n\nDeploy command.")
        zf.writestr(".claude/agents/assistant.md", "# Assistant\n\nAssistant agent.")
        zf.writestr("nested/config/settings.md", "# Settings\n\nSettings file.")
    buffer.seek(0)

    # Upload
    upload_response = client.post(
        f"/api/agents/{agent_id}/upload",
        files={"file": ("config.zip", buffer, "application/zip")},
        headers=headers
    )
    assert upload_response.status_code == 201

    # Export
    response = client.post(
        f"/api/agents/{agent_id}/export",
        json={"excluded_component_ids": []},
        headers=headers
    )

    assert response.status_code == 200

    # Verify structure is preserved
    zip_buffer = io.BytesIO(response.content)
    with zipfile.ZipFile(zip_buffer, 'r') as zf:
        names = zf.namelist()
        assert ".claude/commands/deploy.md" in names
        assert ".claude/agents/assistant.md" in names
        assert "nested/config/settings.md" in names


def test_export_filename_contains_agent_name(client):
    """Test that export filename contains sanitized agent name."""
    headers = get_auth_header(client)

    # Create agent with a specific name
    agent_response = client.post(
        "/api/agents",
        json={"name": "My Test Agent"},
        headers=headers
    )
    agent_id = agent_response.json()["id"]

    # Upload files
    zip_file = create_test_zip()
    client.post(
        f"/api/agents/{agent_id}/upload",
        files={"file": ("config.zip", zip_file, "application/zip")},
        headers=headers
    )

    # Export
    response = client.post(
        f"/api/agents/{agent_id}/export",
        json={"excluded_component_ids": []},
        headers=headers
    )

    assert response.status_code == 200
    content_disposition = response.headers.get("content-disposition", "")
    assert "my-test-agent" in content_disposition.lower() or "my_test_agent" in content_disposition.lower()


def test_export_mcp_tool_structure(client):
    """Test that MCP tool components export with correct structure."""
    headers = get_auth_header(client)

    # Create agent
    agent_response = client.post("/api/agents", json={"name": "MCP Export Test"}, headers=headers)
    agent_id = agent_response.json()["id"]

    # Create zip with MCP config
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("mcp.json", '{"mcpServers": {"github": {"command": "npx", "args": ["github-mcp"]}}}')
    buffer.seek(0)

    # Upload
    upload_response = client.post(
        f"/api/agents/{agent_id}/upload",
        files={"file": ("config.zip", buffer, "application/zip")},
        headers=headers
    )
    assert upload_response.status_code == 201

    # Export
    response = client.post(
        f"/api/agents/{agent_id}/export",
        json={"excluded_component_ids": []},
        headers=headers
    )

    assert response.status_code == 200

    # Verify MCP config is present
    zip_buffer = io.BytesIO(response.content)
    with zipfile.ZipFile(zip_buffer, 'r') as zf:
        names = zf.namelist()
        # MCP tools should be in mcp.json
        assert "mcp.json" in names
