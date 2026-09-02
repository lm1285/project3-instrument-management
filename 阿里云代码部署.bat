@echo off
setlocal
call "%~dp0aliyun-deploy-core.bat" CODE
set "RESULT=%ERRORLEVEL%"
if "%RESULT%"=="0" (
  echo.
  echo [OK] 阿里云代码部署完成。
) else (
  echo.
  echo [ERROR] 阿里云代码部署失败，错误码：%RESULT%
)
pause
exit /b %RESULT%
