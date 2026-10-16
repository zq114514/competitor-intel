@echo off
chcp 65001 >nul
cd /d "%~dp0"
REM 确保服务已启动（已在运行则pythonw会因端口占用静默退出，不影响）
start "" pythonw.exe serve.py
timeout /t 2 /nobreak >nul
start "" http://localhost:8765/admin-imgs.html
exit
