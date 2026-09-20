# sync-cloud.ps1 - Full-project sync to Gitee and/or GitHub via REST API (no git install needed)
#
# Usage (tokens are entered in the .bat wrappers at runtime; NEVER hardcode them):
#   powershell -File sync-cloud.ps1 -Platform gitee  -TokenGitee  xxx
#   powershell -File sync-cloud.ps1 -Platform github -TokenGithub xxx
#   powershell -File sync-cloud.ps1 -Platform all    -TokenGitee xxx -TokenGithub xxx
#
# Scope: the WHOLE project directory except .venv, *.lnk, deploy_tmp, __pycache__,
#         bitable-*.json scratch files. Includes webapp/, versions/ snapshots,
#         config/data/reports/templates, and all root scripts/docs.
# Logic: files are compared by git blob SHA1; unchanged files are skipped,
#        missing files are created, changed files are updated (sha-based).
#        Gitee: POST to create, PUT to update. GitHub: PUT for both.

param(
  [ValidateSet('gitee','github','all')][string]$Platform = 'all',
  [string]$TokenGitee  = '',
  [string]$TokenGithub = ''
)

$ErrorActionPreference = 'Continue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$projDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# ---------- collect files ----------
$excludeDirParts = @('\.venv\', '\deploy_tmp\', '\__pycache__\')
$items = @()
Get-ChildItem $projDir -Recurse -File | ForEach-Object {
  $full = $_.FullName
  if ($_.Extension -eq '.lnk') { return }
  if ($_.Name -like 'bitable-*.json') { return }
  foreach ($d in $excludeDirParts) { if ($full -like ('*' + $d + '*')) { return } }
  $rel = $full.Substring($projDir.Length + 1).Replace('\','/')
  $items += [pscustomobject]@{ Local = $full; Rel = $rel; Bytes = $null }
}
# virtual empty .nojekyll (GitHub Pages only; skipped for Gitee inside the loop)
$items += [pscustomobject]@{ Local = $null; Rel = '.nojekyll'; Bytes = $null }

function Get-Bytes($it) {
  if ($null -eq $it.Local) { return ,([byte[]]@()) }
  return ,([IO.File]::ReadAllBytes($it.Local))
}
# git blob id = SHA1("blob <size>`0" + raw bytes); works for files of any size
function Get-BlobSha([byte[]]$bytes) {
  $sha1 = [System.Security.Cryptography.SHA1]::Create()
  $head = [Text.Encoding]::ASCII.GetBytes(('blob ' + $bytes.Length + "`0"))
  $ms = New-Object IO.MemoryStream
  $ms.Write($head, 0, $head.Length)
  $ms.Write($bytes, 0, $bytes.Length)
  $h = $sha1.ComputeHash($ms.ToArray())
  return ([BitConverter]::ToString($h) -replace '-', '').ToLower()
}

Write-Host "============================================" -ForegroundColor Cyan
Write-Host (" Cloud Sync - " + $items.Count + " files scanned") -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

function Sync-One($plat, $token, $owner, $repo, $branch, $items) {
  Write-Host ""
  Write-Host ("--- " + $plat.ToUpper() + "  " + $owner + "/" + $repo + " @" + $branch + " ---") -ForegroundColor Yellow
  if ([string]::IsNullOrWhiteSpace($token)) { Write-Host "  [SKIP] no token provided" -ForegroundColor Red; return }

  if ($plat -eq 'github') {
    $apiBase = 'https://api.github.com/repos/' + $owner + '/' + $repo + '/contents/'
    $headers = @{ Authorization = ('Bearer ' + $token); Accept = 'application/vnd.github+json'; 'User-Agent' = 'sync-cloud' }
  } else {
    $apiBase = 'https://gitee.com/api/v5/repos/' + $owner + '/' + $repo + '/contents/'
    $headers = @{ Authorization = ('token ' + $token); Accept = 'application/json'; 'User-Agent' = 'sync-cloud' }
  }

  $nSame=0; $nNew=0; $nUpd=0; $nSkip=0; $nFail=0; $fails=@()
  foreach ($it in $items) {
    if ($plat -eq 'gitee' -and $it.Rel -eq '.nojekyll') { $nSkip++; continue }

    $bytes = Get-Bytes $it
    $localSha = Get-BlobSha $bytes
    $b64 = [Convert]::ToBase64String($bytes)
    $enc = [uri]::EscapeDataString($it.Rel)
    $url = $apiBase + $enc

    $remoteSha = $null
    try {
      $exist = Invoke-RestMethod -Uri ($url + '?ref=' + $branch) -Headers $headers -TimeoutSec 20 -ErrorAction Stop
      $remoteSha = $exist.sha
    } catch { $remoteSha = $null }

    if ($remoteSha -and $remoteSha -eq $localSha) { $nSame++; continue }

    if ($plat -eq 'github') {
      if ($remoteSha) { $payload = @{ message=('update ' + $it.Rel); content=$b64; branch=$branch; sha=$remoteSha } }
      else           { $payload = @{ message=('add ' + $it.Rel);    content=$b64; branch=$branch } }
      $method = 'Put'
    } else {
      if ($remoteSha) { $payload = @{ access_token=$token; message=('update ' + $it.Rel); content=$b64; branch=$branch; sha=$remoteSha }; $method='Put' }
      else           { $payload = @{ access_token=$token; message=('add ' + $it.Rel);    content=$b64; branch=$branch };                $method='Post' }
    }
    $bodyBytes = [Text.Encoding]::UTF8.GetBytes(($payload | ConvertTo-Json))

    try {
      Invoke-RestMethod -Uri $url -Method $method -Headers $headers -Body $bodyBytes -ContentType 'application/json; charset=utf-8' -TimeoutSec 30 -ErrorAction Stop | Out-Null
      if ($remoteSha) { Write-Host ("  UPDATED  " + $it.Rel) -ForegroundColor Green; $nUpd++ }
      else           { Write-Host ("  NEW       " + $it.Rel) -ForegroundColor Cyan;  $nNew++ }
    } catch {
      $msg = $_.Exception.Message
      Write-Host ("  FAIL      " + $it.Rel + " : " + $msg.Substring(0,[Math]::Min(70,$msg.Length))) -ForegroundColor Red
      $nFail++; $fails += $it.Rel
    }
  }
  Write-Host ("  [" + $plat.ToUpper() + " DONE] new=" + $nNew + " updated=" + $nUpd + " same=" + $nSame + " skipped=" + $nSkip + " FAIL=" + $nFail) -ForegroundColor Yellow
  if ($fails.Count -gt 0) { Write-Host ("  Failed: " + ($fails -join '; ')) -ForegroundColor Red }
}

if ($Platform -eq 'gitee' -or $Platform -eq 'all') {
  Sync-One 'gitee' $TokenGitee 'tsubakiou' 'competitor-intel' 'master' $items
}
if ($Platform -eq 'github' -or $Platform -eq 'all') {
  Sync-One 'github' $TokenGithub 'zq114514' 'competitor-intel' 'main' $items
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " Sync finished. Unchanged files were skipped." -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Read-Host "Press Enter to exit"
