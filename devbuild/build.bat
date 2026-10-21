@echo off
rem Double-click for a menu of Research Board's builds, or: devbuild\build.bat apk | exe | host | all | ...
rem (the work is done by build.ps1, next to this file)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build.ps1" %*
if errorlevel 1 pause
if "%~1"=="" pause
