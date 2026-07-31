@echo off
cd /d "%~dp0"
title DatingRoute Local Server

echo ========================================================
echo [1/3] Cleaning up orphaned server processes and RAM...
echo ========================================================
taskkill /F /IM node.exe 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do (
    if "%%a" NEQ "0" taskkill /F /PID %%a 2>nul
)

set NODE_OPTIONS=--dns-result-order=ipv4first

echo ========================================================
echo [2/3] Next.js Dev Server Starting (IPv4 Fast DNS)...
echo [3/3] Web Browser will open at http://localhost:3000
echo ========================================================

start "" /b cmd /c "ping 127.0.0.1 -n 3 >nul && start http://localhost:3000"

call npm.cmd run dev
