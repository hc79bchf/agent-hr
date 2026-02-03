import uuid
from app.models.organization import Organization


class TestOrganizationModel:
    def test_organization_has_required_fields(self):
        org = Organization(
            id=uuid.uuid4(),
            name="Acme Corp",
        )
        assert org.name == "Acme Corp"
        assert org.parent_id is None
        # org_metadata has a database default, None before persistence is expected
        assert org.org_metadata is None or org.org_metadata == {}

    def test_organization_with_parent(self):
        parent_id = uuid.uuid4()
        org = Organization(
            id=uuid.uuid4(),
            name="Engineering",
            parent_id=parent_id,
        )
        assert org.parent_id == parent_id

    def test_organization_with_explicit_metadata(self):
        org = Organization(
            id=uuid.uuid4(),
            name="Sales",
            org_metadata={"region": "EMEA"},
        )
        assert org.org_metadata == {"region": "EMEA"}
