import uuid
from datetime import datetime
from unittest.mock import MagicMock

import pytest

from app.schemas.organization import (
    OrganizationCreate,
    OrganizationUpdate,
    OrganizationResponse,
    OrganizationListResponse,
)


class TestOrganizationCreate:
    def test_create_with_required_fields_only(self):
        schema = OrganizationCreate(name="Acme Corp")
        assert schema.name == "Acme Corp"
        assert schema.parent_id is None
        assert schema.metadata == {}

    def test_create_with_all_fields(self):
        parent_id = uuid.uuid4()
        schema = OrganizationCreate(
            name="Engineering",
            parent_id=parent_id,
            metadata={"region": "EMEA", "cost_center": "CC-123"},
        )
        assert schema.name == "Engineering"
        assert schema.parent_id == parent_id
        assert schema.metadata == {"region": "EMEA", "cost_center": "CC-123"}

    def test_create_with_empty_metadata(self):
        schema = OrganizationCreate(name="Sales", metadata={})
        assert schema.metadata == {}


class TestOrganizationUpdate:
    def test_update_with_no_fields(self):
        schema = OrganizationUpdate()
        assert schema.name is None
        assert schema.parent_id is None
        assert schema.metadata is None

    def test_update_name_only(self):
        schema = OrganizationUpdate(name="New Name")
        assert schema.name == "New Name"
        assert schema.parent_id is None
        assert schema.metadata is None

    def test_update_all_fields(self):
        parent_id = uuid.uuid4()
        schema = OrganizationUpdate(
            name="Updated Org",
            parent_id=parent_id,
            metadata={"updated": True},
        )
        assert schema.name == "Updated Org"
        assert schema.parent_id == parent_id
        assert schema.metadata == {"updated": True}


class TestOrganizationResponse:
    def test_response_from_dict(self):
        org_id = uuid.uuid4()
        now = datetime.utcnow()
        schema = OrganizationResponse(
            id=org_id,
            name="Test Org",
            parent_id=None,
            org_metadata={"key": "value"},
            created_at=now,
            updated_at=now,
        )
        assert schema.id == org_id
        assert schema.name == "Test Org"
        assert schema.parent_id is None
        assert schema.metadata == {"key": "value"}
        assert schema.created_at == now
        assert schema.updated_at == now

    def test_response_with_parent_id(self):
        org_id = uuid.uuid4()
        parent_id = uuid.uuid4()
        now = datetime.utcnow()
        schema = OrganizationResponse(
            id=org_id,
            name="Child Org",
            parent_id=parent_id,
            org_metadata={},
            created_at=now,
            updated_at=now,
        )
        assert schema.parent_id == parent_id

    def test_response_from_attributes(self):
        """Test from_attributes=True works with ORM-like objects."""
        org_id = uuid.uuid4()
        now = datetime.utcnow()

        # Mock an ORM object with attributes
        mock_org = MagicMock()
        mock_org.id = org_id
        mock_org.name = "ORM Org"
        mock_org.parent_id = None
        mock_org.org_metadata = {"source": "db"}
        mock_org.created_at = now
        mock_org.updated_at = now

        schema = OrganizationResponse.model_validate(mock_org)
        assert schema.id == org_id
        assert schema.name == "ORM Org"
        assert schema.metadata == {"source": "db"}


class TestOrganizationListResponse:
    def test_empty_list(self):
        schema = OrganizationListResponse(data=[], total=0)
        assert schema.data == []
        assert schema.total == 0

    def test_list_with_items(self):
        org_id = uuid.uuid4()
        now = datetime.utcnow()
        org_response = OrganizationResponse(
            id=org_id,
            name="Listed Org",
            parent_id=None,
            org_metadata={},
            created_at=now,
            updated_at=now,
        )
        schema = OrganizationListResponse(data=[org_response], total=1)
        assert len(schema.data) == 1
        assert schema.data[0].name == "Listed Org"
        assert schema.total == 1
