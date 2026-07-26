@echo off
cd /d "%~dp0"
title DatingRoute Local Server

echo ========================================================
echo   DatingRoute Local Server
echo ========================================================
echo   1. Next.js Dev Server Starting...
echo   2. Web Browser will open at http://localhost:3000
echo ========================================================

start "" /b cmd /c "ping 127.0.0.1 -n 4 >nul && start http://localhost:3000"

call npm.cmd run dev
