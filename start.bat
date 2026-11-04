@echo off
rem Starts Research Board and opens it in your browser once it's ready.
rem Your data is kept in the data folder next to this file. Close this window (or Ctrl + C) to stop it.
cd /d "%~dp0"
rem Bun: the one on PATH, else where Bun's installer puts it
set "BUN=bun"
where bun >nul 2>nul || set "BUN=%USERPROFILE%\.bun\bin\bun.exe"
if not "%BUN%"=="bun" if not exist "%BUN%" (
    echo Research Board needs Bun: https://bun.sh  ^(in PowerShell: irm bun.sh/install.ps1 ^| iex^)
    pause
    exit /b 1
)
"%BUN%" apps\server\server.js --open
if errorlevel 1 pause
