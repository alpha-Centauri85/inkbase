@echo off
echo Starting Book Scanner App...

REM Start backend
start "BookScanner Backend" cmd /k ^
  "cd /d C:\Users\leesa\OneDrive - Marque Group Solutions\Personal\BookScannerApp\backend && npm start"

REM Small delay to avoid race conditions
timeout /t 2 >nul

REM Start frontend
start "BookScanner Frontend" cmd /k ^
  "cd /d C:\Users\leesa\OneDrive - Marque Group Solutions\Personal\BookScannerApp\frontend && npx serve . -1 8000"

echo All services started.
