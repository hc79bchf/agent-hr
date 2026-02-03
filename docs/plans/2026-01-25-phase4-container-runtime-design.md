# Phase 4: Container Runtime Design

**Date:** 2026-01-25
**Status:** Approved

---

## Overview

Deploy agents as Docker containers using Claude Code SDK, enabling real-time chat with configured agents.

### Key Decisions
- **Docker only** - No mock mode; requires Docker daemon
- **Claude Code SDK** - Uses `claude-agent-sdk` for agent execution inside containers

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Agent-HR Backend                             │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐    │
│  │ Deployments │  │ Docker       │  │ Config              │    │
│  │ Router      │──│ Service      │──│ Builder             │    │
│  └─────────────┘  └──────────────┘  └─────────────────────┘    │
│         │                │                                       │
│         │         ┌──────┴──────┐                               │
│         │         │ Docker API  │                               │
│         │         └──────┬──────┘                               │
└─────────│────────────────│──────────────────────────────────────┘
          │                │
          │    ┌───────────┴───────────┐
          │    │   Agent Containers    │
          │    │  ┌─────────────────┐  │
          │    │  │ agent-{id}:v{n} │  │
          │    │  │ ┌─────────────┐ │  │
          │    │  │ │ server.py   │ │  │
          ▼    │  │ │ (FastAPI)   │ │  │
    WebSocket ─┼──│ │     +       │ │  │
    /chat ─────┼──│ │ agent.py    │ │  │
          │    │  │ │ (SDK)       │ │  │
          │    │  │ └─────────────┘ │  │
          │    │  └─────────────────┘  │
          │    └───────────────────────┘
          │
┌─────────┴─────────┐
│   Frontend        │
│  ┌─────────────┐  │
│  │ AgentChat   │  │
│  │ Component   │  │
│  └─────────────┘  │
└───────────────────┘
```

---

## Data Model

### AgentDeployment Table

```sql
CREATE TABLE agent_deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id),
    version_id UUID NOT NULL REFERENCES agent_versions(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    container_id VARCHAR(64),
    image_id VARCHAR(64),
    port INTEGER,
    error_message TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    stopped_at TIMESTAMP
);

CREATE INDEX idx_deployments_agent ON agent_deployments(agent_id);
CREATE INDEX idx_deployments_status ON agent_deployments(status);
```

**Status values:** `pending`, `building`, `starting`, `running`, `stopping`, `stopped`, `failed`

---

## Agent Runtime Container

Each deployed agent runs in a Docker container with three core files:

### Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir \
    claude-agent-sdk \
    anthropic \
    fastapi \
    uvicorn \
    websockets

COPY server.py agent.py ./
COPY config/ ./config/

EXPOSE 8080

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8080"]
```

### server.py

FastAPI application inside the container:

```python
from fastapi import FastAPI, WebSocket
from agent import AgentRunner

app = FastAPI()
runner = AgentRunner()

@app.post("/chat")
async def chat(message: str, conversation_id: str = None):
    response = await runner.chat(message, conversation_id)
    return {"response": response, "conversation_id": conversation_id}

@app.websocket("/ws")
async def websocket_chat(websocket: WebSocket):
    await websocket.accept()
    conversation_id = None
    while True:
        data = await websocket.receive_json()
        async for chunk in runner.stream(data["message"], conversation_id):
            await websocket.send_json({"type": "chunk", "content": chunk})
        await websocket.send_json({"type": "done"})

@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.get("/config")
async def config():
    return runner.get_config()
```

### agent.py

Claude Code SDK wrapper:

```python
import json
from pathlib import Path
from claude_agent_sdk import Agent

class AgentRunner:
    def __init__(self):
        config_path = Path("/app/config/agent.json")
        self.config = json.loads(config_path.read_text())
        self.conversations = {}

        self.agent = Agent(
            system_prompt=self.config["system_prompt"],
            tools=self.config.get("tools", []),
            model=self.config.get("model", "claude-sonnet-4-5-20250929")
        )

    async def chat(self, message: str, conversation_id: str = None):
        history = self.conversations.get(conversation_id, [])
        response = await self.agent.chat(message, history=history)
        if conversation_id:
            self.conversations[conversation_id] = history + [
                {"role": "user", "content": message},
                {"role": "assistant", "content": response}
            ]
        return response

    async def stream(self, message: str, conversation_id: str = None):
        history = self.conversations.get(conversation_id, [])
        async for chunk in self.agent.stream(message, history=history):
            yield chunk

    def get_config(self):
        return {
            "model": self.config.get("model"),
            "has_tools": len(self.config.get("tools", [])) > 0
        }
```

### Configuration Structure

```json
{
  "system_prompt": "You are an agent with the following skills:\n\n## Skill: greeting\n...",
  "tools": [
    {
      "name": "search_database",
      "description": "Search the internal database",
      "parameters": {...}
    }
  ],
  "memory": [
    {"key": "company_info", "content": "..."}
  ],
  "model": "claude-sonnet-4-5-20250929"
}
```

---

## Backend Services

### DockerService

`backend/app/services/docker_service.py`

```python
import docker
from docker.errors import DockerException

class DockerService:
    def __init__(self):
        self.client = docker.from_env()

    async def build_image(self, agent_id: str, version_id: str, config_path: Path) -> str:
        """Build Docker image for agent. Returns image ID."""
        tag = f"agent-hr-agent-{agent_id}:{version_id[:8]}"
        image, logs = self.client.images.build(
            path=str(config_path.parent),
            tag=tag,
            rm=True
        )
        return image.id

    async def create_container(self, image_id: str, deployment_id: str) -> tuple[str, int]:
        """Start container. Returns (container_id, port)."""
        container = self.client.containers.run(
            image_id,
            detach=True,
            name=f"agent-{deployment_id[:8]}",
            ports={"8080/tcp": None},  # Dynamic port
            environment={
                "ANTHROPIC_API_KEY": settings.anthropic_api_key
            }
        )
        # Get assigned port
        container.reload()
        port = int(container.ports["8080/tcp"][0]["HostPort"])
        return container.id, port

    async def stop_container(self, container_id: str):
        """Graceful shutdown."""
        container = self.client.containers.get(container_id)
        container.stop(timeout=10)

    async def remove_container(self, container_id: str):
        """Remove container."""
        container = self.client.containers.get(container_id)
        container.remove(force=True)

    async def get_container_status(self, container_id: str) -> dict:
        """Get container health status."""
        container = self.client.containers.get(container_id)
        return {
            "status": container.status,
            "health": container.attrs.get("State", {}).get("Health", {}).get("Status")
        }
```

### ConfigBuilder

`backend/app/services/config_builder.py`

```python
class ConfigBuilder:
    async def build_config(self, version_id: str) -> dict:
        """Compile agent configuration from components."""
        components = await self.component_repo.list_by_version(version_id)

        # Build system prompt from skills
        skills = [c for c in components if c.type == "skill"]
        system_prompt = self._build_system_prompt(skills)

        # Convert MCP tools to tool definitions
        tools = [c for c in components if c.type == "mcp_tool"]
        tool_definitions = self._build_tools(tools)

        # Load memory items
        memory = [c for c in components if c.type == "memory"]
        memory_items = [{"key": m.name, "content": m.content} for m in memory]

        return {
            "system_prompt": system_prompt,
            "tools": tool_definitions,
            "memory": memory_items,
            "model": "claude-sonnet-4-5-20250929"
        }

    def _build_system_prompt(self, skills: list) -> str:
        sections = ["You are an AI agent with the following capabilities:\n"]
        for skill in skills:
            sections.append(f"## {skill.name}\n{skill.content}\n")
        return "\n".join(sections)

    def _build_tools(self, tools: list) -> list:
        definitions = []
        for tool in tools:
            if tool.config:
                definitions.append(tool.config)
        return definitions
```

### DeploymentService

`backend/app/services/deployment_service.py`

```python
class DeploymentService:
    def __init__(
        self,
        deployment_repo: DeploymentRepository,
        docker_service: DockerService,
        config_builder: ConfigBuilder
    ):
        self.deployment_repo = deployment_repo
        self.docker = docker_service
        self.config = config_builder

    async def deploy(self, agent_id: str, version_id: str, user_id: str) -> AgentDeployment:
        """Full deployment flow."""
        # Create deployment record
        deployment = await self.deployment_repo.create(
            agent_id=agent_id,
            version_id=version_id,
            created_by=user_id
        )

        try:
            # Build config
            await self.deployment_repo.update_status(deployment.id, "building")
            config = await self.config.build_config(version_id)
            config_path = await self._write_config(deployment.id, config)

            # Build image
            image_id = await self.docker.build_image(agent_id, version_id, config_path)
            await self.deployment_repo.update(deployment.id, image_id=image_id)

            # Start container
            await self.deployment_repo.update_status(deployment.id, "starting")
            container_id, port = await self.docker.create_container(image_id, deployment.id)

            await self.deployment_repo.update(
                deployment.id,
                container_id=container_id,
                port=port,
                status="running",
                started_at=datetime.utcnow()
            )

            return await self.deployment_repo.get(deployment.id)

        except Exception as e:
            await self.deployment_repo.update(
                deployment.id,
                status="failed",
                error_message=str(e)
            )
            raise
```

---

## API Endpoints

`backend/app/routers/deployments.py`

### Deploy Agent

```
POST /api/agents/{agent_id}/deploy
Body: { "version_id": "uuid" }  // optional, defaults to current version
Response: {
  "deployment": {
    "id": "uuid",
    "agent_id": "uuid",
    "version_id": "uuid",
    "status": "building",
    "container_id": null,
    "port": null,
    "created_at": "2026-01-25T..."
  },
  "message": "Deployment started"
}
```

### List Deployments

```
GET /api/agents/{agent_id}/deployments
Response: {
  "deployments": [
    {
      "id": "uuid",
      "status": "running",
      "port": 32768,
      "created_at": "...",
      "started_at": "..."
    }
  ]
}
```

### Get Deployment Status

```
GET /api/deployments/{deployment_id}
Response: {
  "deployment": {
    "id": "uuid",
    "status": "running",
    "container_id": "abc123...",
    "port": 32768,
    "health": "healthy"
  }
}
```

### Stop Deployment

```
POST /api/deployments/{deployment_id}/stop
Response: {
  "deployment": { "status": "stopped", "stopped_at": "..." }
}
```

### Chat with Agent

```
POST /api/deployments/{deployment_id}/chat
Body: { "message": "Hello", "conversation_id": "optional-uuid" }
Response: {
  "response": "Hello! How can I help you?",
  "conversation_id": "uuid"
}
```

### WebSocket Streaming

```
WS /api/deployments/{deployment_id}/ws
→ { "type": "message", "content": "Hello" }
← { "type": "chunk", "content": "Hello" }
← { "type": "chunk", "content": "!" }
← { "type": "done" }
```

---

## Frontend UI

### Agent Detail Page Updates

Add to header section:
- **Deploy button** - Triggers deployment of current version
- **Status badge** - Shows deployment status (running/stopped/none)
- **Stop button** - Visible when running
- **Chat button** - Opens chat interface when running

### DeploymentStatus Component

```tsx
interface DeploymentStatusProps {
  deployment: Deployment | null;
  onDeploy: () => void;
  onStop: () => void;
  onChat: () => void;
}

function DeploymentStatus({ deployment, onDeploy, onStop, onChat }: DeploymentStatusProps) {
  if (!deployment) {
    return <Button onClick={onDeploy}>Deploy</Button>;
  }

  return (
    <div className="flex items-center gap-2">
      <StatusBadge status={deployment.status} />
      {deployment.status === "running" && (
        <>
          <Button variant="outline" onClick={onChat}>Chat</Button>
          <Button variant="destructive" onClick={onStop}>Stop</Button>
        </>
      )}
    </div>
  );
}
```

### AgentChat Component

Slide-out panel or modal with:
- Message input at bottom
- Scrollable message history
- User messages right-aligned (blue background)
- Agent responses left-aligned (gray background)
- Streaming indicator during response
- WebSocket connection for real-time updates
- "New conversation" button to reset

```tsx
interface AgentChatProps {
  deploymentId: string;
  isOpen: boolean;
  onClose: () => void;
}

function AgentChat({ deploymentId, isOpen, onClose }: AgentChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const ws = useWebSocket(`/api/deployments/${deploymentId}/ws`);

  // ... WebSocket handling and message rendering
}
```

---

## Implementation Tasks

1. **Database Migration** - Add `agent_deployments` table
2. **Docker Service** - Implement container management
3. **Config Builder** - Compile agent configs from components
4. **Deployment Service** - Orchestrate deploy flow
5. **Deployments Router** - API endpoints
6. **Agent Runtime** - Dockerfile, server.py, agent.py templates
7. **Frontend Service** - Deployment API client
8. **DeploymentStatus** - Status display component
9. **AgentChat** - Chat interface with WebSocket
10. **Integration** - Wire up to Agent Detail page

---

## Environment Requirements

- Docker daemon running on host
- `ANTHROPIC_API_KEY` in backend environment
- Docker socket accessible to backend (volume mount in docker-compose)

### docker-compose.yml addition

```yaml
services:
  backend:
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
```

---

*Design approved: 2026-01-25*
