import uuid
from datetime import datetime, timedelta
from unittest.mock import MagicMock

import pytest

from app.models.agent_user_grant import AccessLevel
from app.models.component_grant import ComponentAccessLevel
from app.models.component_access_request import RequestStatus
from app.schemas.grants import (
    ComponentGrantCreate,
    ComponentGrantUpdate,
    ComponentGrantResponse,
    ComponentGrantListResponse,
    AgentUserGrantCreate,
    AgentUserGrantResponse,
    AgentUserGrantListResponse,
    ComponentAccessRequestCreate,
    ComponentAccessRequestResolve,
    ComponentAccessRequestResponse,
    ComponentAccessRequestListResponse,
)


class TestComponentGrantCreate:
    def test_create_minimal(self):
        component_id = uuid.uuid4()
        agent_id = uuid.uuid4()
        schema = ComponentGrantCreate(component_id=component_id, agent_id=agent_id)
        assert schema.component_id == component_id
        assert schema.agent_id == agent_id
        assert schema.access_level == ComponentAccessLevel.VIEWER
        assert schema.expires_at is None

    def test_create_with_access_level(self):
        component_id = uuid.uuid4()
        agent_id = uuid.uuid4()
        schema = ComponentGrantCreate(
            component_id=component_id,
            agent_id=agent_id,
            access_level=ComponentAccessLevel.EXECUTOR,
        )
        assert schema.access_level == ComponentAccessLevel.EXECUTOR

    def test_create_with_expiration(self):
        component_id = uuid.uuid4()
        agent_id = uuid.uuid4()
        expires_at = datetime.utcnow() + timedelta(days=30)
        schema = ComponentGrantCreate(
            component_id=component_id, agent_id=agent_id, expires_at=expires_at
        )
        assert schema.component_id == component_id
        assert schema.agent_id == agent_id
        assert schema.expires_at == expires_at


class TestComponentGrantUpdate:
    def test_update_access_level(self):
        schema = ComponentGrantUpdate(access_level=ComponentAccessLevel.CONTRIBUTOR)
        assert schema.access_level == ComponentAccessLevel.CONTRIBUTOR
        assert schema.expires_at is None

    def test_update_expires_at(self):
        expires_at = datetime.utcnow() + timedelta(days=30)
        schema = ComponentGrantUpdate(expires_at=expires_at)
        assert schema.access_level is None
        assert schema.expires_at == expires_at


class TestComponentGrantResponse:
    def test_response_from_dict(self):
        grant_id = uuid.uuid4()
        component_id = uuid.uuid4()
        agent_id = uuid.uuid4()
        granted_by_id = uuid.uuid4()
        now = datetime.utcnow()

        schema = ComponentGrantResponse(
            id=grant_id,
            component_id=component_id,
            agent_id=agent_id,
            access_level=ComponentAccessLevel.VIEWER,
            granted_by=granted_by_id,
            granted_at=now,
            expires_at=None,
            revoked_at=None,
            is_active=True,
        )
        assert schema.id == grant_id
        assert schema.component_id == component_id
        assert schema.agent_id == agent_id
        assert schema.access_level == ComponentAccessLevel.VIEWER
        assert schema.granted_by == granted_by_id
        assert schema.granted_at == now
        assert schema.expires_at is None
        assert schema.revoked_at is None
        assert schema.is_active is True

    def test_response_with_expiration(self):
        grant_id = uuid.uuid4()
        component_id = uuid.uuid4()
        agent_id = uuid.uuid4()
        granted_by_id = uuid.uuid4()
        now = datetime.utcnow()
        expires_at = now + timedelta(days=30)

        schema = ComponentGrantResponse(
            id=grant_id,
            component_id=component_id,
            agent_id=agent_id,
            access_level=ComponentAccessLevel.EXECUTOR,
            granted_by=granted_by_id,
            granted_at=now,
            expires_at=expires_at,
            revoked_at=None,
            is_active=True,
        )
        assert schema.expires_at == expires_at
        assert schema.is_active is True

    def test_response_revoked(self):
        grant_id = uuid.uuid4()
        component_id = uuid.uuid4()
        agent_id = uuid.uuid4()
        granted_by_id = uuid.uuid4()
        now = datetime.utcnow()

        schema = ComponentGrantResponse(
            id=grant_id,
            component_id=component_id,
            agent_id=agent_id,
            access_level=ComponentAccessLevel.VIEWER,
            granted_by=granted_by_id,
            granted_at=now,
            expires_at=None,
            revoked_at=now + timedelta(days=5),
            is_active=False,
        )
        assert schema.revoked_at is not None
        assert schema.is_active is False

    def test_response_from_attributes(self):
        """Test from_attributes=True works with ORM-like objects."""
        grant_id = uuid.uuid4()
        component_id = uuid.uuid4()
        agent_id = uuid.uuid4()
        granted_by_id = uuid.uuid4()
        now = datetime.utcnow()

        mock_grant = MagicMock()
        mock_grant.id = grant_id
        mock_grant.component_id = component_id
        mock_grant.agent_id = agent_id
        mock_grant.access_level = ComponentAccessLevel.CONTRIBUTOR
        mock_grant.granted_by = granted_by_id
        mock_grant.granted_at = now
        mock_grant.expires_at = None
        mock_grant.revoked_at = None
        mock_grant.is_active = True

        schema = ComponentGrantResponse.model_validate(mock_grant)
        assert schema.id == grant_id
        assert schema.component_id == component_id
        assert schema.agent_id == agent_id
        assert schema.access_level == ComponentAccessLevel.CONTRIBUTOR
        assert schema.granted_by == granted_by_id
        assert schema.granted_at == now
        assert schema.is_active is True


class TestComponentGrantListResponse:
    def test_empty_list(self):
        schema = ComponentGrantListResponse(data=[], total=0)
        assert schema.data == []
        assert schema.total == 0

    def test_list_with_items(self):
        grant_id = uuid.uuid4()
        component_id = uuid.uuid4()
        agent_id = uuid.uuid4()
        granted_by_id = uuid.uuid4()
        now = datetime.utcnow()

        grant_response = ComponentGrantResponse(
            id=grant_id,
            component_id=component_id,
            agent_id=agent_id,
            access_level=ComponentAccessLevel.VIEWER,
            granted_by=granted_by_id,
            granted_at=now,
            expires_at=None,
            revoked_at=None,
            is_active=True,
        )
        schema = ComponentGrantListResponse(data=[grant_response], total=1)
        assert len(schema.data) == 1
        assert schema.data[0].is_active is True
        assert schema.total == 1


class TestAgentUserGrantCreate:
    def test_create_with_viewer_level(self):
        user_id = uuid.uuid4()
        schema = AgentUserGrantCreate(user_id=user_id, access_level=AccessLevel.VIEWER)
        assert schema.user_id == user_id
        assert schema.access_level == AccessLevel.VIEWER
        assert schema.expires_at is None

    def test_create_with_user_level(self):
        user_id = uuid.uuid4()
        schema = AgentUserGrantCreate(user_id=user_id, access_level=AccessLevel.USER)
        assert schema.access_level == AccessLevel.USER

    def test_create_with_contributor_level(self):
        user_id = uuid.uuid4()
        schema = AgentUserGrantCreate(
            user_id=user_id, access_level=AccessLevel.CONTRIBUTOR
        )
        assert schema.access_level == AccessLevel.CONTRIBUTOR

    def test_create_with_admin_level(self):
        user_id = uuid.uuid4()
        schema = AgentUserGrantCreate(user_id=user_id, access_level=AccessLevel.ADMIN)
        assert schema.access_level == AccessLevel.ADMIN

    def test_create_with_string_access_level(self):
        user_id = uuid.uuid4()
        schema = AgentUserGrantCreate(user_id=user_id, access_level="contributor")
        assert schema.access_level == AccessLevel.CONTRIBUTOR

    def test_create_with_expiration(self):
        user_id = uuid.uuid4()
        expires_at = datetime.utcnow() + timedelta(days=90)
        schema = AgentUserGrantCreate(
            user_id=user_id, access_level=AccessLevel.USER, expires_at=expires_at
        )
        assert schema.expires_at == expires_at


class TestAgentUserGrantResponse:
    def test_response_from_dict(self):
        grant_id = uuid.uuid4()
        agent_id = uuid.uuid4()
        user_id = uuid.uuid4()
        granted_by_id = uuid.uuid4()
        now = datetime.utcnow()

        schema = AgentUserGrantResponse(
            id=grant_id,
            agent_id=agent_id,
            user_id=user_id,
            access_level=AccessLevel.CONTRIBUTOR,
            granted_by=granted_by_id,
            granted_at=now,
            expires_at=None,
            revoked_at=None,
            is_active=True,
        )
        assert schema.id == grant_id
        assert schema.agent_id == agent_id
        assert schema.user_id == user_id
        assert schema.access_level == AccessLevel.CONTRIBUTOR
        assert schema.granted_by == granted_by_id
        assert schema.granted_at == now
        assert schema.expires_at is None
        assert schema.revoked_at is None
        assert schema.is_active is True

    def test_response_with_expiration(self):
        grant_id = uuid.uuid4()
        agent_id = uuid.uuid4()
        user_id = uuid.uuid4()
        granted_by_id = uuid.uuid4()
        now = datetime.utcnow()
        expires_at = now + timedelta(days=30)

        schema = AgentUserGrantResponse(
            id=grant_id,
            agent_id=agent_id,
            user_id=user_id,
            access_level=AccessLevel.USER,
            granted_by=granted_by_id,
            granted_at=now,
            expires_at=expires_at,
            revoked_at=None,
            is_active=True,
        )
        assert schema.expires_at == expires_at
        assert schema.is_active is True

    def test_response_revoked(self):
        grant_id = uuid.uuid4()
        agent_id = uuid.uuid4()
        user_id = uuid.uuid4()
        granted_by_id = uuid.uuid4()
        now = datetime.utcnow()

        schema = AgentUserGrantResponse(
            id=grant_id,
            agent_id=agent_id,
            user_id=user_id,
            access_level=AccessLevel.VIEWER,
            granted_by=granted_by_id,
            granted_at=now,
            expires_at=None,
            revoked_at=now + timedelta(days=5),
            is_active=False,
        )
        assert schema.revoked_at is not None
        assert schema.is_active is False

    def test_response_from_attributes(self):
        """Test from_attributes=True works with ORM-like objects."""
        grant_id = uuid.uuid4()
        agent_id = uuid.uuid4()
        user_id = uuid.uuid4()
        granted_by_id = uuid.uuid4()
        now = datetime.utcnow()

        mock_grant = MagicMock()
        mock_grant.id = grant_id
        mock_grant.agent_id = agent_id
        mock_grant.user_id = user_id
        mock_grant.access_level = AccessLevel.ADMIN
        mock_grant.granted_by = granted_by_id
        mock_grant.granted_at = now
        mock_grant.expires_at = None
        mock_grant.revoked_at = None
        mock_grant.is_active = True

        schema = AgentUserGrantResponse.model_validate(mock_grant)
        assert schema.id == grant_id
        assert schema.agent_id == agent_id
        assert schema.user_id == user_id
        assert schema.access_level == AccessLevel.ADMIN
        assert schema.granted_by == granted_by_id
        assert schema.granted_at == now
        assert schema.is_active is True

    def test_response_all_access_levels(self):
        """Verify all access levels can be used in responses."""
        grant_id = uuid.uuid4()
        agent_id = uuid.uuid4()
        user_id = uuid.uuid4()
        granted_by_id = uuid.uuid4()
        now = datetime.utcnow()

        for level in AccessLevel:
            schema = AgentUserGrantResponse(
                id=grant_id,
                agent_id=agent_id,
                user_id=user_id,
                access_level=level,
                granted_by=granted_by_id,
                granted_at=now,
                expires_at=None,
                revoked_at=None,
                is_active=True,
            )
            assert schema.access_level == level


class TestAgentUserGrantListResponse:
    def test_empty_list(self):
        schema = AgentUserGrantListResponse(data=[], total=0)
        assert schema.data == []
        assert schema.total == 0

    def test_list_with_items(self):
        grant_id = uuid.uuid4()
        agent_id = uuid.uuid4()
        user_id = uuid.uuid4()
        granted_by_id = uuid.uuid4()
        now = datetime.utcnow()

        grant_response = AgentUserGrantResponse(
            id=grant_id,
            agent_id=agent_id,
            user_id=user_id,
            access_level=AccessLevel.ADMIN,
            granted_by=granted_by_id,
            granted_at=now,
            expires_at=None,
            revoked_at=None,
            is_active=True,
        )
        schema = AgentUserGrantListResponse(data=[grant_response], total=1)
        assert len(schema.data) == 1
        assert schema.data[0].access_level == AccessLevel.ADMIN
        assert schema.total == 1

    def test_list_with_multiple_access_levels(self):
        agent_id = uuid.uuid4()
        granted_by_id = uuid.uuid4()
        now = datetime.utcnow()

        grants = []
        for level in [
            AccessLevel.VIEWER,
            AccessLevel.USER,
            AccessLevel.CONTRIBUTOR,
            AccessLevel.ADMIN,
        ]:
            grants.append(
                AgentUserGrantResponse(
                    id=uuid.uuid4(),
                    agent_id=agent_id,
                    user_id=uuid.uuid4(),
                    access_level=level,
                    granted_by=granted_by_id,
                    granted_at=now,
                    expires_at=None,
                    revoked_at=None,
                    is_active=True,
                )
            )

        schema = AgentUserGrantListResponse(data=grants, total=4)
        assert len(schema.data) == 4
        assert schema.total == 4
        levels = [g.access_level for g in schema.data]
        assert AccessLevel.VIEWER in levels
        assert AccessLevel.USER in levels
        assert AccessLevel.CONTRIBUTOR in levels
        assert AccessLevel.ADMIN in levels


class TestComponentAccessRequestCreate:
    def test_create_executor_request(self):
        component_id = uuid.uuid4()
        agent_id = uuid.uuid4()
        schema = ComponentAccessRequestCreate(
            component_id=component_id,
            agent_id=agent_id,
            requested_level=ComponentAccessLevel.EXECUTOR,
        )
        assert schema.component_id == component_id
        assert schema.agent_id == agent_id
        assert schema.requested_level == ComponentAccessLevel.EXECUTOR

    def test_create_contributor_request(self):
        schema = ComponentAccessRequestCreate(
            component_id=uuid.uuid4(),
            agent_id=uuid.uuid4(),
            requested_level=ComponentAccessLevel.CONTRIBUTOR,
        )
        assert schema.requested_level == ComponentAccessLevel.CONTRIBUTOR

    def test_cannot_request_viewer_level(self):
        with pytest.raises(ValueError, match="Cannot request VIEWER level"):
            ComponentAccessRequestCreate(
                component_id=uuid.uuid4(),
                agent_id=uuid.uuid4(),
                requested_level=ComponentAccessLevel.VIEWER,
            )


class TestComponentAccessRequestResolve:
    def test_approve_request(self):
        schema = ComponentAccessRequestResolve(approve=True)
        assert schema.approve is True
        assert schema.denial_reason is None

    def test_deny_with_reason(self):
        schema = ComponentAccessRequestResolve(
            approve=False, denial_reason="Not authorized for this component"
        )
        assert schema.approve is False
        assert schema.denial_reason == "Not authorized for this component"

    def test_deny_requires_reason(self):
        with pytest.raises(ValueError, match="denial_reason is required"):
            ComponentAccessRequestResolve(approve=False)


class TestComponentAccessRequestResponse:
    def test_pending_request(self):
        request_id = uuid.uuid4()
        component_id = uuid.uuid4()
        agent_id = uuid.uuid4()
        requested_by = uuid.uuid4()
        now = datetime.utcnow()

        schema = ComponentAccessRequestResponse(
            id=request_id,
            component_id=component_id,
            agent_id=agent_id,
            requested_level=ComponentAccessLevel.EXECUTOR,
            requested_by=requested_by,
            requested_at=now,
            status=RequestStatus.PENDING,
            resolved_by=None,
            resolved_at=None,
            denial_reason=None,
            is_pending=True,
        )
        assert schema.id == request_id
        assert schema.component_id == component_id
        assert schema.requested_level == ComponentAccessLevel.EXECUTOR
        assert schema.status == RequestStatus.PENDING
        assert schema.is_pending is True

    def test_approved_request(self):
        now = datetime.utcnow()
        resolved_by = uuid.uuid4()

        schema = ComponentAccessRequestResponse(
            id=uuid.uuid4(),
            component_id=uuid.uuid4(),
            agent_id=uuid.uuid4(),
            requested_level=ComponentAccessLevel.CONTRIBUTOR,
            requested_by=uuid.uuid4(),
            requested_at=now,
            status=RequestStatus.APPROVED,
            resolved_by=resolved_by,
            resolved_at=now,
            denial_reason=None,
            is_pending=False,
        )
        assert schema.status == RequestStatus.APPROVED
        assert schema.resolved_by == resolved_by
        assert schema.is_pending is False

    def test_denied_request(self):
        now = datetime.utcnow()
        resolved_by = uuid.uuid4()

        schema = ComponentAccessRequestResponse(
            id=uuid.uuid4(),
            component_id=uuid.uuid4(),
            agent_id=uuid.uuid4(),
            requested_level=ComponentAccessLevel.EXECUTOR,
            requested_by=uuid.uuid4(),
            requested_at=now,
            status=RequestStatus.DENIED,
            resolved_by=resolved_by,
            resolved_at=now,
            denial_reason="Request denied due to security policy",
            is_pending=False,
        )
        assert schema.status == RequestStatus.DENIED
        assert schema.denial_reason == "Request denied due to security policy"
        assert schema.is_pending is False


class TestComponentAccessRequestListResponse:
    def test_empty_list(self):
        schema = ComponentAccessRequestListResponse(data=[], total=0)
        assert schema.data == []
        assert schema.total == 0

    def test_list_with_items(self):
        now = datetime.utcnow()
        request = ComponentAccessRequestResponse(
            id=uuid.uuid4(),
            component_id=uuid.uuid4(),
            agent_id=uuid.uuid4(),
            requested_level=ComponentAccessLevel.EXECUTOR,
            requested_by=uuid.uuid4(),
            requested_at=now,
            status=RequestStatus.PENDING,
            resolved_by=None,
            resolved_at=None,
            denial_reason=None,
            is_pending=True,
        )
        schema = ComponentAccessRequestListResponse(data=[request], total=1)
        assert len(schema.data) == 1
        assert schema.total == 1
