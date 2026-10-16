@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在启动竞品技术情报站...
start "" pythonw.exe serve.py
timeout /t 2 /nobreak >nul
start "" http://localhost:8765
exit
