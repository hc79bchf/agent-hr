import uuid
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.component_registry import ComponentRegistry, ComponentType, ComponentVisibility
from app.models.component_grant import ComponentGrant, ComponentAccessLevel
from app.models.user import User


class TestComponentGrantsRouter:
    """Test component grants router endpoints."""

    def test_create_grant(self, client, db):
        # Create owner user
        owner = User(id=uuid.uuid4(), name="Owner", email="owner@test.com", password_hash="hash")
        db.add(owner)
        db.commit()

        # Create component
        component = ComponentRegistry(
            id=uuid.uuid4(),
            type=ComponentType.SKILL,
            name="Test Skill",
            owner_id=owner.id,
            visibility=ComponentVisibility.PRIVATE,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(component)
        db.commit()

        agent_id = uuid.uuid4()
        response = client.post(
            f"/api/components/{component.id}/grants",
            json={
                "component_id": str(component.id),
                "agent_id": str(agent_id),
                "access_level": "executor",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["component_id"] == str(component.id)
        assert data["agent_id"] == str(agent_id)
        assert data["access_level"] == "executor"
        assert data["is_active"] is True

    def test_create_grant_default_viewer(self, client, db):
        owner = User(id=uuid.uuid4(), name="Owner", email="owner2@test.com", password_hash="hash")
        db.add(owner)
        db.commit()

        component = ComponentRegistry(
            id=uuid.uuid4(),
            type=ComponentType.TOOL,
            name="Test Tool",
            owner_id=owner.id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(component)
        db.commit()

        agent_id = uuid.uuid4()
        response = client.post(
            f"/api/components/{component.id}/grants",
            json={
                "component_id": str(component.id),
                "agent_id": str(agent_id),
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["access_level"] == "viewer"

    def test_create_grant_component_not_found(self, client, db):
        response = client.post(
            f"/api/components/{uuid.uuid4()}/grants",
            json={
                "component_id": str(uuid.uuid4()),
                "agent_id": str(uuid.uuid4()),
            },
        )
        assert response.status_code == 404
        assert response.json()["detail"] == "Component not found"

    def test_create_grant_duplicate(self, client, db):
        owner = User(id=uuid.uuid4(), name="Owner", email="owner3@test.com", password_hash="hash")
        db.add(owner)
        db.commit()

        component = ComponentRegistry(
            id=uuid.uuid4(),
            type=ComponentType.SKILL,
            name="Test Skill",
            owner_id=owner.id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(component)
        db.commit()

        agent_id = uuid.uuid4()
        # Create first grant
        grant = ComponentGrant(
            id=uuid.uuid4(),
            component_id=component.id,
            agent_id=agent_id,
            access_level=ComponentAccessLevel.VIEWER,
            granted_by=owner.id,
            granted_at=datetime.utcnow(),
        )
        db.add(grant)
        db.commit()

        # Try to create duplicate
        response = client.post(
            f"/api/components/{component.id}/grants",
            json={
                "component_id": str(component.id),
                "agent_id": str(agent_id),
            },
        )
        assert response.status_code == 409
        assert response.json()["detail"] == "Grant already exists for this agent"

    def test_list_grants(self, client, db):
        owner = User(id=uuid.uuid4(), name="Owner", email="owner4@test.com", password_hash="hash")
        db.add(owner)
        db.commit()

        component = ComponentRegistry(
            id=uuid.uuid4(),
            type=ComponentType.SKILL,
            name="Test Skill",
            owner_id=owner.id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(component)

        # Create multiple grants
        for i in range(3):
            grant = ComponentGrant(
                id=uuid.uuid4(),
                component_id=component.id,
                agent_id=uuid.uuid4(),
                access_level=ComponentAccessLevel.VIEWER,
                granted_by=owner.id,
                granted_at=datetime.utcnow(),
            )
            db.add(grant)
        db.commit()

        response = client.get(f"/api/components/{component.id}/grants")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 3
        assert len(data["data"]) == 3

    def test_list_grants_component_not_found(self, client, db):
        response = client.get(f"/api/components/{uuid.uuid4()}/grants")
        assert response.status_code == 404

    def test_get_grant(self, client, db):
        owner = User(id=uuid.uuid4(), name="Owner", email="owner5@test.com", password_hash="hash")
        db.add(owner)
        db.commit()

        component = ComponentRegistry(
            id=uuid.uuid4(),
            type=ComponentType.SKILL,
            name="Test Skill",
            owner_id=owner.id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(component)

        agent_id = uuid.uuid4()
        grant = ComponentGrant(
            id=uuid.uuid4(),
            component_id=component.id,
            agent_id=agent_id,
            access_level=ComponentAccessLevel.EXECUTOR,
            granted_by=owner.id,
            granted_at=datetime.utcnow(),
        )
        db.add(grant)
        db.commit()

        response = client.get(f"/api/components/{component.id}/grants/{agent_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["agent_id"] == str(agent_id)
        assert data["access_level"] == "executor"

    def test_get_grant_not_found(self, client, db):
        owner = User(id=uuid.uuid4(), name="Owner", email="owner6@test.com", password_hash="hash")
        db.add(owner)
        db.commit()

        component = ComponentRegistry(
            id=uuid.uuid4(),
            type=ComponentType.SKILL,
            name="Test Skill",
            owner_id=owner.id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(component)
        db.commit()

        response = client.get(f"/api/components/{component.id}/grants/{uuid.uuid4()}")
        assert response.status_code == 404
        assert response.json()["detail"] == "Grant not found"

    def test_update_grant_access_level(self, client, db):
        owner = User(id=uuid.uuid4(), name="Owner", email="owner7@test.com", password_hash="hash")
        db.add(owner)
        db.commit()

        component = ComponentRegistry(
            id=uuid.uuid4(),
            type=ComponentType.SKILL,
            name="Test Skill",
            owner_id=owner.id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(component)

        agent_id = uuid.uuid4()
        grant = ComponentGrant(
            id=uuid.uuid4(),
            component_id=component.id,
            agent_id=agent_id,
            access_level=ComponentAccessLevel.VIEWER,
            granted_by=owner.id,
            granted_at=datetime.utcnow(),
        )
        db.add(grant)
        db.commit()

        response = client.patch(
            f"/api/components/{component.id}/grants/{agent_id}",
            json={"access_level": "contributor"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["access_level"] == "contributor"

    def test_update_grant_not_found(self, client, db):
        owner = User(id=uuid.uuid4(), name="Owner", email="owner8@test.com", password_hash="hash")
        db.add(owner)
        db.commit()

        component = ComponentRegistry(
            id=uuid.uuid4(),
            type=ComponentType.SKILL,
            name="Test Skill",
            owner_id=owner.id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(component)
        db.commit()

        response = client.patch(
            f"/api/components/{component.id}/grants/{uuid.uuid4()}",
            json={"access_level": "contributor"},
        )
        assert response.status_code == 404

    def test_revoke_grant(self, client, db):
        owner = User(id=uuid.uuid4(), name="Owner", email="owner9@test.com", password_hash="hash")
        db.add(owner)
        db.commit()

        component = ComponentRegistry(
            id=uuid.uuid4(),
            type=ComponentType.SKILL,
            name="Test Skill",
            owner_id=owner.id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(component)

        agent_id = uuid.uuid4()
        grant = ComponentGrant(
            id=uuid.uuid4(),
            component_id=component.id,
            agent_id=agent_id,
            access_level=ComponentAccessLevel.EXECUTOR,
            granted_by=owner.id,
            granted_at=datetime.utcnow(),
        )
        db.add(grant)
        db.commit()

        response = client.delete(f"/api/components/{component.id}/grants/{agent_id}")
        assert response.status_code == 204

        # Verify grant is revoked
        db.refresh(grant)
        assert grant.revoked_at is not None
        assert grant.is_active is False

    def test_revoke_grant_not_found(self, client, db):
        owner = User(id=uuid.uuid4(), name="Owner", email="owner10@test.com", password_hash="hash")
        db.add(owner)
        db.commit()

        component = ComponentRegistry(
            id=uuid.uuid4(),
            type=ComponentType.SKILL,
            name="Test Skill",
            owner_id=owner.id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(component)
        db.commit()

        response = client.delete(f"/api/components/{component.id}/grants/{uuid.uuid4()}")
        assert response.status_code == 404
