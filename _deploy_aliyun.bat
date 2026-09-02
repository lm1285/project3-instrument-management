@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM Usage: _deploy_aliyun.bat CODE ^| FULL
REM CODE keeps the current production backend/data directory.
REM FULL replaces production backend/data with the local backend/data directory.

set "DEPLOY_MODE=%~1"
if /I not "%DEPLOY_MODE%"=="CODE" if /I not "%DEPLOY_MODE%"=="FULL" (
    echo [ERROR] Deployment mode must be CODE or FULL.
    exit /b 1
)

REM ==================== SERVER CONFIG ====================
set "SERVER_IP=121.40.33.80"
set "SERVER_USER=root"
set "SERVER_PORT=22"
REM Per-computer settings can be placed in _deploy_aliyun.local.bat (ignored by Git).
REM The file may define SSH_KEY_PATH, SERVER_IP, SERVER_USER, or SERVER_PORT.
if exist "%~dp0_deploy_aliyun.local.bat" call "%~dp0_deploy_aliyun.local.bat"
REM SSH_KEY_PATH can also be supplied by the caller. Otherwise use the current user profile.
if not defined SSH_KEY_PATH set "SSH_KEY_PATH=%USERPROFILE%\.ssh\instrument_management_aliyun"
REM Fallback for the key downloaded on this computer.
if not exist "%SSH_KEY_PATH%" if exist "D:\Edge下载\SSH (1).pem" set "SSH_KEY_PATH=D:\Edge下载\SSH (1).pem"
set "DEPLOY_DIR=/opt/instrument-management"
set "PROJECT_NAME=project3-instrument-management"
set "NGINX_WEB_ROOT=/var/www/wzglpt"
set "REMOTE_ARCHIVE=/tmp/project3_deploy_bundle.tar"
set "SOURCE_DIR=%~dp0."
REM Use a registry reachable from the ECS host. Override by setting this before running the script.
if not defined NPM_REGISTRY set "NPM_REGISTRY=https://registry.npmmirror.com"
set "NPM_FLAGS=--registry=%NPM_REGISTRY% --no-audit --fund=false --fetch-timeout=120000 --fetch-retries=2 --fetch-retry-factor=2 --fetch-retry-mintimeout=1000 --fetch-retry-maxtimeout=10000"
REM =======================================================

set "SSH_CMD="
set "SCP_CMD="
set "TAR_CMD="

if not exist "!SSH_KEY_PATH!" (
    echo [ERROR] SSH key file not found: !SSH_KEY_PATH!
    echo         Create _deploy_aliyun.local.bat beside this script with:
    echo         set "SSH_KEY_PATH=C:\path\to\your\aliyun_private_key"
    echo         Or put the key at: %USERPROFILE%\.ssh\instrument_management_aliyun
    pause
    exit /b 1
)
echo [INFO] Using SSH key: !SSH_KEY_PATH!

if exist "C:\Windows\System32\OpenSSH\ssh.exe" (set "SSH_CMD=C:\Windows\System32\OpenSSH\ssh.exe") else if exist "C:\Program Files\Git\usr\bin\ssh.exe" (set "SSH_CMD=C:\Program Files\Git\usr\bin\ssh.exe")
if exist "C:\Windows\System32\OpenSSH\scp.exe" (set "SCP_CMD=C:\Windows\System32\OpenSSH\scp.exe") else if exist "C:\Program Files\Git\usr\bin\scp.exe" (set "SCP_CMD=C:\Program Files\Git\usr\bin\scp.exe")
if exist "C:\Windows\System32\tar.exe" (set "TAR_CMD=C:\Windows\System32\tar.exe") else if exist "C:\Program Files\Git\usr\bin\tar.exe" (set "TAR_CMD=C:\Program Files\Git\usr\bin\tar.exe")

if not defined SSH_CMD for %%I in (ssh.exe ssh) do if not defined SSH_CMD where %%I >nul 2>&1 && set "SSH_CMD=%%I"
if not defined SCP_CMD for %%I in (scp.exe scp) do if not defined SCP_CMD where %%I >nul 2>&1 && set "SCP_CMD=%%I"
if not defined TAR_CMD for %%I in (tar.exe tar) do if not defined TAR_CMD where %%I >nul 2>&1 && set "TAR_CMD=%%I"

if not defined SSH_CMD goto :tool_error
if not defined SCP_CMD goto :tool_error
if not defined TAR_CMD goto :tool_error

for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "DEPLOY_STAMP=%%I"
set "LOCAL_ARCHIVE=%TEMP%\%PROJECT_NAME%_%DEPLOY_STAMP%.tar"
set "REMOTE_APP=%DEPLOY_DIR%/%PROJECT_NAME%"
set "REMOTE_BACKUP=%DEPLOY_DIR%/backups/%PROJECT_NAME%/%DEPLOY_STAMP%"

echo ========================================
if /I "%DEPLOY_MODE%"=="CODE" (echo   Deploy code only - preserve cloud data) else (echo   Full deploy - replace cloud data with local data)
echo ========================================

echo [1/7] Check SSH connection...
"%SSH_CMD%" -o StrictHostKeyChecking=no -i "!SSH_KEY_PATH!" -p %SERVER_PORT% %SERVER_USER%@%SERVER_IP% "echo SSH connected" >nul
if errorlevel 1 goto :ssh_error

echo [2/7] Build upload archive...
set "TAR_EXCLUDES=--exclude=.git --exclude=node_modules --exclude=backend/node_modules --exclude=dist --exclude=backend/dist --exclude=backend/logs --exclude=.trae --exclude=.vercel --exclude=*.log"
if /I "%DEPLOY_MODE%"=="CODE" set "TAR_EXCLUDES=%TAR_EXCLUDES% --exclude=backend/data"
"%TAR_CMD%" -cf "%LOCAL_ARCHIVE%" %TAR_EXCLUDES% -C "%SOURCE_DIR%" .
if errorlevel 1 goto :archive_error

echo [3/7] Upload archive...
"%SCP_CMD%" -o StrictHostKeyChecking=no -i "!SSH_KEY_PATH!" -P %SERVER_PORT% "%LOCAL_ARCHIVE%" %SERVER_USER%@%SERVER_IP%:%REMOTE_ARCHIVE%
if errorlevel 1 goto :upload_error
del /q "%LOCAL_ARCHIVE%" >nul 2>&1

echo [4/7] Back up cloud data and install files...
if /I "%DEPLOY_MODE%"=="CODE" (
    "%SSH_CMD%" -o StrictHostKeyChecking=no -i "!SSH_KEY_PATH!" -p %SERVER_PORT% %SERVER_USER%@%SERVER_IP% "set -e; mkdir -p '%REMOTE_BACKUP%'; if [ -d '%REMOTE_APP%/backend/data' ]; then cp -a '%REMOTE_APP%/backend/data' '%REMOTE_BACKUP%/data'; fi; rm -rf '%REMOTE_APP%'; mkdir -p '%REMOTE_APP%'; tar -xf '%REMOTE_ARCHIVE%' -C '%REMOTE_APP%'; rm -f '%REMOTE_ARCHIVE%'; if [ -d '%REMOTE_BACKUP%/data' ]; then mkdir -p '%REMOTE_APP%/backend'; cp -a '%REMOTE_BACKUP%/data' '%REMOTE_APP%/backend/data'; else mkdir -p '%REMOTE_APP%/backend/data'; fi"
) else (
    "%SSH_CMD%" -o StrictHostKeyChecking=no -i "!SSH_KEY_PATH!" -p %SERVER_PORT% %SERVER_USER%@%SERVER_IP% "set -e; mkdir -p '%REMOTE_BACKUP%'; if [ -d '%REMOTE_APP%/backend/data' ]; then cp -a '%REMOTE_APP%/backend/data' '%REMOTE_BACKUP%/data'; fi; rm -rf '%REMOTE_APP%'; mkdir -p '%REMOTE_APP%'; tar -xf '%REMOTE_ARCHIVE%' -C '%REMOTE_APP%'; rm -f '%REMOTE_ARCHIVE%'; mkdir -p '%REMOTE_APP%/backend/data'"
)
if errorlevel 1 goto :remote_error

echo [5/7] Install dependencies and build...
"%SSH_CMD%" -o StrictHostKeyChecking=no -i "!SSH_KEY_PATH!" -p %SERVER_PORT% %SERVER_USER%@%SERVER_IP% "set -e; cd '%REMOTE_APP%'; if [ -f package-lock.json ]; then npm ci --legacy-peer-deps %NPM_FLAGS%; else npm install --legacy-peer-deps %NPM_FLAGS%; fi; npm run build:prod; cd backend; if [ -f package-lock.json ]; then npm ci --legacy-peer-deps %NPM_FLAGS%; else npm install --legacy-peer-deps %NPM_FLAGS%; fi; npm run build"
if errorlevel 1 goto :build_error

echo [6/7] Restart backend and publish frontend...
"%SSH_CMD%" -o StrictHostKeyChecking=no -i "!SSH_KEY_PATH!" -p %SERVER_PORT% %SERVER_USER%@%SERVER_IP% "set -e; cd '%REMOTE_APP%/backend'; mkdir -p data logs; chmod -R 775 data; command -v pm2 >/dev/null 2^>^&1 || npm install -g pm2; pm2 startOrReload ecosystem.config.js --only instrument-backend --env production; pm2 save; mkdir -p '%NGINX_WEB_ROOT%'; find '%NGINX_WEB_ROOT%' -mindepth 1 -delete; cp -r '%REMOTE_APP%/dist/'* '%NGINX_WEB_ROOT%'/; chmod -R 755 '%NGINX_WEB_ROOT%'; systemctl reload nginx"
if errorlevel 1 goto :restart_error

echo [7/7] Verify service...
"%SSH_CMD%" -o StrictHostKeyChecking=no -i "!SSH_KEY_PATH!" -p %SERVER_PORT% %SERVER_USER%@%SERVER_IP% "pm2 status instrument-backend; curl -fsS http://127.0.0.1:3002/health"
if errorlevel 1 goto :verify_error

echo.
echo Deployment completed successfully.
echo Cloud data backup: %REMOTE_BACKUP%/data
echo Frontend: http://%SERVER_IP%
exit /b 0

:tool_error
echo [ERROR] ssh, scp, or tar command not found. Install OpenSSH Client.
goto :failed
:ssh_error
echo [ERROR] SSH connection failed.
goto :failed
:archive_error
echo [ERROR] Failed to create local archive.
goto :failed
:upload_error
echo [ERROR] Archive upload failed.
goto :failed
:remote_error
echo [ERROR] Failed while replacing remote project files.
goto :failed
:build_error
echo [ERROR] Dependency installation or build failed.
goto :failed
:restart_error
echo [ERROR] Backend restart or frontend publish failed.
goto :failed
:verify_error
echo [ERROR] Health check failed. Review PM2 logs on the server.
:failed
if exist "%LOCAL_ARCHIVE%" del /q "%LOCAL_ARCHIVE%" >nul 2>&1
pause
exit /b 1
