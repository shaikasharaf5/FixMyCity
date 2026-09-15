@echo off
title CiviTrack AI Launcher
echo ===================================================
echo             CiviTrack AI DEV LAUNCHER             
echo ===================================================
echo.
echo [1/2] Starting FastAPI Backend on http://localhost:8001 ...
start "CiviTrack Backend" cmd /k "cd backend && python run.py"

echo [2/2] Starting Vite Frontend on http://localhost:5173 ...
start "CiviTrack Frontend" cmd /k "cd frontend && npm run dev"
echo.
echo ===================================================
echo Both services are spinning up in separate windows.
echo - Access API docs: http://localhost:8001/docs
echo - Open User App:  http://localhost:5173
echo ===================================================
pause
