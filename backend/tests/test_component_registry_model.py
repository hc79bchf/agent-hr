import uuid
from app.models.component_registry import ComponentRegistry, ComponentType, ComponentVisibility


class TestComponentRegistryModel:
    def test_component_types_enum(self):
        assert ComponentType.SKILL.value == "skill"
        assert ComponentType.TOOL.value == "tool"
        assert ComponentType.MEMORY.value == "memory"

    def test_visibility_enum(self):
        assert ComponentVisibility.PRIVATE.value == "private"
        assert ComponentVisibility.ORGANIZATION.value == "organization"
        assert ComponentVisibility.PUBLIC.value == "public"

    def test_component_registry_has_required_fields(self):
        owner_id = uuid.uuid4()

        component = ComponentRegistry(
            id=uuid.uuid4(),
            type=ComponentType.SKILL,
            name="Data Analysis",
            owner_id=owner_id,
        )

        assert component.type == ComponentType.SKILL
        assert component.name == "Data Analysis"
        assert component.owner_id == owner_id
        assert component.visibility == ComponentVisibility.PRIVATE
        assert component.organization_id is None
        assert component.manager_id is None

    def test_component_registry_with_organization_metadata(self):
        owner_id = uuid.uuid4()
        org_id = uuid.uuid4()
        manager_id = uuid.uuid4()

        component = ComponentRegistry(
            id=uuid.uuid4(),
            type=ComponentType.TOOL,
            name="API Integration",
            owner_id=owner_id,
            organization_id=org_id,
            manager_id=manager_id,
        )

        assert component.organization_id == org_id
        assert component.manager_id == manager_id
