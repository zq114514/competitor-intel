@echo off
chcp 65001 >nul
REM === Sync webapp + docs to BOTH Gitee and GitHub in one run ===
echo ============================================
echo  Sync to GITEE + GITHUB (one shot)
echo ============================================
echo.
echo Gitee token  (https://gitee.com/profile/personal_access_tokens, check "projects"):
set /p GT=
echo.
echo GitHub token (https://github.com/settings/tokens/new, check "repo"):
set /p HT=
echo.
if "%GT%"=="" if "%HT%"=="" (
  echo [!] No token entered, abort.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync-cloud.ps1" -Platform all -TokenGitee "%GT%" -TokenGithub "%HT%"
