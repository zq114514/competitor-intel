@echo off
start "" /b "%~dp0.venv\Scripts\pythonw.exe" -m http.server 8765 --bind 127.0.0.1 --directory "%~dp0webapp"
echo Service started: http://127.0.0.1:8765/
timeout /t 2 /nobreak >nul
