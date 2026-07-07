@echo off
echo Starting Inkbase...

REM Start backend
start "Inkbase Backend" cmd /k ^
  "cd /d C:\Users\leesa\OneDrive - Marque Group Solutions\Personal\Inkbase\backend && npm start"

REM Small delay to avoid race conditions
timeout /t 2 >nul

REM Build and serve the frontend production bundle
start "Inkbase Frontend" cmd /k ^
  "cd /d C:\Users\leesa\OneDrive - Marque Group Solutions\Personal\Inkbase\frontend && npm run build && npx serve dist -l 8000"

echo All services started.
