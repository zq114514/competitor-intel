@echo off
chcp 65001 >nul
REM === Sync webapp + docs to GITHUB (zq114514/competitor-intel, main) ===
REM Creates new files or updates existing ones. Token is entered at runtime, never saved.
echo ============================================
echo  Sync to GITHUB
echo ============================================
echo.
echo GitHub token (paste, then Enter). Get one at:
echo   https://github.com/settings/tokens/new  (check "repo")
echo.
set /p HT=Token: 
if "%HT%"=="" (
  echo [!] No token, abort.
  pause
  exit /b 1
)
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync-cloud.ps1" -Platform github -TokenGithub "%HT%"
