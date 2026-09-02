@echo off
setlocal
echo [WARNING] This will replace cloud data with local data.
choice /C YN /N /M "Continue? [Y/N] "
if errorlevel 2 exit /b 0
call "%~sdp0aliyun-deploy-core.bat" FULL
set "RESULT=%ERRORLEVEL%"
if "%RESULT%"=="0" (
  echo.
  echo [OK] 阿里云全量部署完成。
) else (
  echo.
  echo [ERROR] 阿里云全量部署失败，错误码：%RESULT%
)
pause
exit /b %RESULT%
