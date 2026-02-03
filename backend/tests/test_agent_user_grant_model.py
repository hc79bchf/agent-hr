import uuid
from datetime import datetime, timedelta
from app.models.agent_user_grant import AgentUserGrant, AccessLevel


class TestAccessLevelEnum:
    def test_access_levels_enum_values(self):
        assert AccessLevel.VIEWER.value == "viewer"
        assert AccessLevel.USER.value == "user"
        assert AccessLevel.CONTRIBUTOR.value == "contributor"
        assert AccessLevel.ADMIN.value == "admin"

    def test_access_level_permissions_viewer(self):
        level = AccessLevel.VIEWER
        assert level.can_view() is True
        assert level.can_interact() is False
        assert level.can_train() is False
        assert level.can_manage_grants() is False

    def test_access_level_permissions_user(self):
        level = AccessLevel.USER
        assert level.can_view() is True
        assert level.can_interact() is True
        assert level.can_train() is False
        assert level.can_manage_grants() is False

    def test_access_level_permissions_contributor(self):
        level = AccessLevel.CONTRIBUTOR
        assert level.can_view() is True
        assert level.can_interact() is True
        assert level.can_train() is True
        assert level.can_manage_grants() is False

    def test_access_level_permissions_admin(self):
        level = AccessLevel.ADMIN
        assert level.can_view() is True
        assert level.can_interact() is True
        assert level.can_train() is True
        assert level.can_manage_grants() is True

    def test_access_level_hierarchy(self):
        """Test that access levels have correct permission hierarchy."""
        viewer = AccessLevel.VIEWER
        user = AccessLevel.USER
        contributor = AccessLevel.CONTRIBUTOR
        admin = AccessLevel.ADMIN

        # Verify ordering works for comparison
        levels = [viewer, user, contributor, admin]
        expected_order = ["viewer", "user", "contributor", "admin"]
        assert levels == sorted(
            levels, key=lambda x: expected_order.index(x.value)
        )


class TestAgentUserGrantModel:
    def test_grant_has_required_fields(self):
        agent_id = uuid.uuid4()
        user_id = uuid.uuid4()
        granted_by = uuid.uuid4()

        grant = AgentUserGrant(
            id=uuid.uuid4(),
            agent_id=agent_id,
            user_id=user_id,
            access_level=AccessLevel.USER,
            granted_by=granted_by,
        )

        assert grant.agent_id == agent_id
        assert grant.user_id == user_id
        assert grant.access_level == AccessLevel.USER
        assert grant.granted_by == granted_by
        assert grant.expires_at is None
        assert grant.revoked_at is None

    def test_grant_with_all_access_levels(self):
        """Test that grants work with all access levels."""
        for level in AccessLevel:
            grant = AgentUserGrant(
                id=uuid.uuid4(),
                agent_id=uuid.uuid4(),
                user_id=uuid.uuid4(),
                access_level=level,
                granted_by=uuid.uuid4(),
            )
            assert grant.access_level == level

    def test_grant_with_expiration(self):
        expires = datetime.utcnow() + timedelta(days=30)

        grant = AgentUserGrant(
            id=uuid.uuid4(),
            agent_id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            access_level=AccessLevel.USER,
            granted_by=uuid.uuid4(),
            expires_at=expires,
        )

        assert grant.expires_at == expires

    def test_grant_is_active_when_not_revoked(self):
        grant = AgentUserGrant(
            id=uuid.uuid4(),
            agent_id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            access_level=AccessLevel.USER,
            granted_by=uuid.uuid4(),
        )

        assert grant.is_active is True

    def test_grant_is_not_active_when_revoked(self):
        grant = AgentUserGrant(
            id=uuid.uuid4(),
            agent_id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            access_level=AccessLevel.USER,
            granted_by=uuid.uuid4(),
            revoked_at=datetime.utcnow(),
        )

        assert grant.is_active is False

    def test_grant_is_not_active_when_expired(self):
        # Set expiration in the past
        past_expiry = datetime.utcnow() - timedelta(days=1)

        grant = AgentUserGrant(
            id=uuid.uuid4(),
            agent_id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            access_level=AccessLevel.USER,
            granted_by=uuid.uuid4(),
            expires_at=past_expiry,
        )

        assert grant.is_active is False

    def test_grant_is_active_when_not_yet_expired(self):
        # Set expiration in the future
        future_expiry = datetime.utcnow() + timedelta(days=30)

        grant = AgentUserGrant(
            id=uuid.uuid4(),
            agent_id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            access_level=AccessLevel.USER,
            granted_by=uuid.uuid4(),
            expires_at=future_expiry,
        )

        assert grant.is_active is True

    def test_revoked_takes_precedence_over_expiration(self):
        """Test that revocation takes precedence even if not expired."""
        future_expiry = datetime.utcnow() + timedelta(days=30)

        grant = AgentUserGrant(
            id=uuid.uuid4(),
            agent_id=uuid.uuid4(),
            user_id=uuid.uuid4(),
            access_level=AccessLevel.USER,
            granted_by=uuid.uuid4(),
            expires_at=future_expiry,
            revoked_at=datetime.utcnow(),
        )

        assert grant.is_active is False
