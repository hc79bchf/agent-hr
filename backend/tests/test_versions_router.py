import pytest
import io
import zipfile


def get_auth_and_agent(client):
    """Helper to create user, login, and create an agent with a version."""
    client.post("/api/auth/register", json={
        "email": "version_test@example.com",
        "name": "Version Tester",
        "password": "password123"
    })
    response = client.post("/api/auth/login", json={
        "email": "version_test@example.com",
        "password": "password123"
    })
    headers = {"Authorization": f"Bearer {response.json()['access_token']}"}

    agent_response = client.post("/api/agents", json={"name": "Version Test Agent"}, headers=headers)
    agent_id = agent_response.json()["id"]

    # Upload to create version
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w') as zf:
        zf.writestr(".claude/commands/skill.md", "# Skill\n\nA skill.")
    buffer.seek(0)
    client.post(f"/api/agents/{agent_id}/upload", files={"file": ("config.zip", buffer, "application/zip")}, headers=headers)

    return headers, agent_id


def test_list_versions(client):
    """Test listing versions for an agent."""
    headers, agent_id = get_auth_and_agent(client)

    response = client.get(f"/api/agents/{agent_id}/versions", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["data"][0]["version_number"] == 1


def test_list_versions_pagination(client):
    """Test pagination of versions list."""
    headers, agent_id = get_auth_and_agent(client)

    # Create a second version
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w') as zf:
        zf.writestr(".claude/commands/skill2.md", "# Skill 2\n\nAnother skill.")
    buffer.seek(0)
    client.post(f"/api/agents/{agent_id}/upload", files={"file": ("config.zip", buffer, "application/zip")}, headers=headers)

    # Test pagination
    response = client.get(f"/api/agents/{agent_id}/versions?skip=0&limit=1", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert len(data["data"]) == 1
    # Should return newest first (version 2)
    assert data["data"][0]["version_number"] == 2


def test_list_versions_agent_not_found(client):
    """Test listing versions for nonexistent agent."""
    client.post("/api/auth/register", json={
        "email": "notfound@example.com",
        "name": "Not Found Tester",
        "password": "password123"
    })
    response = client.post("/api/auth/login", json={
        "email": "notfound@example.com",
        "password": "password123"
    })
    headers = {"Authorization": f"Bearer {response.json()['access_token']}"}

    response = client.get("/api/agents/00000000-0000-0000-0000-000000000000/versions", headers=headers)
    assert response.status_code == 404


def test_get_version(client):
    """Test getting a specific version."""
    headers, agent_id = get_auth_and_agent(client)

    # Get version list first
    list_response = client.get(f"/api/agents/{agent_id}/versions", headers=headers)
    version_id = list_response.json()["data"][0]["id"]

    response = client.get(f"/api/agents/{agent_id}/versions/{version_id}", headers=headers)
    assert response.status_code == 200
    assert response.json()["version_number"] == 1


def test_get_version_not_found(client):
    """Test getting a nonexistent version."""
    headers, agent_id = get_auth_and_agent(client)

    response = client.get(f"/api/agents/{agent_id}/versions/00000000-0000-0000-0000-000000000000", headers=headers)
    assert response.status_code == 404


def test_rollback_to_version(client):
    """Test rolling back to a previous version."""
    headers, agent_id = get_auth_and_agent(client)

    # Get version 1 ID
    list_response = client.get(f"/api/agents/{agent_id}/versions", headers=headers)
    version1_id = list_response.json()["data"][0]["id"]

    # Upload again to create version 2
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w') as zf:
        zf.writestr(".claude/commands/skill2.md", "# Skill 2\n\nA different skill.")
    buffer.seek(0)
    client.post(f"/api/agents/{agent_id}/upload", files={"file": ("config.zip", buffer, "application/zip")}, headers=headers)

    # Rollback to version 1
    response = client.post(f"/api/agents/{agent_id}/rollback/{version1_id}", headers=headers)
    assert response.status_code == 201
    data = response.json()
    assert data["version_number"] == 3
    assert data["change_type"] == "rollback"
    assert "Rollback to version 1" in data["change_summary"]


def test_rollback_version_not_found(client):
    """Test rolling back to a nonexistent version."""
    headers, agent_id = get_auth_and_agent(client)

    response = client.post(f"/api/agents/{agent_id}/rollback/00000000-0000-0000-0000-000000000000", headers=headers)
    assert response.status_code == 404


def test_versions_require_auth(client):
    """Test that versions endpoints require authentication."""
    response = client.get("/api/agents/00000000-0000-0000-0000-000000000000/versions")
    assert response.status_code == 401

    response = client.get("/api/agents/00000000-0000-0000-0000-000000000000/versions/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 401

    response = client.post("/api/agents/00000000-0000-0000-0000-000000000000/rollback/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 401
