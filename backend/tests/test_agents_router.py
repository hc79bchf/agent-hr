def get_auth_header(client):
    """Helper to register and login, returning auth header"""
    client.post("/api/auth/register", json={
        "email": "agent_test@example.com",
        "name": "Agent Tester",
        "password": "password123"
    })
    response = client.post("/api/auth/login", json={
        "email": "agent_test@example.com",
        "password": "password123"
    })
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_create_agent(client):
    headers = get_auth_header(client)
    response = client.post("/api/agents", json={
        "name": "Test Agent",
        "description": "A test agent",
        "tags": ["test"],
        "department": "Engineering"
    }, headers=headers)

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Agent"
    assert data["status"] == "draft"


def test_list_agents(client):
    headers = get_auth_header(client)
    # Create an agent first
    client.post("/api/agents", json={"name": "Agent 1"}, headers=headers)

    response = client.get("/api/agents", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1


def test_get_agent(client):
    headers = get_auth_header(client)
    # Create an agent
    create_response = client.post("/api/agents", json={"name": "Get Test Agent"}, headers=headers)
    agent_id = create_response.json()["id"]

    response = client.get(f"/api/agents/{agent_id}", headers=headers)
    assert response.status_code == 200
    assert response.json()["name"] == "Get Test Agent"


def test_update_agent(client):
    headers = get_auth_header(client)
    # Create an agent
    create_response = client.post("/api/agents", json={"name": "Update Test"}, headers=headers)
    agent_id = create_response.json()["id"]

    response = client.patch(f"/api/agents/{agent_id}", json={
        "name": "Updated Name",
        "status": "active"
    }, headers=headers)
    assert response.status_code == 200
    assert response.json()["name"] == "Updated Name"
    assert response.json()["status"] == "active"


def test_delete_agent(client):
    headers = get_auth_header(client)
    # Create an agent
    create_response = client.post("/api/agents", json={"name": "Delete Test"}, headers=headers)
    agent_id = create_response.json()["id"]

    # Delete the agent
    response = client.delete(f"/api/agents/{agent_id}", headers=headers)
    assert response.status_code == 204

    # Verify it's no longer accessible
    get_response = client.get(f"/api/agents/{agent_id}", headers=headers)
    assert get_response.status_code == 404


def test_get_nonexistent_agent(client):
    headers = get_auth_header(client)
    response = client.get("/api/agents/00000000-0000-0000-0000-000000000000", headers=headers)
    assert response.status_code == 404


def test_create_agent_unauthenticated(client):
    response = client.post("/api/agents", json={"name": "Test Agent"})
    assert response.status_code == 401  # No auth header - returns 401 Unauthorized


def test_list_agents_with_filters(client):
    headers = get_auth_header(client)
    # Create agents with different statuses and tags
    client.post("/api/agents", json={
        "name": "Active Agent",
        "tags": ["production"]
    }, headers=headers)

    # Test search filter
    response = client.get("/api/agents?search=Active", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    assert any(agent["name"] == "Active Agent" for agent in data["data"])
