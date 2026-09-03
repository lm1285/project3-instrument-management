@echo off
setlocal EnableDelayedExpansion
cd /d "%~sdp0"
if exist "%USERPROFILE%\Tools\node-v20.19.5-win-x64\npm.cmd" set "PATH=%USERPROFILE%\Tools\node-v20.19.5-win-x64;%PATH%"
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

if not exist "node_modules\.bin\vite.cmd" (
    echo [INFO] Installing frontend dependencies...
    call "%NPM_CMD%" install
    if errorlevel 1 (
        echo [ERROR] Frontend dependency install failed.
        pause
        exit /b 1
    )
)

if not exist "backend\node_modules\.bin\ts-node-dev.cmd" (
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
start "Frontend" powershell -NoExit -NoProfile -ExecutionPolicy Bypass -Command "& '%NPM_CMD%' run dev --prefix '%~sdp0'"
if errorlevel 1 (
    echo [ERROR] Frontend failed to start.
    pause
    exit /b 1
)

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":3003 .*LISTENING"') do set "BACKEND_PID=%%P"
if defined BACKEND_PID (
    echo [INFO] Backend port 3003 is already in use by PID !BACKEND_PID!. Reusing the existing backend process.
) else (
    start "Backend" powershell -NoExit -NoProfile -ExecutionPolicy Bypass -Command "$env:PORT='3003'; $env:NODE_ENV='development'; & '%NPM_CMD%' run dev --prefix '%~sdp0backend'"
    if errorlevel 1 (
        echo [ERROR] Backend failed to start.
        pause
        exit /b 1
    )
)

echo [OK] Frontend: http://localhost:5173
echo [OK] Backend:  http://localhost:3003
exit /b 0
