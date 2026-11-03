@echo off
title POD Register Launcher
cd /d "%~dp0"

echo Starting database...
docker compose up -d

echo Starting backend...
start "POD Backend" cmd /k "cd /d %~dp0backend && mvn spring-boot:run"

echo Starting frontend...
start "POD Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo Waiting for backend...
set /a tries=0
:waitbackend
set /a tries+=1
if %tries% GTR 30 goto openchrome
curl -s -o nul http://localhost:8080/api/entries
if errorlevel 1 (
  timeout /t 2 /nobreak >nul
  goto waitbackend
)

:openchrome
start chrome http://localhost:5173