import pytest
from app.models.user import User
import uuid


def test_user_model_has_required_fields():
    user = User(
        id=uuid.uuid4(),
        email="test@example.com",
        name="Test User",
        password_hash="hashed_password",
    )
    assert user.email == "test@example.com"
    assert user.name == "Test User"
    assert user.password_hash == "hashed_password"


def test_agent_model_has_required_fields():
    from app.models.agent import Agent, AgentStatus

    agent = Agent(
        id=uuid.uuid4(),
        name="Test Agent",
        description="A test agent",
        author_id=uuid.uuid4(),
        status=AgentStatus.DRAFT,
        tags=["test", "demo"],
        department="Engineering",
    )
    assert agent.name == "Test Agent"
    assert agent.status == AgentStatus.DRAFT
    assert agent.tags == ["test", "demo"]


def test_agent_version_model_has_required_fields():
    from app.models.agent import AgentVersion, ChangeType

    version = AgentVersion(
        id=uuid.uuid4(),
        agent_id=uuid.uuid4(),
        version_number=1,
        change_type=ChangeType.UPLOAD,
        change_summary="Initial upload",
        raw_config={"files": []},
        parsed_config={"skills": []},
        created_by=uuid.uuid4(),
    )
    assert version.version_number == 1
    assert version.change_type == ChangeType.UPLOAD


def test_component_model_has_required_fields():
    from app.models.component import Component, ComponentType

    component = Component(
        id=uuid.uuid4(),
        version_id=uuid.uuid4(),
        type=ComponentType.SKILL,
        name="code-review",
        description="Reviews code for issues",
        content="# Code Review Skill\n...",
        config={"trigger": "/review"},
        source_path=".claude/commands/code-review.md",
    )
    assert component.type == ComponentType.SKILL
    assert component.name == "code-review"
    assert component.source_path == ".claude/commands/code-review.md"
