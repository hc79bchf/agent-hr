import uuid
from datetime import datetime
import pytest
from app.schemas.grants import (
    ComponentGrantCreate,
    ComponentGrantResponse,
    ComponentGrantUpdate,
    ComponentAccessRequestCreate,
    ComponentAccessRequestResponse,
    ComponentAccessRequestResolve,
)
from app.models.component_grant import ComponentAccessLevel


class TestComponentGrantSchemas:
    def test_grant_create_with_access_level(self):
        data = ComponentGrantCreate(
            component_id=uuid.uuid4(),
            agent_id=uuid.uuid4(),
            access_level=ComponentAccessLevel.EXECUTOR,
        )
        assert data.access_level == ComponentAccessLevel.EXECUTOR

    def test_grant_create_defaults_to_viewer(self):
        data = ComponentGrantCreate(
            component_id=uuid.uuid4(),
            agent_id=uuid.uuid4(),
        )
        assert data.access_level == ComponentAccessLevel.VIEWER

    def test_grant_update_access_level(self):
        data = ComponentGrantUpdate(
            access_level=ComponentAccessLevel.CONTRIBUTOR
        )
        assert data.access_level == ComponentAccessLevel.CONTRIBUTOR


class TestComponentAccessRequestSchemas:
    def test_request_create_valid(self):
        data = ComponentAccessRequestCreate(
            component_id=uuid.uuid4(),
            agent_id=uuid.uuid4(),
            requested_level=ComponentAccessLevel.EXECUTOR,
        )
        assert data.requested_level == ComponentAccessLevel.EXECUTOR

    def test_request_create_viewer_not_allowed(self):
        """Cannot request viewer - it's the default."""
        with pytest.raises(ValueError):
            ComponentAccessRequestCreate(
                component_id=uuid.uuid4(),
                agent_id=uuid.uuid4(),
                requested_level=ComponentAccessLevel.VIEWER,
            )

    def test_request_resolve_approve(self):
        data = ComponentAccessRequestResolve(
            approve=True
        )
        assert data.approve is True

    def test_request_resolve_deny_with_reason(self):
        data = ComponentAccessRequestResolve(
            approve=False,
            denial_reason="Component is being deprecated",
        )
        assert data.denial_reason == "Component is being deprecated"

    def test_request_resolve_deny_requires_reason(self):
        """Denying requires a reason."""
        with pytest.raises(ValueError):
            ComponentAccessRequestResolve(
                approve=False,
            )
