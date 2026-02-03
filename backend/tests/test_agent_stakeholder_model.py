import uuid
from app.models.agent_stakeholder import AgentStakeholder, StakeholderRole


class TestAgentStakeholderModel:
    def test_stakeholder_roles_enum(self):
        assert StakeholderRole.OWNER.value == "owner"
        assert StakeholderRole.CONTRIBUTOR.value == "contributor"
        assert StakeholderRole.VIEWER.value == "viewer"
        assert StakeholderRole.ADMIN.value == "admin"

    def test_stakeholder_has_required_fields(self):
        agent_id = uuid.uuid4()
        user_id = uuid.uuid4()
        granted_by = uuid.uuid4()

        stakeholder = AgentStakeholder(
            id=uuid.uuid4(),
            agent_id=agent_id,
            user_id=user_id,
            role=StakeholderRole.CONTRIBUTOR,
            granted_by=granted_by,
        )

        assert stakeholder.agent_id == agent_id
        assert stakeholder.user_id == user_id
        assert stakeholder.role == StakeholderRole.CONTRIBUTOR
        assert stakeholder.granted_by == granted_by
