@echo off
chcp 65001 >nul
set PYTHONDONTWRITEBYTECODE=1
cd /d "%~dp0"
echo ============================================
echo  月度竞品/零部件技术信息采集（官方渠道）
echo ============================================
if not exist ".venv\Scripts\python.exe" (
    echo [错误] 未找到 .venv 虚拟环境，请先在项目目录执行：
    echo     python -m venv .venv
    echo     .venv\Scripts\python.exe -m pip install -i https://pypi.tuna.tsinghua.edu.cn/simple requests pyyaml beautifulsoup4 lxml feedparser
    pause
    exit /b 1
)
".venv\Scripts\python.exe" collect.py %*
echo.
echo 采集结果已归档到 data\raw\ 目录
pause
