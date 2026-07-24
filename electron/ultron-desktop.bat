@echo off
title ULTRON
echo Starting ULTRON...
start "" /B "%~dp0dist\ultron.exe" --web --port 3456
timeout /t 3 /nobreak >nul
start msedge --app=http://127.0.0.1:3456 --new-window --window-size=1200,800
echo ULTRON is running. Close this window to stop the server.
pause >nul
taskkill /F /IM ultron.exe >nul 2>&1
