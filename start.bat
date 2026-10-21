@echo off
rem Starts Research Board and opens it in your browser once it's ready.
rem Your data is kept in the data folder next to this file. Close this window (or Ctrl + C) to stop it.
cd /d "%~dp0"
node server\server.js --open
if errorlevel 1 pause
