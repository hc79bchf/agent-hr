#!/usr/bin/env bash
# Railway deployment script for Agent-HR
# Usage: ./scripts/railway-deploy.sh [backend|frontend|all]
#
# Project: terrific-healing (cb24c644-b9e5-405a-ad01-ab39de8789b1)
# Environment: dev (1aa325ca-8aa9-444e-b2af-36eb207b7e74)
#
# Services:
#   backend  -> backend-dev-6f9c.up.railway.app  (root: backend/)
#   frontend -> frontend-dev-ede3.up.railway.app  (root: frontend/)
#   postgres -> managed by Railway

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-all}"

deploy_backend() {
  echo "==> Deploying backend..."
  cd "$REPO_ROOT/backend"
  railway service backend
  railway up --detach
  echo ""
}

deploy_frontend() {
  echo "==> Deploying frontend..."
  cd "$REPO_ROOT/frontend"
  railway service frontend
  railway up --detach
  echo ""
}

case "$TARGET" in
  backend)
    deploy_backend
    ;;
  frontend)
    deploy_frontend
    ;;
  all)
    deploy_backend
    deploy_frontend
    ;;
  *)
    echo "Usage: $0 [backend|frontend|all]"
    exit 1
    ;;
esac

echo "==> Deployments triggered!"
echo "    Backend:  https://backend-dev-6f9c.up.railway.app"
echo "    Frontend: https://frontend-dev-ede3.up.railway.app"
echo "    Dashboard: https://railway.com/project/cb24c644-b9e5-405a-ad01-ab39de8789b1"
