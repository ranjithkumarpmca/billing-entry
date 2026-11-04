@echo off
title Billing Entry - Build and Run
set ROOT=%~dp0

echo [1/4] Building frontend...
cd /d "%ROOT%frontend"
call npm run build
if errorlevel 1 goto fail

echo [2/4] Copying frontend into backend...
if exist "%ROOT%backend\src\main\resources\static" rmdir /s /q "%ROOT%backend\src\main\resources\static"
mkdir "%ROOT%backend\src\main\resources\static"
xcopy /e /i /y "%ROOT%frontend\dist" "%ROOT%backend\src\main\resources\static" >nul
if errorlevel 1 goto fail

echo [3/4] Building JAR...
cd /d "%ROOT%backend"
call mvn clean package -DskipTests
if errorlevel 1 goto fail

echo [4/4] Starting app...
cd /d "%ROOT%"
call start-billing.bat
exit /b 0

:fail
echo.
echo BUILD FAILED. Read the error above.
pause
exit /b 1