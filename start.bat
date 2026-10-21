@echo off
rem Starts Research Board and opens it in your browser once it's ready.
rem Your data is kept in the data folder next to this file. Close this window (or Ctrl + C) to stop it.
cd /d "%~dp0"
rem Node 22.13 or newer: the one on PATH if it's new enough (nvm may hold an older one), else the installed one
set "NODE=node"
node -e "const [a, b] = process.versions.node.split('.').map(Number); process.exit(a > 22 || (a === 22 && b >= 13) ? 0 : 1)" 2>nul || if exist "%ProgramFiles%\nodejs\node.exe" set "NODE=%ProgramFiles%\nodejs\node.exe"
"%NODE%" server\server.js --open
if errorlevel 1 pause
