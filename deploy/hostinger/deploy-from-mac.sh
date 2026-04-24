#!/usr/bin/env bash
# AROS Platform — One-command deploy from local Mac → Hostinger VPS
#
# What it does:
#   1. Pushes the local aros-platform main branch to origin (Nirpat3/aros)
#   2. SSHes into the VPS and runs the existing deploy.sh (git pull + pnpm
#      build + pm2 restart), which rebuilds apps/web into /opt/aros-platform/apps/web/dist
#   3. Health-checks both the API (port 5457) and the public SPA
#
# Usage:
#   ./deploy-from-mac.sh              # deploy main
#   ./deploy-from-mac.sh --dry-run    # show what would run, change nothing
#   ./deploy-from-mac.sh --no-push    # skip git push (if already pushed)
#
# Prereqs on Mac:
#   - SSH alias `vps` in ~/.ssh/config pointing at the Hostinger VPS
#   - Clean or committed working tree (script will refuse if dirty)
#   - Network access to GitHub + the VPS

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
BRANCH="${BRANCH:-main}"
SSH_HOST="${SSH_HOST:-vps}"
DRY_RUN=0
NO_PUSH=0

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --no-push) NO_PUSH=1 ;;
    --help|-h)
      grep -E '^#( |$)' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "Unknown arg: $arg" >&2; exit 2 ;;
  esac
done

say() { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
run() {
  if [ "$DRY_RUN" = 1 ]; then
    printf '\033[1;33m[dry-run]\033[0m %s\n' "$*"
  else
    eval "$@"
  fi
}

cd "$REPO_DIR"

# ── 1. Sanity: clean tree, on the expected branch ─────────────────────────
say "Checking local git state"
CUR_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$CUR_BRANCH" != "$BRANCH" ]; then
  echo "ERROR: current branch is '$CUR_BRANCH', expected '$BRANCH'" >&2
  exit 3
fi
if ! git diff --quiet --ignore-submodules; then
  echo "ERROR: working tree has unstaged changes. Commit or stash first." >&2
  git status -s
  exit 3
fi
if ! git diff --cached --quiet --ignore-submodules; then
  echo "ERROR: index has staged changes. Commit first." >&2
  exit 3
fi

LOCAL_HEAD="$(git rev-parse HEAD)"
say "Local HEAD: $LOCAL_HEAD"

# ── 2. Push to origin ──────────────────────────────────────────────────────
if [ "$NO_PUSH" = 0 ]; then
  say "Pushing $BRANCH to origin"
  run "git push origin $BRANCH"
else
  say "Skipping git push (--no-push)"
fi

# ── 3. Trigger deploy on VPS ──────────────────────────────────────────────
say "SSH $SSH_HOST → run deploy.sh"
REMOTE_SCRIPT='/opt/aros-platform/deploy/hostinger/deploy.sh'
if [ "$DRY_RUN" = 1 ]; then
  printf '\033[1;33m[dry-run]\033[0m ssh %s %s production\n' "$SSH_HOST" "$REMOTE_SCRIPT"
else
  ssh -o ConnectTimeout=10 "$SSH_HOST" "bash $REMOTE_SCRIPT production"
fi

# ── 4. Verify ──────────────────────────────────────────────────────────────
say "Verifying deploy"
if [ "$DRY_RUN" = 1 ]; then
  echo "[dry-run] would curl https://aros.nirtek.net/  and  /api/health"
  exit 0
fi

VPS_COMMIT="$(ssh "$SSH_HOST" 'cd /opt/aros-platform && git rev-parse HEAD' 2>/dev/null)"
if [ "$VPS_COMMIT" != "$LOCAL_HEAD" ]; then
  echo "WARNING: VPS commit $VPS_COMMIT does not match local $LOCAL_HEAD" >&2
fi

API_STATUS="$(ssh "$SSH_HOST" 'curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5457/health' 2>/dev/null || echo '000')"
SPA_STATUS="$(curl -s -o /dev/null -w '%{http_code}' https://aros.nirtek.net/ --max-time 15 || echo '000')"

say "API (VPS /health): HTTP $API_STATUS"
say "SPA (aros.nirtek.net): HTTP $SPA_STATUS"

if [ "$API_STATUS" != "200" ] || [ "$SPA_STATUS" != "200" ]; then
  echo "ERROR: health check failed" >&2
  exit 4
fi

say "Deploy OK — VPS @ $VPS_COMMIT"
