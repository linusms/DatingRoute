@echo off
cd /d "%~dp0"
title DatingRoute Server Shutdown

echo ========================================================
echo [DatingRoute] Shutting down servers and releasing RAM...
echo ========================================================
taskkill /F /IM node.exe 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do (
    if "%%a" NEQ "0" taskkill /F /PID %%a 2>nul
)

echo.
echo ========================================================
echo All DatingRoute local servers have been shut down!
echo All used RAM has been cleanly released.
echo You can safely close this window or it will close in 3s.
echo ========================================================
timeout /t 3 >nul
