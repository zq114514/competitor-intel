# run-server.ps1 - Launch local web server
# Auto-resolves short paths to handle Chinese folder names safely.

$ErrorActionPreference = "Continue"

# --- resolve paths to short (8.3) form to avoid Chinese folder issues ---
$projDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$python  = Join-Path $projDir ".venv\Scripts\python.exe"
$webDir  = Join-Path $projDir "webapp"

# Convert to short paths (no Chinese, no spaces)
function Get-ShortPath([string]$longPath) {
  try {
    $fso = New-Object -ComObject Scripting.FileSystemObject
    if (-not (Test-Path $longPath)) { return $longPath }
    return $fso.GetFolder($longPath).ShortPath
  } catch {
    return $longPath
  }
}

$pythonShort = Get-ShortPath $python
$webDirShort = Get-ShortPath $webDir

# --- kill old processes on port 8765 ---
Write-Host "[1/3] Cleaning port 8765..."
$ports = Get-NetTCPConnection -LocalPort 8765 -ErrorAction SilentlyContinue |
         Select-Object -ExpandProperty OwningProcess -Unique
foreach ($p in $ports) {
  try { Stop-Process -Id $p -Force -ErrorAction Stop; Write-Host "  killed PID $p" } catch {}
}
Start-Sleep -Seconds 1

# --- checks ---
if (-not (Test-Path $python)) {
  Write-Host "[ERROR] Python not found: $python" -ForegroundColor Red
  Write-Host "Press Enter to exit..." ; Read-Host
  exit 1
}
if (-not (Test-Path "$webDir\index.html")) {
  Write-Host "[ERROR] webapp\index.html not found at $webDir" -ForegroundColor Red
  Write-Host "Press Enter to exit..." ; Read-Host
  exit 1
}

# --- launch ---
Write-Host "[2/3] Starting Python http.server..."
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Server is running. Do NOT close this window!" -ForegroundColor Green
Write-Host "  Local:   http://127.0.0.1:8765/" -ForegroundColor Green
Write-Host "  Network: http://10.4.149.98:8765/" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Close this window to stop the server." -ForegroundColor Yellow
Write-Host ""

& $pythonShort -m http.server 8765 --bind 0.0.0.0 --directory $webDirShort
if ($LASTEXITCODE -ne 0) {
  Write-Host "[ERROR] Exit code: $LASTEXITCODE" -ForegroundColor Red
  Write-Host "Press Enter to exit..." ; Read-Host
}
