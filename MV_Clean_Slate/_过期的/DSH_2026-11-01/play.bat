@echo off
rem Clean Slate player launcher: opens a console panel that stays open.
rem The panel is a remote control (start / stop / restart / open browser).
rem Closing this window stops the server it started.
setlocal
title Clean Slate panel  [close this window = stop server]
cd /d "%~dp0"
chcp 65001 >nul
set PORT=5440

python -X utf8 "_web\panel.py" --port %PORT%

if errorlevel 1 (
  echo.
  echo   Python not found or panel failed. Is python on PATH?
  pause
)
endlocal
