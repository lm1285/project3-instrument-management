@echo off
setlocal
cd /d "%~dp0"

where git >nul 2>&1
if errorlevel 1 set "PATH=C:\Program Files\Microsoft Visual Studio\2022\Community\Common7\IDE\CommonExtensions\Microsoft\TeamFoundation\Team Explorer\Git\cmd;%PATH%"
where git >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Git was not found. Please install Git for Windows.
  pause
  exit /b 1
)

echo [1/4] Checking branch...
for /f "delims=" %%B in ('git branch --show-current') do set "CURRENT_BRANCH=%%B"
if /I not "%CURRENT_BRANCH%"=="main" (
  echo [ERROR] Current branch is "%CURRENT_BRANCH%". Please use main.
  pause
  exit /b 1
)

echo [2/4] Staging source code...
git add -A -- . >nul 2>&1
rem Git may return a warning status when ignored directories are present.
rem The staged diff below is the authoritative success check.
if errorlevel 1 echo Ignored local directories were skipped.
git reset -- .env .env.* backend/.env backend/data backend/backups backend/instrument_management.db >nul 2>&1
git reset -- '*.db' '*.sqlite' >nul 2>&1

git diff --cached --quiet
if not errorlevel 1 (
  echo No source changes to upload.
  pause
  exit /b 0
)

echo [3/4] Creating commit...
git commit -m "chore: sync local development code"
if errorlevel 1 goto :failed

echo [4/4] Pushing to GitHub main...
git push origin main
if errorlevel 1 goto :failed

echo.
echo [OK] Code uploaded to GitHub main.
pause
exit /b 0

:failed
echo.
echo [ERROR] Upload failed. No local files were deleted.
pause
exit /b 1
