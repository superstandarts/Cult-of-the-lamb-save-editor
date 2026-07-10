@echo off
title Cotl Save Editor by Rage
color 0D
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found.
  echo Install Node.js LTS from https://nodejs.org and try again.
  pause
  exit /b 1
)
if not exist "node_modules\express" (
  echo [RAGE] Installing the local editor dependencies...
  call npm install
  if errorlevel 1 (
    echo [ERROR] Dependency installation failed.
    pause
    exit /b 1
  )
)
echo [RAGE] Starting Cotl Save Editor...
node server.js
if errorlevel 1 pause
