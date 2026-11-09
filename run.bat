@echo off
rem The one launcher. Double-click it for a menu (it comes back after each task), or:  run.bat <task>   (run.bat help lists them)
rem   run.bat open            the app here, in your browser
rem   run.bat host            a server for other devices (--public, --start, --autostart, --no-autostart)
rem   run.bat build phone     ... build desktop, build server, build all, release, status, test
rem It finds Bun (installing it the first time) and hands over to apps\kit\kit.js, which reads apps\project.json.
setlocal
cd /d "%~dp0"

rem Bun: the one on PATH, else where Bun's installer puts it, else installed now (https://bun.sh)
set "BUN=bun"
where bun >nul 2>nul || set "BUN=%USERPROFILE%\.bun\bin\bun.exe"
if not "%BUN%"=="bun" if not exist "%BUN%" (
    echo Installing Bun, which runs this ^(https://bun.sh^)...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "irm bun.sh/install.ps1 | iex"
)
if not "%BUN%"=="bun" if not exist "%BUN%" (
    echo Couldn't install Bun. Install it from https://bun.sh and run this again.
    pause
    exit /b 1
)

"%BUN%" apps\kit\kit.js %*
set "CODE=%errorlevel%"
rem (stopped with an error: keep the window open to read it)
if not "%CODE%"=="0" pause
exit /b %CODE%
