@echo off
REM Legacy entry point: use the safe code-only deployment.
call "%~dp0_deploy_aliyun.bat" CODE
exit /b %errorlevel%
