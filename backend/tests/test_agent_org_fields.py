import uuid
from app.models.agent import Agent


class TestAgentOrgFields:
    def test_agent_has_organization_id(self):
        org_id = uuid.uuid4()
        agent = Agent(
            id=uuid.uuid4(),
            name="Test Agent",
            author_id=uuid.uuid4(),
            organization_id=org_id,
        )
        assert agent.organization_id == org_id

    def test_agent_has_manager_id(self):
        manager_id = uuid.uuid4()
        agent = Agent(
            id=uuid.uuid4(),
            name="Test Agent",
            author_id=uuid.uuid4(),
            manager_id=manager_id,
        )
        assert agent.manager_id == manager_id

    def test_agent_org_fields_optional(self):
        agent = Agent(
            id=uuid.uuid4(),
            name="Test Agent",
            author_id=uuid.uuid4(),
        )
        assert agent.organization_id is None
        assert agent.manager_id is None
