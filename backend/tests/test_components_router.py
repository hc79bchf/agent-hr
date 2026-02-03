import pytest
import io
import zipfile


def setup_agent_with_version(client):
    client.post("/api/auth/register", json={
        "email": "comp_test@example.com",
        "name": "Component Tester",
        "password": "password123"
    })
    response = client.post("/api/auth/login", json={
        "email": "comp_test@example.com",
        "password": "password123"
    })
    headers = {"Authorization": f"Bearer {response.json()['access_token']}"}

    agent_response = client.post("/api/agents", json={"name": "Component Test Agent"}, headers=headers)
    agent_id = agent_response.json()["id"]

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w') as zf:
        zf.writestr(".claude/commands/editable.md", "# Editable Skill\n\nOriginal content.")
    buffer.seek(0)

    upload_response = client.post(
        f"/api/agents/{agent_id}/upload",
        files={"file": ("config.zip", buffer, "application/zip")},
        headers=headers
    )
    version_id = upload_response.json()["id"]

    return headers, agent_id, version_id


def test_list_components(client):
    headers, agent_id, version_id = setup_agent_with_version(client)

    response = client.get(f"/api/versions/{version_id}/components", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) >= 1


def test_get_component(client):
    headers, agent_id, version_id = setup_agent_with_version(client)

    # Get component ID
    components = client.get(f"/api/versions/{version_id}/components", headers=headers).json()
    component_id = components[0]["id"]

    response = client.get(f"/api/versions/{version_id}/components/{component_id}", headers=headers)
    assert response.status_code == 200
    assert response.json()["id"] == component_id


def test_get_component_not_found(client):
    headers, agent_id, version_id = setup_agent_with_version(client)

    response = client.get(
        f"/api/versions/{version_id}/components/00000000-0000-0000-0000-000000000000",
        headers=headers
    )
    assert response.status_code == 404


def test_edit_component_creates_new_version(client):
    headers, agent_id, version_id = setup_agent_with_version(client)

    # Get component ID
    components = client.get(f"/api/versions/{version_id}/components", headers=headers).json()
    component_id = components[0]["id"]

    # Edit component
    response = client.patch(
        f"/api/versions/{version_id}/components/{component_id}",
        json={"content": "# Updated Skill\n\nNew content here."},
        headers=headers
    )

    assert response.status_code == 201
    data = response.json()
    assert data["new_version"]["version_number"] == 2
    assert "Updated" in data["component"]["content"]


def test_edit_component_preserves_other_components(client):
    """Test that editing one component preserves other components in new version"""
    client.post("/api/auth/register", json={
        "email": "comp_preserve@example.com",
        "name": "Preserve Tester",
        "password": "password123"
    })
    response = client.post("/api/auth/login", json={
        "email": "comp_preserve@example.com",
        "password": "password123"
    })
    headers = {"Authorization": f"Bearer {response.json()['access_token']}"}

    agent_response = client.post("/api/agents", json={"name": "Preserve Test Agent"}, headers=headers)
    agent_id = agent_response.json()["id"]

    # Create zip with multiple components
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w') as zf:
        zf.writestr(".claude/commands/skill1.md", "# Skill 1\n\nFirst skill.")
        zf.writestr(".claude/commands/skill2.md", "# Skill 2\n\nSecond skill.")
    buffer.seek(0)

    upload_response = client.post(
        f"/api/agents/{agent_id}/upload",
        files={"file": ("config.zip", buffer, "application/zip")},
        headers=headers
    )
    version_id = upload_response.json()["id"]
    original_components = upload_response.json()["components"]
    assert len(original_components) == 2

    # Edit just the first component
    component_id = original_components[0]["id"]
    response = client.patch(
        f"/api/versions/{version_id}/components/{component_id}",
        json={"content": "# Skill 1 Updated\n\nModified content."},
        headers=headers
    )

    assert response.status_code == 201
    new_version_id = response.json()["new_version"]["id"]

    # Check new version has all components
    new_components = client.get(f"/api/versions/{new_version_id}/components", headers=headers).json()
    assert len(new_components) == 2


def test_edit_component_version_not_found(client):
    headers, agent_id, version_id = setup_agent_with_version(client)

    response = client.patch(
        "/api/versions/00000000-0000-0000-0000-000000000000/components/00000000-0000-0000-0000-000000000000",
        json={"content": "New content"},
        headers=headers
    )
    assert response.status_code == 404


def test_edit_component_requires_auth(client):
    response = client.patch(
        "/api/versions/00000000-0000-0000-0000-000000000000/components/00000000-0000-0000-0000-000000000000",
        json={"content": "New content"},
    )
    assert response.status_code == 401


def test_list_components_requires_auth(client):
    response = client.get("/api/versions/00000000-0000-0000-0000-000000000000/components")
    assert response.status_code == 401
