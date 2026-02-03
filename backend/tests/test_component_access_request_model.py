import uuid
from datetime import datetime
from app.models.component_access_request import ComponentAccessRequest, RequestStatus
from app.models.component_grant import ComponentAccessLevel


class TestRequestStatus:
    def test_pending_status(self):
        assert RequestStatus.PENDING.value == "pending"

    def test_approved_status(self):
        assert RequestStatus.APPROVED.value == "approved"

    def test_denied_status(self):
        assert RequestStatus.DENIED.value == "denied"


class TestComponentAccessRequestModel:
    def test_request_has_required_fields(self):
        component_id = uuid.uuid4()
        agent_id = uuid.uuid4()
        requested_by = uuid.uuid4()

        request = ComponentAccessRequest(
            id=uuid.uuid4(),
            component_id=component_id,
            agent_id=agent_id,
            requested_level=ComponentAccessLevel.EXECUTOR,
            requested_by=requested_by,
        )

        assert request.component_id == component_id
        assert request.agent_id == agent_id
        assert request.requested_level == ComponentAccessLevel.EXECUTOR
        assert request.requested_by == requested_by
        assert request.status == RequestStatus.PENDING
        assert request.resolved_by is None
        assert request.resolved_at is None
        assert request.denial_reason is None

    def test_request_for_contributor_level(self):
        request = ComponentAccessRequest(
            id=uuid.uuid4(),
            component_id=uuid.uuid4(),
            agent_id=uuid.uuid4(),
            requested_level=ComponentAccessLevel.CONTRIBUTOR,
            requested_by=uuid.uuid4(),
        )

        assert request.requested_level == ComponentAccessLevel.CONTRIBUTOR

    def test_request_is_pending_when_new(self):
        request = ComponentAccessRequest(
            id=uuid.uuid4(),
            component_id=uuid.uuid4(),
            agent_id=uuid.uuid4(),
            requested_level=ComponentAccessLevel.EXECUTOR,
            requested_by=uuid.uuid4(),
        )

        assert request.is_pending is True

    def test_request_is_not_pending_when_approved(self):
        request = ComponentAccessRequest(
            id=uuid.uuid4(),
            component_id=uuid.uuid4(),
            agent_id=uuid.uuid4(),
            requested_level=ComponentAccessLevel.EXECUTOR,
            requested_by=uuid.uuid4(),
            status=RequestStatus.APPROVED,
            resolved_by=uuid.uuid4(),
            resolved_at=datetime.utcnow(),
        )

        assert request.is_pending is False

    def test_request_is_not_pending_when_denied(self):
        request = ComponentAccessRequest(
            id=uuid.uuid4(),
            component_id=uuid.uuid4(),
            agent_id=uuid.uuid4(),
            requested_level=ComponentAccessLevel.EXECUTOR,
            requested_by=uuid.uuid4(),
            status=RequestStatus.DENIED,
            resolved_by=uuid.uuid4(),
            resolved_at=datetime.utcnow(),
            denial_reason="Access not required for this use case",
        )

        assert request.is_pending is False
        assert request.denial_reason == "Access not required for this use case"
