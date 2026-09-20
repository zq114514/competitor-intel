# 竞品技术情报站 · 网页服务启动脚本
# 双击此文件或在 PowerShell 中执行: powershell -ExecutionPolicy Bypass -File "启动服务.ps1"
# ==========

# 1. 杀掉旧进程
Write-Host "[清理] 停止占用 8765 端口的旧进程..." -ForegroundColor Cyan
$ports = Get-NetTCPConnection -LocalPort 8765 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
foreach ($pid in $ports) {
  try { Stop-Process -Id $pid -Force -ErrorAction Stop; Write-Host "  已杀 PID $pid" } catch {}
}
Start-Sleep -Seconds 1

# 2. 配置路径
$PYTHON = "c:\Users\chunsheng\Desktop\S59\AI场景\AI1\.venv\Scripts\python.exe"
$WEBDIR = "c:\Users\chunsheng\Desktop\S59\AI场景\AI1\webapp"
$PORT = 8765

if (-not (Test-Path $PYTHON)) { Write-Host "[错误] Python 不存在: $PYTHON" -ForegroundColor Red; Read-Host "按回车退出"; exit 1 }
if (-not (Test-Path "$WEBDIR\index.html")) { Write-Host "[错误] 找不到 webapp\index.html" -ForegroundColor Red; Read-Host "按回车退出"; exit 1 }

# 3. 启动服务（用 -ArgumentList 数组方式确保参数正确传递）
Write-Host "[启动] Python: $PYTHON" -ForegroundColor Cyan
Write-Host "[启动] 目录:   $WEBDIR" -ForegroundColor Cyan
Write-Host "[启动] 端口:   $PORT" -ForegroundColor Cyan
Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  启动成功！不要关闭此窗口！" -ForegroundColor Green
Write-Host "  本机访问:   http://127.0.0.1:$PORT/" -ForegroundColor Green
Write-Host "  局域网访问: http://10.4.149.98:$PORT/" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "关闭本窗口即停止服务。" -ForegroundColor Yellow
Write-Host ""

& $PYTHON -m http.server $PORT --bind 0.0.0.0 --directory $WEBDIR
