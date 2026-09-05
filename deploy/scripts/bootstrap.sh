#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/wzglpt/app}"
WEB_DIR="${WEB_DIR:-/var/www/wzglpt}"

echo "Create base directories"
sudo mkdir -p /opt/wzglpt
sudo mkdir -p /opt/wzglpt/data
sudo mkdir -p /etc/wzglpt
sudo mkdir -p "$WEB_DIR"

echo "Install nginx config"
if [ -d /etc/nginx/sites-available ]; then
  sudo cp "$APP_DIR/deploy/nginx/wzglpt.conf" /etc/nginx/sites-available/wzglpt.conf
  sudo ln -sf /etc/nginx/sites-available/wzglpt.conf /etc/nginx/sites-enabled/wzglpt.conf
else
  sudo cp "$APP_DIR/deploy/nginx/wzglpt.conf" /etc/nginx/conf.d/wzglpt.conf
fi

echo "Install systemd service"
sudo cp "$APP_DIR/deploy/systemd/wzglpt-backend.service" /etc/systemd/system/wzglpt-backend.service
sudo cp "$APP_DIR/deploy/logrotate/wzglpt-nginx" /etc/logrotate.d/wzglpt-nginx
sudo mkdir -p /etc/systemd/journald.conf.d
sudo cp "$APP_DIR/deploy/journald/30-wzglpt-retention.conf" /etc/systemd/journald.conf.d/30-wzglpt-retention.conf
sudo systemctl daemon-reload
sudo systemctl enable wzglpt-backend
sudo systemctl restart systemd-journald

echo "Nginx test & reload"
sudo nginx -t
sudo systemctl reload nginx

echo "Bootstrap done."
