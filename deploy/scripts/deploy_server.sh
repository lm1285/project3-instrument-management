#!/bin/bash

# 参数
SERVER_DIR="/opt/instrument-management"
TEMP_BACKUP='/root/wzglpt_data_temp'

echo '=== 1. Data Backup (External) ==='
# rm -rf $TEMP_BACKUP # 暂时禁用清理，确保数据安全
mkdir -p $TEMP_BACKUP

# Backup existing data directory
if [ -d "${SERVER_DIR}/backend/data" ]; then
    echo 'Backing up data directory to temp...'
    cp -r ${SERVER_DIR}/backend/data/* $TEMP_BACKUP/ 2>/dev/null || true
fi

# Migration: Check for root DB and backup if exists
if [ -f "${SERVER_DIR}/backend/instrument_management.db" ]; then
    echo 'Found legacy DB in root, backing up...'
    cp ${SERVER_DIR}/backend/instrument_management.db $TEMP_BACKUP/
fi

# Backup current SQLite DB if exists (Safety backup)
if [ -f "${SERVER_DIR}/backend/database.sqlite" ]; then
    echo 'Backing up current SQLite DB (safety copy)...'
    # Backup as .bak so it doesn't get auto-restored to data/ by the generic restore script
    cp ${SERVER_DIR}/backend/database.sqlite $TEMP_BACKUP/database.sqlite.bak
fi

# Migration: Check for root backups
if [ -d "${SERVER_DIR}/backend/backups" ]; then
    echo 'Found legacy backups in root, backing up...'
    mkdir -p $TEMP_BACKUP/backups
    cp -r ${SERVER_DIR}/backend/backups/* $TEMP_BACKUP/backups/ 2>/dev/null || true
fi

echo '=== 2. Clean & Deploy ==='
# Remove existing directory to ensure clean slate (safe now that we have external backup)
rm -rf ${SERVER_DIR}
mkdir -p ${SERVER_DIR}

# Install unzip if missing
if ! command -v unzip &> /dev/null; then
    yum install -y unzip
fi

echo 'Unzipping new version...'
unzip -o /root/instrument-management.zip -d ${SERVER_DIR} > /dev/null

echo 'Verifying Database File...'
if [ -f "${SERVER_DIR}/backend/data/database.sqlite" ]; then
    ls -l ${SERVER_DIR}/backend/data/database.sqlite
    chmod 666 ${SERVER_DIR}/backend/data/database.sqlite
    echo 'Canonical database file exists and permissions set.'
else
    echo 'WARNING: backend/data/database.sqlite NOT FOUND after unzip!'
fi

echo '=== 3. Data Restoration ==='
# Restore data from temp backup
if [ -d "$TEMP_BACKUP" ]; then
    if [ -n "$(ls -A $TEMP_BACKUP 2>/dev/null)" ]; then
        echo 'Restoring data from backup...'
        mkdir -p ${SERVER_DIR}/backend/data
        cp -rf $TEMP_BACKUP/* ${SERVER_DIR}/backend/data/
    else
        echo 'Temp backup directory exists but is empty.'
        echo 'No existing data found. Using default/empty data.'
    fi
else
    echo 'No existing data found (no temp backup). Using default/empty data.'
fi

# Clean temp backup (Commented out for safety debug)
# rm -rf $TEMP_BACKUP

echo '=== 4. Permissions Fix ==='
# Ensure database directory is writable
mkdir -p ${SERVER_DIR}/backend/data
chmod -R 777 ${SERVER_DIR}/backend/data
# Fix for potential SELinux issues
chcon -R -t httpd_sys_rw_content_t ${SERVER_DIR}/backend/data 2>/dev/null || true

echo '=== 5. Dependencies ==='
cd ${SERVER_DIR}/backend
npm install --production

echo '=== 6. Service Restart ==='
# Check if pm2 is installed
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi

# Start or Reload backend
# Clear old logs to avoid confusion
pm2 flush instrument-backend 2>/dev/null || true

# Force restart to ensure new code is loaded (avoid reload caching issues)
pm2 delete instrument-backend 2>/dev/null || true
echo 'Starting new service...'
pm2 start ecosystem.config.js --env production

echo '=== 7. Nginx & Finalize ==='
# Fix permissions for Nginx
mkdir -p /var/www/wzglpt
cp -r ${SERVER_DIR}/dist/* /var/www/wzglpt/
chmod -R 755 /var/www/wzglpt
chown -R nginx:nginx /var/www/wzglpt

# Fix SELinux
setsebool -P httpd_can_network_connect 1 2>/dev/null || true
setsebool -P httpd_read_user_content 1 2>/dev/null || true

# Reload Nginx
systemctl reload nginx

echo '=== DEPLOYMENT SUCCESS! ==='
