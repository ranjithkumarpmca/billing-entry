@echo off
title POD Register Launcher
cd /d "%~dp0"

echo Starting database...
docker compose up -d

echo Starting backend...
start "POD Backend" cmd /k "cd /d %~dp0backend && mvn spring-boot:run"

echo Starting frontend...
start "POD Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo Waiting for servers...
timeout /t 25 /nobreak >nul
start chrome http://localhost:5173