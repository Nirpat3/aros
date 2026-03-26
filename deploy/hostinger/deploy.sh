#!/usr/bin/env bash
# AROS Platform — Hostinger VPS Deployment
# Usage: ./deploy.sh [environment]
# Prereqs: Node 20+, pnpm, pm2, nginx

set -euo pipefail

ENV="${1:-production}"
APP_DIR="/opt/aros-platform"
REPO_URL="git@github.com:Nirlabinc/aros-platform.git"
BRANCH="main"

echo "=== AROS Deploy ($ENV) ==="

# Pull latest
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR"
  git fetch origin
  git reset --hard "origin/$BRANCH"
else
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

# Install + build
pnpm install --frozen-lockfile
pnpm build

# Copy env
if [ ! -f .env ]; then
  echo "ERROR: .env file missing. Copy from .env.example and configure."
  exit 1
fi

# Ensure log directory exists
mkdir -p /var/log/aros

# Restart with PM2
pm2 startOrRestart deploy/hostinger/ecosystem.config.cjs --env "$ENV"
pm2 save

echo "=== Deploy complete ==="
echo "Health: curl http://localhost:5457/health"
