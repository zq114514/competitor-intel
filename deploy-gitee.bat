@echo off
chcp 65001 >nul
REM === Sync webapp + docs to GITEE (tsubakiou/competitor-intel, master) ===
REM Creates new files or updates existing ones. Token is entered at runtime, never saved.
echo ============================================
echo  Sync to GITEE
echo ============================================
echo.
echo Gitee token (paste, then Enter). Get one at:
echo   https://gitee.com/profile/personal_access_tokens  (check "projects")
echo.
set /p GT=Token: 
if "%GT%"=="" (
  echo [!] No token, abort.
  pause
  exit /b 1
)
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync-cloud.ps1" -Platform gitee -TokenGitee "%GT%"
