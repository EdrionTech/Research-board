@echo off
rem Double-click for a menu of Research Board's builds, or: build.bat apk | exe | host | all | status | test | ...
rem (the work is done by apps\build.ps1)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0apps\build.ps1" %*
if errorlevel 1 pause
if "%~1"=="" pause
