#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/wzglpt/app}"
WEB_DIR="${WEB_DIR:-/var/www/wzglpt}"
BACKEND_SERVICE="${BACKEND_SERVICE:-wzglpt-backend}"
GIT_REMOTE="${GIT_REMOTE:-origin}"
GIT_BRANCH="${GIT_BRANCH:-main}"

cd "$APP_DIR"

echo "[1/6] Pull latest code"
if [ -n "$(git status --porcelain)" ]; then
  echo "Refusing to update: local changes exist in $APP_DIR. Commit or stash them first."
  exit 1
fi
git fetch "$GIT_REMOTE" "$GIT_BRANCH"
git switch "$GIT_BRANCH"
git pull --ff-only "$GIT_REMOTE" "$GIT_BRANCH"

echo "[2/6] Install frontend deps"
npm ci

echo "[3/6] Build frontend (prod)"
npm run build:prod

echo "[4/6] Sync frontend dist -> web dir"
sudo mkdir -p "$WEB_DIR"
sudo rsync -a --delete "$APP_DIR/dist/" "$WEB_DIR/"

echo "[5/6] Build backend"
cd "$APP_DIR/backend"
npm ci
npm run build

echo "[6/6] Restart backend service"
sudo systemctl restart "$BACKEND_SERVICE"
sudo systemctl --no-pager --full status "$BACKEND_SERVICE" || true
