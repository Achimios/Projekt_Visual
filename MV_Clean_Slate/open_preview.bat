@echo off
rem Clean Slate preview: start the local server (port 5430) and open the page in the browser.
rem Pages under _web load audio.json / words.json / images with fetch() and ES modules;
rem browsers block those for file:// pages, so they need http://localhost.
rem Usage: double-click (opens open_v2.html), or: open_preview.bat full_main.html
set PAGE=%1
if "%PAGE%"=="" set PAGE=open_v2.html
netstat -ano | findstr ":5430 " | findstr LISTENING >nul
if errorlevel 1 (
  start "CleanSlate server 5430" /min python -X utf8 "%~dp0_web\serve.py" --port 5430
  timeout /t 2 /nobreak >nul
)
start "" "http://localhost:5430/_web/%PAGE%"
