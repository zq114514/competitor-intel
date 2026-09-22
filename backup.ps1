# backup.ps1 - Snapshot current webapp/ into versions/ before risky changes
# English output only (avoids Chinese encoding issues in cmd/bat).

$ErrorActionPreference = "Stop"
$projDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$src     = Join-Path $projDir "webapp"
$verDir  = Join-Path $projDir "versions"

if (-not (Test-Path $src)) {
  Write-Host "[ERROR] webapp folder not found: $src" -ForegroundColor Red
  Read-Host "Press Enter to exit"
  exit 1
}

# Accept optional custom label: powershell -File backup.ps1 mylabel
$label = $args[0]
if ([string]::IsNullOrWhiteSpace($label)) {
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $name  = "webapp-snapshot-$stamp"
} else {
  $name  = "webapp-$label"
}
$dst = Join-Path $verDir $name

Write-Host "=== Webapp Snapshot Backup ===" -ForegroundColor Cyan
Write-Host "Source : $src"
Write-Host "Target : $dst"
Write-Host ""

New-Item -ItemType Directory -Force -Path $verDir | Out-Null
Copy-Item -Path $src -Destination $dst -Recurse -Force

$count = (Get-ChildItem $dst -Recurse -File | Measure-Object).Count
Write-Host "[OK] Snapshot created: $name ($count files)" -ForegroundColor Green
Write-Host ""
Write-Host "All snapshots live in: versions\" -ForegroundColor Yellow
Get-ChildItem $verDir -Directory | Sort-Object Name | ForEach-Object {
  $c = (Get-ChildItem $_.FullName -Recurse -File | Measure-Object).Count
  Write-Host ("  - {0}  ({1} files)" -f $_.Name, $c)
}
Write-Host ""
Write-Host "To restore: copy the snapshot folder contents back over webapp\" -ForegroundColor Yellow
Read-Host "Press Enter to exit"
