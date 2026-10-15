@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build\entrypoint.ps1" %*
exit /b %errorlevel%
