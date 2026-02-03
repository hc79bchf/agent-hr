import pytest
import io
import zipfile


def get_auth_header(client):
    client.post("/api/auth/register", json={
        "email": "upload_test@example.com",
        "name": "Upload Tester",
        "password": "password123"
    })
    response = client.post("/api/auth/login", json={
        "email": "upload_test@example.com",
        "password": "password123"
    })
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def create_test_zip():
    """Create a zip file with test content"""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(".claude/commands/test-skill.md", "# Test Skill\n\nThis is a test skill.")
        zf.writestr("CLAUDE.md", "# Project\n\nTest project instructions.")
    buffer.seek(0)
    return buffer


def test_upload_creates_version(client):
    headers = get_auth_header(client)

    # Create agent first
    agent_response = client.post("/api/agents", json={"name": "Upload Test Agent"}, headers=headers)
    agent_id = agent_response.json()["id"]

    # Upload files
    zip_file = create_test_zip()
    response = client.post(
        f"/api/agents/{agent_id}/upload",
        files={"file": ("config.zip", zip_file, "application/zip")},
        headers=headers
    )

    assert response.status_code == 201
    data = response.json()
    assert data["version_number"] == 1
    assert len(data["components"]) >= 2  # skill + memory


def test_upload_increments_version(client):
    """Test that uploading again increments the version number"""
    headers = get_auth_header(client)

    # Create agent first
    agent_response = client.post("/api/agents", json={"name": "Multi Version Agent"}, headers=headers)
    agent_id = agent_response.json()["id"]

    # First upload
    zip_file1 = create_test_zip()
    response1 = client.post(
        f"/api/agents/{agent_id}/upload",
        files={"file": ("config.zip", zip_file1, "application/zip")},
        headers=headers
    )
    assert response1.status_code == 201
    assert response1.json()["version_number"] == 1

    # Second upload
    zip_file2 = create_test_zip()
    response2 = client.post(
        f"/api/agents/{agent_id}/upload",
        files={"file": ("config.zip", zip_file2, "application/zip")},
        headers=headers
    )
    assert response2.status_code == 201
    assert response2.json()["version_number"] == 2


def test_upload_to_nonexistent_agent(client):
    """Test that uploading to a nonexistent agent returns 404"""
    headers = get_auth_header(client)

    zip_file = create_test_zip()
    response = client.post(
        "/api/agents/00000000-0000-0000-0000-000000000000/upload",
        files={"file": ("config.zip", zip_file, "application/zip")},
        headers=headers
    )

    assert response.status_code == 404


def test_upload_invalid_zip(client):
    """Test that uploading an invalid zip returns 400"""
    headers = get_auth_header(client)

    # Create agent first
    agent_response = client.post("/api/agents", json={"name": "Invalid Zip Agent"}, headers=headers)
    agent_id = agent_response.json()["id"]

    # Upload invalid zip
    invalid_content = io.BytesIO(b"not a zip file")
    response = client.post(
        f"/api/agents/{agent_id}/upload",
        files={"file": ("config.zip", invalid_content, "application/zip")},
        headers=headers
    )

    assert response.status_code == 400


def test_upload_single_file(client):
    """Test uploading a single file instead of a zip"""
    headers = get_auth_header(client)

    # Create agent first
    agent_response = client.post("/api/agents", json={"name": "Single File Agent"}, headers=headers)
    agent_id = agent_response.json()["id"]

    # Upload a single markdown file
    content = io.BytesIO(b"# Test Memory\n\nThis is a memory file.")
    response = client.post(
        f"/api/agents/{agent_id}/upload",
        files={"file": ("CLAUDE.md", content, "text/markdown")},
        headers=headers
    )

    assert response.status_code == 201
    data = response.json()
    assert data["version_number"] == 1
    assert len(data["components"]) == 1


def test_upload_requires_auth(client):
    """Test that upload requires authentication"""
    zip_file = create_test_zip()
    response = client.post(
        "/api/agents/00000000-0000-0000-0000-000000000000/upload",
        files={"file": ("config.zip", zip_file, "application/zip")},
    )

    assert response.status_code == 401
