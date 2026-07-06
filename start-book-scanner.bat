@echo off
echo Starting Inkbase...

REM Start backend
start "Inkbase Backend" cmd /k ^
  "cd /d C:\Users\leesa\OneDrive - Marque Group Solutions\Personal\Inkbase\backend && npm start"

REM Small delay to avoid race conditions
timeout /t 2 >nul

REM Start frontend
start "Inkbase Frontend" cmd /k ^
  "cd /d C:\Users\leesa\OneDrive - Marque Group Solutions\Personal\Inkbase\frontend && npx serve . -1 8000"

echo All services started.
