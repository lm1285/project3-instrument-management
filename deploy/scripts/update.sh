#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/wzglpt/app}"
WEB_DIR="${WEB_DIR:-/var/www/wzglpt}"
BACKEND_SERVICE="${BACKEND_SERVICE:-wzglpt-backend}"

cd "$APP_DIR"

echo "[1/6] Pull latest code"
git pull --rebase

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

