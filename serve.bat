@echo off
rem Research Board as a server for other devices (a lab server, or your phone and laptop syncing with it).
rem Double-click it: a menu to set how it's reached (this network, or any network for testing), the port, the data
rem folder, starting with Windows and the access key, then start it. Installs Bun first if it's missing.
rem
rem   serve.bat                  the menu
rem   serve.bat --start          start with the saved settings (no menu)
rem   serve.bat --public         start once from any network (a temporary https address)
rem   serve.bat --autostart      start with Windows (at sign-in)        serve.bat --no-autostart   stop that
rem
rem The menu is apps\server\serve.js; the settings are kept in serve.json here.
setlocal
cd /d "%~dp0"

rem Bun: the one on PATH, else where Bun's installer puts it, else installed now (https://bun.sh)
set "BUN=bun"
where bun >nul 2>nul || set "BUN=%USERPROFILE%\.bun\bin\bun.exe"
if not "%BUN%"=="bun" if not exist "%BUN%" (
    echo Installing Bun, which runs the server ^(https://bun.sh^)...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "irm bun.sh/install.ps1 | iex"
)
if not "%BUN%"=="bun" if not exist "%BUN%" (
    echo Couldn't install Bun. Install it from https://bun.sh and run serve.bat again.
    pause
    exit /b 1
)

"%BUN%" apps\server\serve.js %*
if errorlevel 1 pause
