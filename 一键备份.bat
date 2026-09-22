@echo off
chcp 65001 >nul
REM === Webapp Snapshot Backup ===
REM Pure ASCII wrapper. Double-click BEFORE any risky change.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0backup.ps1"
