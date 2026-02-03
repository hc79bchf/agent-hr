import uuid
from datetime import datetime
from unittest.mock import MagicMock

import pytest

from app.models.agent_stakeholder import StakeholderRole
from app.schemas.stakeholder import (
    StakeholderCreate,
    StakeholderResponse,
    StakeholderListResponse,
)


class TestStakeholderCreate:
    def test_create_with_owner_role(self):
        user_id = uuid.uuid4()
        schema = StakeholderCreate(user_id=user_id, role=StakeholderRole.OWNER)
        assert schema.user_id == user_id
        assert schema.role == StakeholderRole.OWNER

    def test_create_with_contributor_role(self):
        user_id = uuid.uuid4()
        schema = StakeholderCreate(user_id=user_id, role=StakeholderRole.CONTRIBUTOR)
        assert schema.role == StakeholderRole.CONTRIBUTOR

    def test_create_with_viewer_role(self):
        user_id = uuid.uuid4()
        schema = StakeholderCreate(user_id=user_id, role=StakeholderRole.VIEWER)
        assert schema.role == StakeholderRole.VIEWER

    def test_create_with_admin_role(self):
        user_id = uuid.uuid4()
        schema = StakeholderCreate(user_id=user_id, role=StakeholderRole.ADMIN)
        assert schema.role == StakeholderRole.ADMIN

    def test_create_with_string_role(self):
        user_id = uuid.uuid4()
        schema = StakeholderCreate(user_id=user_id, role="owner")
        assert schema.role == StakeholderRole.OWNER


class TestStakeholderResponse:
    def test_response_from_dict(self):
        stakeholder_id = uuid.uuid4()
        agent_id = uuid.uuid4()
        user_id = uuid.uuid4()
        granted_by_id = uuid.uuid4()
        now = datetime.utcnow()

        schema = StakeholderResponse(
            id=stakeholder_id,
            agent_id=agent_id,
            user_id=user_id,
            role=StakeholderRole.CONTRIBUTOR,
            granted_by=granted_by_id,
            granted_at=now,
        )
        assert schema.id == stakeholder_id
        assert schema.agent_id == agent_id
        assert schema.user_id == user_id
        assert schema.role == StakeholderRole.CONTRIBUTOR
        assert schema.granted_by == granted_by_id
        assert schema.granted_at == now

    def test_response_from_attributes(self):
        """Test from_attributes=True works with ORM-like objects."""
        stakeholder_id = uuid.uuid4()
        agent_id = uuid.uuid4()
        user_id = uuid.uuid4()
        granted_by_id = uuid.uuid4()
        now = datetime.utcnow()

        # Mock an ORM object with attributes
        mock_stakeholder = MagicMock()
        mock_stakeholder.id = stakeholder_id
        mock_stakeholder.agent_id = agent_id
        mock_stakeholder.user_id = user_id
        mock_stakeholder.role = StakeholderRole.VIEWER
        mock_stakeholder.granted_by = granted_by_id
        mock_stakeholder.granted_at = now

        schema = StakeholderResponse.model_validate(mock_stakeholder)
        assert schema.id == stakeholder_id
        assert schema.agent_id == agent_id
        assert schema.user_id == user_id
        assert schema.role == StakeholderRole.VIEWER
        assert schema.granted_by == granted_by_id
        assert schema.granted_at == now


class TestStakeholderListResponse:
    def test_empty_list(self):
        schema = StakeholderListResponse(data=[], total=0)
        assert schema.data == []
        assert schema.total == 0

    def test_list_with_items(self):
        stakeholder_id = uuid.uuid4()
        agent_id = uuid.uuid4()
        user_id = uuid.uuid4()
        granted_by_id = uuid.uuid4()
        now = datetime.utcnow()

        stakeholder_response = StakeholderResponse(
            id=stakeholder_id,
            agent_id=agent_id,
            user_id=user_id,
            role=StakeholderRole.OWNER,
            granted_by=granted_by_id,
            granted_at=now,
        )
        schema = StakeholderListResponse(data=[stakeholder_response], total=1)
        assert len(schema.data) == 1
        assert schema.data[0].role == StakeholderRole.OWNER
        assert schema.total == 1

    def test_list_with_multiple_items(self):
        agent_id = uuid.uuid4()
        granted_by_id = uuid.uuid4()
        now = datetime.utcnow()

        stakeholders = []
        for role in [StakeholderRole.OWNER, StakeholderRole.CONTRIBUTOR, StakeholderRole.VIEWER]:
            stakeholders.append(
                StakeholderResponse(
                    id=uuid.uuid4(),
                    agent_id=agent_id,
                    user_id=uuid.uuid4(),
                    role=role,
                    granted_by=granted_by_id,
                    granted_at=now,
                )
            )

        schema = StakeholderListResponse(data=stakeholders, total=3)
        assert len(schema.data) == 3
        assert schema.total == 3
        roles = [s.role for s in schema.data]
        assert StakeholderRole.OWNER in roles
        assert StakeholderRole.CONTRIBUTOR in roles
        assert StakeholderRole.VIEWER in roles
