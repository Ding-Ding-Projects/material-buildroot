@echo off
setlocal
rem Let Windows PowerShell initialize its own compatible module directories.
set "PSModulePath="
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build\entrypoint.ps1" %*
exit /b %errorlevel%
