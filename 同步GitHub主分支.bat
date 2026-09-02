@echo off
setlocal
cd /d "%~dp0"

echo Checking local changes...
for /f "delims=" %%A in ('git status --porcelain') do (
  echo Local changes detected. Commit or stash them before syncing main.
  exit /b 1
)

echo Switching to main...
git switch main || exit /b 1
echo Pulling latest code from origin/main...
git pull --ff-only origin main || exit /b 1

echo Installing frontend dependencies...
call npm.cmd install || exit /b 1
if exist "backend\package.json" (
  echo Installing backend dependencies...
  pushd backend
  call npm.cmd install || (popd & exit /b 1)
  popd
)

echo Sync complete. You can start development now.
endlocal
