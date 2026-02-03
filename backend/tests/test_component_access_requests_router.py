import uuid
from datetime import datetime

from app.models.component_registry import ComponentRegistry, ComponentType, ComponentVisibility
from app.models.component_access_request import ComponentAccessRequest, RequestStatus
from app.models.component_grant import ComponentGrant, ComponentAccessLevel
from app.models.user import User


class TestAgentAccessRequestsRouter:
    """Test agent-centric access request endpoints."""

    def test_create_access_request(self, client, db):
        owner = User(id=uuid.uuid4(), name="Owner", email="owner@test.com", password_hash="hash")
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
        response = client.post(
            f"/api/agents/{agent_id}/access-requests",
            json={
                "component_id": str(component.id),
                "agent_id": str(agent_id),
                "requested_level": "executor",
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["component_id"] == str(component.id)
        assert data["agent_id"] == str(agent_id)
        assert data["requested_level"] == "executor"
        assert data["status"] == "pending"
        assert data["is_pending"] is True

    def test_create_request_duplicate_pending(self, client, db):
        owner = User(id=uuid.uuid4(), name="Owner", email="owner2@test.com", password_hash="hash")
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
        existing_request = ComponentAccessRequest(
            id=uuid.uuid4(),
            component_id=component.id,
            agent_id=agent_id,
            requested_level=ComponentAccessLevel.EXECUTOR,
            requested_by=owner.id,
            requested_at=datetime.utcnow(),
            status=RequestStatus.PENDING,
        )
        db.add(existing_request)
        db.commit()

        response = client.post(
            f"/api/agents/{agent_id}/access-requests",
            json={
                "component_id": str(component.id),
                "agent_id": str(agent_id),
                "requested_level": "contributor",
            },
        )

        assert response.status_code == 409
        assert "pending access request already exists" in response.json()["detail"]

    def test_create_request_component_not_found(self, client, db):
        agent_id = uuid.uuid4()
        response = client.post(
            f"/api/agents/{agent_id}/access-requests",
            json={
                "component_id": str(uuid.uuid4()),
                "agent_id": str(agent_id),
                "requested_level": "executor",
            },
        )
        assert response.status_code == 404
        assert response.json()["detail"] == "Component not found"

    def test_list_agent_requests(self, client, db):
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

        agent_id = uuid.uuid4()
        for status in [RequestStatus.PENDING, RequestStatus.APPROVED]:
            request = ComponentAccessRequest(
                id=uuid.uuid4(),
                component_id=component.id,
                agent_id=agent_id,
                requested_level=ComponentAccessLevel.EXECUTOR,
                requested_by=owner.id,
                requested_at=datetime.utcnow(),
                status=status,
            )
            db.add(request)
        db.commit()

        response = client.get(f"/api/agents/{agent_id}/access-requests")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
        assert len(data["data"]) == 2


class TestComponentAccessRequestsRouter:
    """Test component-centric access request endpoints."""

    def test_list_component_requests(self, client, db):
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

        # Create requests from different agents
        for _ in range(3):
            request = ComponentAccessRequest(
                id=uuid.uuid4(),
                component_id=component.id,
                agent_id=uuid.uuid4(),
                requested_level=ComponentAccessLevel.EXECUTOR,
                requested_by=owner.id,
                requested_at=datetime.utcnow(),
            )
            db.add(request)
        db.commit()

        response = client.get(f"/api/components/{component.id}/access-requests")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 3

    def test_list_component_requests_pending_only(self, client, db):
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

        # Create pending and approved requests
        for status in [RequestStatus.PENDING, RequestStatus.PENDING, RequestStatus.APPROVED]:
            request = ComponentAccessRequest(
                id=uuid.uuid4(),
                component_id=component.id,
                agent_id=uuid.uuid4(),
                requested_level=ComponentAccessLevel.EXECUTOR,
                requested_by=owner.id,
                requested_at=datetime.utcnow(),
                status=status,
            )
            db.add(request)
        db.commit()

        response = client.get(f"/api/components/{component.id}/access-requests?pending_only=true")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2

    def test_list_component_requests_not_found(self, client, db):
        response = client.get(f"/api/components/{uuid.uuid4()}/access-requests")
        assert response.status_code == 404


class TestAccessRequestOperations:
    """Test specific request operations."""

    def test_get_request(self, client, db):
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

        request = ComponentAccessRequest(
            id=uuid.uuid4(),
            component_id=component.id,
            agent_id=uuid.uuid4(),
            requested_level=ComponentAccessLevel.CONTRIBUTOR,
            requested_by=owner.id,
            requested_at=datetime.utcnow(),
        )
        db.add(request)
        db.commit()

        response = client.get(f"/api/access-requests/{request.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(request.id)
        assert data["requested_level"] == "contributor"

    def test_get_request_not_found(self, client, db):
        response = client.get(f"/api/access-requests/{uuid.uuid4()}")
        assert response.status_code == 404

    def test_approve_request(self, client, db):
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
        request = ComponentAccessRequest(
            id=uuid.uuid4(),
            component_id=component.id,
            agent_id=agent_id,
            requested_level=ComponentAccessLevel.EXECUTOR,
            requested_by=owner.id,
            requested_at=datetime.utcnow(),
        )
        db.add(request)
        db.commit()

        response = client.post(
            f"/api/access-requests/{request.id}/resolve",
            json={"approve": True},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "approved"
        assert data["is_pending"] is False
        assert data["resolved_at"] is not None

        # Verify grant was created
        grant = db.query(ComponentGrant).filter(
            ComponentGrant.component_id == component.id,
            ComponentGrant.agent_id == agent_id,
        ).first()
        assert grant is not None
        assert grant.access_level == ComponentAccessLevel.EXECUTOR

    def test_deny_request(self, client, db):
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

        request = ComponentAccessRequest(
            id=uuid.uuid4(),
            component_id=component.id,
            agent_id=uuid.uuid4(),
            requested_level=ComponentAccessLevel.CONTRIBUTOR,
            requested_by=owner.id,
            requested_at=datetime.utcnow(),
        )
        db.add(request)
        db.commit()

        response = client.post(
            f"/api/access-requests/{request.id}/resolve",
            json={"approve": False, "denial_reason": "Access not justified"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "denied"
        assert data["denial_reason"] == "Access not justified"
        assert data["is_pending"] is False

    def test_resolve_already_resolved(self, client, db):
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

        request = ComponentAccessRequest(
            id=uuid.uuid4(),
            component_id=component.id,
            agent_id=uuid.uuid4(),
            requested_level=ComponentAccessLevel.EXECUTOR,
            requested_by=owner.id,
            requested_at=datetime.utcnow(),
            status=RequestStatus.APPROVED,
            resolved_by=owner.id,
            resolved_at=datetime.utcnow(),
        )
        db.add(request)
        db.commit()

        response = client.post(
            f"/api/access-requests/{request.id}/resolve",
            json={"approve": True},
        )

        assert response.status_code == 400
        assert response.json()["detail"] == "Request has already been resolved"

    def test_resolve_request_not_found(self, client, db):
        response = client.post(
            f"/api/access-requests/{uuid.uuid4()}/resolve",
            json={"approve": True},
        )
        assert response.status_code == 404
