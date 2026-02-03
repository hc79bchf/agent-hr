"""Tests for Organizations router endpoints."""

import uuid


class TestOrganizationsRouter:
    """Test cases for organizations CRUD endpoints."""

    def test_create_organization(self, client, db):
        """Test creating a new organization."""
        response = client.post(
            "/api/organizations",
            json={"name": "Acme Corp"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Acme Corp"
        assert "id" in data
        assert data["parent_id"] is None
        assert data["metadata"] == {}
        assert "created_at" in data
        assert "updated_at" in data

    def test_create_organization_with_metadata(self, client, db):
        """Test creating an organization with metadata."""
        response = client.post(
            "/api/organizations",
            json={
                "name": "Tech Corp",
                "metadata": {"industry": "technology", "size": "large"},
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Tech Corp"
        assert data["metadata"]["industry"] == "technology"
        assert data["metadata"]["size"] == "large"

    def test_create_child_organization(self, client, db):
        """Test creating a child organization with parent_id."""
        # Create parent
        parent_response = client.post(
            "/api/organizations",
            json={"name": "Parent Org"},
        )
        parent_id = parent_response.json()["id"]

        # Create child
        response = client.post(
            "/api/organizations",
            json={"name": "Child Org", "parent_id": parent_id},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Child Org"
        assert data["parent_id"] == parent_id

    def test_get_organization(self, client, db):
        """Test getting a specific organization by ID."""
        create_response = client.post(
            "/api/organizations",
            json={"name": "Test Org"},
        )
        org_id = create_response.json()["id"]

        response = client.get(f"/api/organizations/{org_id}")
        assert response.status_code == 200
        assert response.json()["name"] == "Test Org"
        assert response.json()["id"] == org_id

    def test_get_organization_not_found(self, client, db):
        """Test getting a non-existent organization returns 404."""
        fake_id = str(uuid.uuid4())
        response = client.get(f"/api/organizations/{fake_id}")
        assert response.status_code == 404
        assert response.json()["detail"] == "Organization not found"

    def test_list_organizations(self, client, db):
        """Test listing all organizations."""
        client.post("/api/organizations", json={"name": "Org 1"})
        client.post("/api/organizations", json={"name": "Org 2"})

        response = client.get("/api/organizations")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2
        names = [org["name"] for org in data]
        assert "Org 1" in names
        assert "Org 2" in names

    def test_list_organizations_empty(self, client, db):
        """Test listing organizations when none exist."""
        response = client.get("/api/organizations")
        assert response.status_code == 200
        assert response.json() == []

    def test_update_organization_name(self, client, db):
        """Test updating organization name."""
        create_response = client.post(
            "/api/organizations",
            json={"name": "Original Name"},
        )
        org_id = create_response.json()["id"]

        response = client.patch(
            f"/api/organizations/{org_id}",
            json={"name": "Updated Name"},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Updated Name"

    def test_update_organization_metadata(self, client, db):
        """Test updating organization metadata."""
        create_response = client.post(
            "/api/organizations",
            json={"name": "Test Org", "metadata": {"key": "value"}},
        )
        org_id = create_response.json()["id"]

        response = client.patch(
            f"/api/organizations/{org_id}",
            json={"metadata": {"new_key": "new_value"}},
        )
        assert response.status_code == 200
        assert response.json()["metadata"]["new_key"] == "new_value"

    def test_update_organization_parent(self, client, db):
        """Test updating organization parent_id."""
        # Create parent
        parent_response = client.post(
            "/api/organizations",
            json={"name": "Parent Org"},
        )
        parent_id = parent_response.json()["id"]

        # Create standalone org
        org_response = client.post(
            "/api/organizations",
            json={"name": "Standalone Org"},
        )
        org_id = org_response.json()["id"]

        # Update to have parent
        response = client.patch(
            f"/api/organizations/{org_id}",
            json={"parent_id": parent_id},
        )
        assert response.status_code == 200
        assert response.json()["parent_id"] == parent_id

    def test_update_organization_not_found(self, client, db):
        """Test updating a non-existent organization returns 404."""
        fake_id = str(uuid.uuid4())
        response = client.patch(
            f"/api/organizations/{fake_id}",
            json={"name": "New Name"},
        )
        assert response.status_code == 404
        assert response.json()["detail"] == "Organization not found"

    def test_partial_update_preserves_other_fields(self, client, db):
        """Test that partial update doesn't overwrite unspecified fields."""
        create_response = client.post(
            "/api/organizations",
            json={
                "name": "Test Org",
                "metadata": {"industry": "tech"},
            },
        )
        org_id = create_response.json()["id"]

        # Update only name
        response = client.patch(
            f"/api/organizations/{org_id}",
            json={"name": "New Name"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "New Name"
        # Metadata should be preserved
        assert data["metadata"]["industry"] == "tech"
