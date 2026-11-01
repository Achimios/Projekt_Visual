@echo off
rem Stop the Clean Slate player server (only the process listening on PORT).
setlocal
set PORT=5440
set FOUND=

for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%PORT% " ^| findstr LISTENING') do (
  echo   killing PID %%p
  taskkill /PID %%p /F >nul 2>&1
  set FOUND=1
)

if defined FOUND (
  echo   stopped.
) else (
  echo   nothing listening on port %PORT%
)
timeout /t 2 /nobreak >nul
endlocal
