import uuid
from datetime import datetime, timedelta
from app.models.component_grant import ComponentGrant, ComponentAccessLevel


class TestComponentGrantModel:
    def test_grant_has_required_fields(self):
        component_id = uuid.uuid4()
        agent_id = uuid.uuid4()
        granted_by = uuid.uuid4()

        grant = ComponentGrant(
            id=uuid.uuid4(),
            component_id=component_id,
            agent_id=agent_id,
            granted_by=granted_by,
        )

        assert grant.component_id == component_id
        assert grant.agent_id == agent_id
        assert grant.granted_by == granted_by
        assert grant.expires_at is None
        assert grant.revoked_at is None

    def test_grant_with_expiration(self):
        expires = datetime.utcnow() + timedelta(days=30)

        grant = ComponentGrant(
            id=uuid.uuid4(),
            component_id=uuid.uuid4(),
            agent_id=uuid.uuid4(),
            granted_by=uuid.uuid4(),
            expires_at=expires,
        )

        assert grant.expires_at == expires

    def test_grant_is_active_when_not_revoked(self):
        grant = ComponentGrant(
            id=uuid.uuid4(),
            component_id=uuid.uuid4(),
            agent_id=uuid.uuid4(),
            granted_by=uuid.uuid4(),
        )

        assert grant.is_active is True

    def test_grant_is_not_active_when_revoked(self):
        grant = ComponentGrant(
            id=uuid.uuid4(),
            component_id=uuid.uuid4(),
            agent_id=uuid.uuid4(),
            granted_by=uuid.uuid4(),
            revoked_at=datetime.utcnow(),
        )

        assert grant.is_active is False

    def test_grant_is_not_active_when_expired(self):
        # Set expiration in the past
        past_expiry = datetime.utcnow() - timedelta(days=1)

        grant = ComponentGrant(
            id=uuid.uuid4(),
            component_id=uuid.uuid4(),
            agent_id=uuid.uuid4(),
            granted_by=uuid.uuid4(),
            expires_at=past_expiry,
        )

        assert grant.is_active is False

    def test_grant_is_active_when_not_yet_expired(self):
        # Set expiration in the future
        future_expiry = datetime.utcnow() + timedelta(days=30)

        grant = ComponentGrant(
            id=uuid.uuid4(),
            component_id=uuid.uuid4(),
            agent_id=uuid.uuid4(),
            granted_by=uuid.uuid4(),
            expires_at=future_expiry,
        )

        assert grant.is_active is True

    def test_grant_default_access_level_is_viewer(self):
        grant = ComponentGrant(
            id=uuid.uuid4(),
            component_id=uuid.uuid4(),
            agent_id=uuid.uuid4(),
            granted_by=uuid.uuid4(),
        )

        assert grant.access_level == ComponentAccessLevel.VIEWER

    def test_grant_with_executor_access_level(self):
        grant = ComponentGrant(
            id=uuid.uuid4(),
            component_id=uuid.uuid4(),
            agent_id=uuid.uuid4(),
            granted_by=uuid.uuid4(),
            access_level=ComponentAccessLevel.EXECUTOR,
        )

        assert grant.access_level == ComponentAccessLevel.EXECUTOR

    def test_grant_with_contributor_access_level(self):
        grant = ComponentGrant(
            id=uuid.uuid4(),
            component_id=uuid.uuid4(),
            agent_id=uuid.uuid4(),
            granted_by=uuid.uuid4(),
            access_level=ComponentAccessLevel.CONTRIBUTOR,
        )

        assert grant.access_level == ComponentAccessLevel.CONTRIBUTOR


class TestComponentAccessLevel:
    def test_viewer_can_view(self):
        assert ComponentAccessLevel.VIEWER.can_view() is True

    def test_viewer_cannot_execute(self):
        assert ComponentAccessLevel.VIEWER.can_execute() is False

    def test_viewer_cannot_modify(self):
        assert ComponentAccessLevel.VIEWER.can_modify() is False

    def test_executor_can_view(self):
        assert ComponentAccessLevel.EXECUTOR.can_view() is True

    def test_executor_can_execute(self):
        assert ComponentAccessLevel.EXECUTOR.can_execute() is True

    def test_executor_cannot_modify(self):
        assert ComponentAccessLevel.EXECUTOR.can_modify() is False

    def test_contributor_can_view(self):
        assert ComponentAccessLevel.CONTRIBUTOR.can_view() is True

    def test_contributor_can_execute(self):
        assert ComponentAccessLevel.CONTRIBUTOR.can_execute() is True

    def test_contributor_can_modify(self):
        assert ComponentAccessLevel.CONTRIBUTOR.can_modify() is True
