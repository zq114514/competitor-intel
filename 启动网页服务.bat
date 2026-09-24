@echo off
chcp 65001 >nul
REM === Competitor Intel Web Server Launcher ===
REM Pure ASCII, GBK-safe. All real work in PowerShell script.
REM This wrapper ONLY calls ps1 - nothing else.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-server.ps1"
