"""Tests for Stakeholders router endpoints."""

import uuid
from datetime import datetime

from sqlalchemy import text

from app.models.user import User


def create_test_user(db, email: str = "test@example.com"):
    """Create a test user using ORM and return its ID as string (with dashes for API)."""
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        email=email,
        name="Test User",
        password_hash="hashed",
    )
    db.add(user)
    db.commit()
    # Return string with dashes for API compatibility
    return str(user_id)


def create_test_agent(db, author_id: str, name: str = "Test Agent"):
    """Create a test agent via raw SQL and return its ID as string (with dashes for API).

    Note: We store UUIDs as hex (no dashes) in SQLite for compatibility with
    SQLAlchemy's PostgreSQL UUID type which expects hex format.
    """
    agent_uuid = uuid.uuid4()
    # Convert author_id from dashed format to hex for storage
    author_uuid = uuid.UUID(author_id)
    now = datetime.utcnow().isoformat()
    db.execute(
        text("""
            INSERT INTO agents (id, name, description, author_id, status, tags, created_at, updated_at)
            VALUES (:id, :name, :description, :author_id, 'draft', '[]', :created_at, :updated_at)
        """),
        {
            "id": agent_uuid.hex,  # Store as hex for ORM compatibility
            "name": name,
            "description": "A test agent",
            "author_id": author_uuid.hex,  # Store as hex for ORM compatibility
            "created_at": now,
            "updated_at": now,
        },
    )
    db.commit()
    # Return string with dashes for API compatibility
    return str(agent_uuid)


class TestStakeholdersRouter:
    """Test cases for stakeholder management endpoints."""

    def test_add_stakeholder(self, client, db):
        """Test adding a stakeholder to an agent."""
        # Create test users
        author_id = create_test_user(db, "author@example.com")
        stakeholder_user_id = create_test_user(db, "stakeholder@example.com")

        # Create agent
        agent_id = create_test_agent(db, author_id)

        # Add stakeholder
        response = client.post(
            f"/api/agents/{agent_id}/stakeholders",
            json={
                "user_id": stakeholder_user_id,
                "role": "viewer",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["agent_id"] == agent_id
        assert data["user_id"] == stakeholder_user_id
        assert data["role"] == "viewer"
        assert data["granted_by"] == author_id
        assert "id" in data
        assert "granted_at" in data

    def test_add_stakeholder_owner_role(self, client, db):
        """Test adding a stakeholder with owner role."""
        author_id = create_test_user(db, "author@example.com")
        stakeholder_user_id = create_test_user(db, "owner@example.com")
        agent_id = create_test_agent(db, author_id)

        response = client.post(
            f"/api/agents/{agent_id}/stakeholders",
            json={
                "user_id": stakeholder_user_id,
                "role": "owner",
            },
        )
        assert response.status_code == 201
        assert response.json()["role"] == "owner"

    def test_add_stakeholder_contributor_role(self, client, db):
        """Test adding a stakeholder with contributor role."""
        author_id = create_test_user(db, "author@example.com")
        stakeholder_user_id = create_test_user(db, "contributor@example.com")
        agent_id = create_test_agent(db, author_id)

        response = client.post(
            f"/api/agents/{agent_id}/stakeholders",
            json={
                "user_id": stakeholder_user_id,
                "role": "contributor",
            },
        )
        assert response.status_code == 201
        assert response.json()["role"] == "contributor"

    def test_add_stakeholder_admin_role(self, client, db):
        """Test adding a stakeholder with admin role."""
        author_id = create_test_user(db, "author@example.com")
        stakeholder_user_id = create_test_user(db, "admin@example.com")
        agent_id = create_test_agent(db, author_id)

        response = client.post(
            f"/api/agents/{agent_id}/stakeholders",
            json={
                "user_id": stakeholder_user_id,
                "role": "admin",
            },
        )
        assert response.status_code == 201
        assert response.json()["role"] == "admin"

    def test_add_stakeholder_duplicate_returns_409(self, client, db):
        """Test adding a duplicate stakeholder returns 409 conflict."""
        author_id = create_test_user(db, "author@example.com")
        stakeholder_user_id = create_test_user(db, "stakeholder@example.com")
        agent_id = create_test_agent(db, author_id)

        # Add stakeholder first time
        client.post(
            f"/api/agents/{agent_id}/stakeholders",
            json={
                "user_id": stakeholder_user_id,
                "role": "viewer",
            },
        )

        # Try to add same stakeholder again
        response = client.post(
            f"/api/agents/{agent_id}/stakeholders",
            json={
                "user_id": stakeholder_user_id,
                "role": "contributor",  # Different role
            },
        )
        assert response.status_code == 409
        assert response.json()["detail"] == "Stakeholder already exists"

    def test_add_stakeholder_agent_not_found(self, client, db):
        """Test adding stakeholder to non-existent agent returns 404."""
        user_id = create_test_user(db, "user@example.com")
        fake_agent_id = str(uuid.uuid4())

        response = client.post(
            f"/api/agents/{fake_agent_id}/stakeholders",
            json={
                "user_id": user_id,
                "role": "viewer",
            },
        )
        assert response.status_code == 404
        assert response.json()["detail"] == "Agent not found"

    def test_list_stakeholders(self, client, db):
        """Test listing all stakeholders for an agent."""
        author_id = create_test_user(db, "author@example.com")
        stakeholder1_id = create_test_user(db, "stakeholder1@example.com")
        stakeholder2_id = create_test_user(db, "stakeholder2@example.com")
        agent_id = create_test_agent(db, author_id)

        # Add multiple stakeholders
        client.post(
            f"/api/agents/{agent_id}/stakeholders",
            json={"user_id": stakeholder1_id, "role": "viewer"},
        )
        client.post(
            f"/api/agents/{agent_id}/stakeholders",
            json={"user_id": stakeholder2_id, "role": "contributor"},
        )

        # List stakeholders
        response = client.get(f"/api/agents/{agent_id}/stakeholders")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        user_ids = [s["user_id"] for s in data]
        assert stakeholder1_id in user_ids
        assert stakeholder2_id in user_ids

    def test_list_stakeholders_empty(self, client, db):
        """Test listing stakeholders when none exist."""
        author_id = create_test_user(db, "author@example.com")
        agent_id = create_test_agent(db, author_id)

        response = client.get(f"/api/agents/{agent_id}/stakeholders")
        assert response.status_code == 200
        assert response.json() == []

    def test_list_stakeholders_agent_not_found(self, client, db):
        """Test listing stakeholders for non-existent agent returns 404."""
        fake_agent_id = str(uuid.uuid4())

        response = client.get(f"/api/agents/{fake_agent_id}/stakeholders")
        assert response.status_code == 404
        assert response.json()["detail"] == "Agent not found"

    def test_remove_stakeholder(self, client, db):
        """Test removing a stakeholder from an agent."""
        author_id = create_test_user(db, "author@example.com")
        stakeholder_user_id = create_test_user(db, "stakeholder@example.com")
        agent_id = create_test_agent(db, author_id)

        # Add stakeholder
        client.post(
            f"/api/agents/{agent_id}/stakeholders",
            json={"user_id": stakeholder_user_id, "role": "viewer"},
        )

        # Remove stakeholder
        response = client.delete(
            f"/api/agents/{agent_id}/stakeholders/{stakeholder_user_id}"
        )
        assert response.status_code == 204

        # Verify stakeholder is removed
        list_response = client.get(f"/api/agents/{agent_id}/stakeholders")
        assert list_response.status_code == 200
        assert list_response.json() == []

    def test_remove_stakeholder_not_found(self, client, db):
        """Test removing a non-existent stakeholder returns 404."""
        author_id = create_test_user(db, "author@example.com")
        agent_id = create_test_agent(db, author_id)
        fake_user_id = str(uuid.uuid4())

        response = client.delete(
            f"/api/agents/{agent_id}/stakeholders/{fake_user_id}"
        )
        assert response.status_code == 404
        assert response.json()["detail"] == "Stakeholder not found"

    def test_remove_stakeholder_agent_not_found(self, client, db):
        """Test removing stakeholder from non-existent agent returns 404."""
        fake_agent_id = str(uuid.uuid4())
        fake_user_id = str(uuid.uuid4())

        response = client.delete(
            f"/api/agents/{fake_agent_id}/stakeholders/{fake_user_id}"
        )
        assert response.status_code == 404
        assert response.json()["detail"] == "Agent not found"

    def test_stakeholders_isolated_per_agent(self, client, db):
        """Test that stakeholders are isolated per agent."""
        author_id = create_test_user(db, "author@example.com")
        stakeholder_id = create_test_user(db, "stakeholder@example.com")

        # Create two agents
        agent1_id = create_test_agent(db, author_id, "Agent 1")
        agent2_id = create_test_agent(db, author_id, "Agent 2")

        # Add stakeholder to agent 1 only
        client.post(
            f"/api/agents/{agent1_id}/stakeholders",
            json={"user_id": stakeholder_id, "role": "viewer"},
        )

        # Verify stakeholder is on agent 1
        response1 = client.get(f"/api/agents/{agent1_id}/stakeholders")
        assert len(response1.json()) == 1

        # Verify stakeholder is not on agent 2
        response2 = client.get(f"/api/agents/{agent2_id}/stakeholders")
        assert len(response2.json()) == 0

    def test_same_user_can_be_stakeholder_on_multiple_agents(self, client, db):
        """Test that the same user can be a stakeholder on multiple agents."""
        author_id = create_test_user(db, "author@example.com")
        stakeholder_id = create_test_user(db, "stakeholder@example.com")

        # Create two agents
        agent1_id = create_test_agent(db, author_id, "Agent 1")
        agent2_id = create_test_agent(db, author_id, "Agent 2")

        # Add same stakeholder to both agents
        response1 = client.post(
            f"/api/agents/{agent1_id}/stakeholders",
            json={"user_id": stakeholder_id, "role": "viewer"},
        )
        response2 = client.post(
            f"/api/agents/{agent2_id}/stakeholders",
            json={"user_id": stakeholder_id, "role": "contributor"},
        )

        assert response1.status_code == 201
        assert response2.status_code == 201

        # Different roles on different agents
        assert response1.json()["role"] == "viewer"
        assert response2.json()["role"] == "contributor"
