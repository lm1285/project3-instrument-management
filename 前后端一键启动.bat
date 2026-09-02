@echo off
setlocal
cd /d "%~dp0"
cls

set "NPM_CMD="
if exist "D:\New Folder\npm.cmd" set "NPM_CMD=D:\New Folder\npm.cmd"
if not defined NPM_CMD if exist "C:\Program Files\nodejs\npm.cmd" set "NPM_CMD=C:\Program Files\nodejs\npm.cmd"
if not defined NPM_CMD if exist "C:\Program Files (x86)\nodejs\npm.cmd" set "NPM_CMD=C:\Program Files (x86)\nodejs\npm.cmd"

if not exist "package.json" (
    echo [ERROR] package.json not found
    pause
    exit /b 1
)

if not exist "backend\package.json" (
    echo [ERROR] backend\package.json not found
    pause
    exit /b 1
)

if not defined NPM_CMD (
    echo [ERROR] npm.cmd not found. Checked D:\New Folder and common Node.js folders.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [INFO] Installing frontend dependencies...
    call "%NPM_CMD%" install
    if errorlevel 1 (
        echo [ERROR] Frontend dependency install failed.
        pause
        exit /b 1
    )
)

if not exist "backend\node_modules" (
    echo [INFO] Installing backend dependencies...
    pushd "backend"
    call "%NPM_CMD%" install
    if errorlevel 1 (
        echo [ERROR] Backend dependency install failed.
        popd
        pause
        exit /b 1
    )
    popd
)

echo [INFO] Starting frontend and backend...
start "Frontend" powershell -NoExit -NoProfile -ExecutionPolicy Bypass -Command "& '%NPM_CMD%' run dev --prefix '%~dp0'"
if errorlevel 1 (
    echo [ERROR] Frontend failed to start.
    pause
    exit /b 1
)

start "Backend" powershell -NoExit -NoProfile -ExecutionPolicy Bypass -Command "$env:PORT='3003'; $env:NODE_ENV='development'; & '%NPM_CMD%' run dev --prefix '%~dp0backend'"
if errorlevel 1 (
    echo [ERROR] Backend failed to start.
    pause
    exit /b 1
)

echo [OK] Frontend: http://localhost:5173
echo [OK] Backend:  http://localhost:3003
exit /b 0
