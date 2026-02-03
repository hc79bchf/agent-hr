"""Deployment service for orchestrating agent deployments."""

from datetime import datetime
from typing import Optional
from uuid import UUID
from sqlalchemy.orm import Session
from docker.errors import DockerException, NotFound

from app.models import AgentDeployment, DeploymentStatus, Agent
from app.services.docker_service import DockerService
from app.services.config_builder import ConfigBuilder


class DeploymentService:
    """Orchestrates the full agent deployment lifecycle."""

    def __init__(self, db: Session):
        """Initialize deployment service.

        Args:
            db: SQLAlchemy database session.
        """
        self.db = db
        self.docker = DockerService()
        self.config_builder = ConfigBuilder(db)

    async def deploy(
        self,
        agent_id: UUID,
        version_id: UUID,
        user_id: Optional[UUID] = None,
    ) -> AgentDeployment:
        """Deploy an agent version as a Docker container.

        Args:
            agent_id: The agent's UUID.
            version_id: The version to deploy.
            user_id: The user initiating the deployment.

        Returns:
            The created deployment record.

        Raises:
            ValueError: If agent or version not found.
            DockerException: If deployment fails.
        """
        # Verify agent exists
        agent = self.db.query(Agent).filter(Agent.id == agent_id).first()
        if not agent:
            raise ValueError(f"Agent {agent_id} not found")

        # Stop any existing running deployment for this agent
        await self._stop_existing_deployments(agent_id)

        # Create deployment record
        deployment = AgentDeployment(
            agent_id=agent_id,
            version_id=version_id,
            status=DeploymentStatus.PENDING.value,
            created_by=user_id,
        )
        self.db.add(deployment)
        self.db.commit()
        self.db.refresh(deployment)

        try:
            # Build config
            self._update_status(deployment, DeploymentStatus.BUILDING)
            config = self.config_builder.build_config(version_id)

            # Build image
            image_id = self.docker.build_image(
                str(agent_id),
                str(version_id),
                config,
            )
            deployment.image_id = image_id
            self.db.commit()

            # Start container
            self._update_status(deployment, DeploymentStatus.STARTING)
            container_id, port = self.docker.create_container(
                image_id,
                str(deployment.id),
            )

            # Update deployment with container info
            deployment.container_id = container_id
            deployment.port = port
            deployment.status = DeploymentStatus.RUNNING.value
            deployment.started_at = datetime.utcnow()
            self.db.commit()
            self.db.refresh(deployment)

            return deployment

        except Exception as e:
            # Mark deployment as failed
            deployment.status = DeploymentStatus.FAILED.value
            deployment.error_message = str(e)
            self.db.commit()
            raise

    async def stop(self, deployment_id: UUID) -> AgentDeployment:
        """Stop a running deployment.

        Args:
            deployment_id: The deployment's UUID.

        Returns:
            The updated deployment record.

        Raises:
            ValueError: If deployment not found.
        """
        deployment = (
            self.db.query(AgentDeployment)
            .filter(AgentDeployment.id == deployment_id)
            .first()
        )
        if not deployment:
            raise ValueError(f"Deployment {deployment_id} not found")

        if deployment.status != DeploymentStatus.RUNNING.value:
            raise ValueError(f"Deployment is not running (status: {deployment.status})")

        self._update_status(deployment, DeploymentStatus.STOPPING)

        try:
            if deployment.container_id:
                self.docker.stop_container(deployment.container_id)
                self.docker.remove_container(deployment.container_id)
        except NotFound:
            # Container already removed
            pass

        deployment.status = DeploymentStatus.STOPPED.value
        deployment.stopped_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(deployment)

        return deployment

    def get_status(self, deployment_id: UUID) -> dict:
        """Get deployment status including container health.

        Args:
            deployment_id: The deployment's UUID.

        Returns:
            Status dictionary with deployment and container info.

        Raises:
            ValueError: If deployment not found.
        """
        deployment = (
            self.db.query(AgentDeployment)
            .filter(AgentDeployment.id == deployment_id)
            .first()
        )
        if not deployment:
            raise ValueError(f"Deployment {deployment_id} not found")

        result = {
            "id": str(deployment.id),
            "agent_id": str(deployment.agent_id),
            "version_id": str(deployment.version_id),
            "status": deployment.status,
            "port": deployment.port,
            "created_at": deployment.created_at.isoformat() if deployment.created_at else None,
            "started_at": deployment.started_at.isoformat() if deployment.started_at else None,
            "stopped_at": deployment.stopped_at.isoformat() if deployment.stopped_at else None,
            "error_message": deployment.error_message,
        }

        # Get container health if running
        if deployment.container_id and deployment.status == DeploymentStatus.RUNNING.value:
            try:
                container_status = self.docker.get_container_status(deployment.container_id)
                result["container"] = container_status
            except NotFound:
                result["container"] = {"status": "not_found"}

        return result

    def list_deployments(
        self,
        agent_id: Optional[UUID] = None,
        status: Optional[str] = None,
        limit: int = 20,
    ) -> list[AgentDeployment]:
        """List deployments with optional filters.

        Args:
            agent_id: Filter by agent.
            status: Filter by status.
            limit: Maximum results to return.

        Returns:
            List of deployment records.
        """
        query = self.db.query(AgentDeployment)

        if agent_id:
            query = query.filter(AgentDeployment.agent_id == agent_id)
        if status:
            query = query.filter(AgentDeployment.status == status)

        return (
            query.order_by(AgentDeployment.created_at.desc())
            .limit(limit)
            .all()
        )

    def get_active_deployment(self, agent_id: UUID) -> Optional[AgentDeployment]:
        """Get the active (running) deployment for an agent.

        Args:
            agent_id: The agent's UUID.

        Returns:
            The running deployment, or None if no active deployment.
        """
        return (
            self.db.query(AgentDeployment)
            .filter(
                AgentDeployment.agent_id == agent_id,
                AgentDeployment.status == DeploymentStatus.RUNNING.value,
            )
            .first()
        )

    async def _stop_existing_deployments(self, agent_id: UUID) -> None:
        """Stop any existing running deployments for an agent.

        Args:
            agent_id: The agent's UUID.
        """
        running_deployments = (
            self.db.query(AgentDeployment)
            .filter(
                AgentDeployment.agent_id == agent_id,
                AgentDeployment.status == DeploymentStatus.RUNNING.value,
            )
            .all()
        )

        for deployment in running_deployments:
            try:
                await self.stop(deployment.id)
            except Exception:
                # Force update status if stop fails
                deployment.status = DeploymentStatus.STOPPED.value
                deployment.stopped_at = datetime.utcnow()
                self.db.commit()

    def _update_status(
        self,
        deployment: AgentDeployment,
        status: DeploymentStatus,
    ) -> None:
        """Update deployment status.

        Args:
            deployment: The deployment record.
            status: New status value.
        """
        deployment.status = status.value
        self.db.commit()
