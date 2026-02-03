import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.database import get_db
from app.main import app
from app.models.user import User

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_database():
    # Create User table (drop and recreate to ensure schema is up to date)
    User.__table__.drop(bind=engine, checkfirst=True)
    User.__table__.create(bind=engine, checkfirst=True)

    # Create SQLite-compatible tables using raw SQL
    # This avoids issues with PostgreSQL-specific types (ARRAY, JSONB)
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS agents (
                id VARCHAR(36) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                author_id VARCHAR(36) NOT NULL,
                current_version_id VARCHAR(36),
                status VARCHAR(20) DEFAULT 'draft' NOT NULL,
                tags JSON DEFAULT '[]',
                department VARCHAR(255),
                usage_notes TEXT,
                organization_id VARCHAR(36),
                manager_id VARCHAR(36),
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                deleted_at DATETIME
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS agent_versions (
                id VARCHAR(36) PRIMARY KEY,
                agent_id VARCHAR(36) NOT NULL,
                version_number INTEGER NOT NULL,
                parent_version_id VARCHAR(36),
                change_type VARCHAR(20) NOT NULL,
                change_summary TEXT,
                raw_config JSON DEFAULT '{}',
                parsed_config JSON DEFAULT '{}',
                created_by VARCHAR(36) NOT NULL,
                created_at DATETIME NOT NULL,
                FOREIGN KEY (agent_id) REFERENCES agents(id)
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS components (
                id VARCHAR(36) PRIMARY KEY,
                version_id VARCHAR(36) NOT NULL,
                type VARCHAR(20) NOT NULL,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                content TEXT,
                config JSON DEFAULT '{}',
                source_path VARCHAR(512),
                FOREIGN KEY (version_id) REFERENCES agent_versions(id)
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS organizations (
                id VARCHAR(36) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                parent_id VARCHAR(36),
                org_metadata JSON DEFAULT '{}',
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                deleted_at DATETIME,
                FOREIGN KEY (parent_id) REFERENCES organizations(id)
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS agent_stakeholders (
                id VARCHAR(36) PRIMARY KEY,
                agent_id VARCHAR(36) NOT NULL,
                user_id VARCHAR(36) NOT NULL,
                role VARCHAR(20) NOT NULL,
                granted_by VARCHAR(36) NOT NULL,
                granted_at DATETIME NOT NULL,
                UNIQUE(agent_id, user_id)
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS component_registry (
                id VARCHAR(36) PRIMARY KEY,
                type VARCHAR(20) NOT NULL,
                name VARCHAR(255) NOT NULL,
                owner_id VARCHAR(36) NOT NULL,
                organization_id VARCHAR(36),
                manager_id VARCHAR(36),
                visibility VARCHAR(20) NOT NULL DEFAULT 'private',
                component_metadata JSON DEFAULT '{}',
                created_at DATETIME NOT NULL,
                updated_at DATETIME NOT NULL,
                deleted_at DATETIME
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS component_grants (
                id VARCHAR(36) PRIMARY KEY,
                component_id VARCHAR(36) NOT NULL,
                agent_id VARCHAR(36) NOT NULL,
                access_level VARCHAR(20) NOT NULL DEFAULT 'viewer',
                granted_by VARCHAR(36) NOT NULL,
                granted_at DATETIME NOT NULL,
                expires_at DATETIME,
                revoked_at DATETIME,
                UNIQUE(component_id, agent_id)
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS component_access_requests (
                id VARCHAR(36) PRIMARY KEY,
                component_id VARCHAR(36) NOT NULL,
                agent_id VARCHAR(36) NOT NULL,
                requested_by VARCHAR(36) NOT NULL,
                requested_level VARCHAR(20) NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                justification TEXT,
                requested_at DATETIME NOT NULL,
                resolved_at DATETIME,
                resolved_by VARCHAR(36),
                denial_reason TEXT,
                UNIQUE(component_id, agent_id, status)
            )
        """))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS agent_user_grants (
                id VARCHAR(36) PRIMARY KEY,
                agent_id VARCHAR(36) NOT NULL,
                user_id VARCHAR(36) NOT NULL,
                access_level VARCHAR(20) NOT NULL,
                granted_by VARCHAR(36) NOT NULL,
                granted_at DATETIME NOT NULL,
                expires_at DATETIME,
                revoked_at DATETIME,
                UNIQUE(agent_id, user_id)
            )
        """))
        conn.commit()

    yield

    # Drop tables in reverse order
    with engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS component_access_requests"))
        conn.execute(text("DROP TABLE IF EXISTS agent_user_grants"))
        conn.execute(text("DROP TABLE IF EXISTS component_grants"))
        conn.execute(text("DROP TABLE IF EXISTS component_registry"))
        conn.execute(text("DROP TABLE IF EXISTS agent_stakeholders"))
        conn.execute(text("DROP TABLE IF EXISTS organizations"))
        conn.execute(text("DROP TABLE IF EXISTS components"))
        conn.execute(text("DROP TABLE IF EXISTS agent_versions"))
        conn.execute(text("DROP TABLE IF EXISTS agents"))
        conn.commit()
    User.__table__.drop(bind=engine, checkfirst=True)


@pytest.fixture
def db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client(db):
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()
