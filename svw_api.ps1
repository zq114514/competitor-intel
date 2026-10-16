param([string]$Path)
function SvwGet($path){
  $query = ($path -split '\?',2)[1]
  $chars = (48..57)+(97..118)
  $nonce = -join ((1..12) | ForEach-Object { [char]($chars | Get-Random) })
  $ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()-1000
  $d=''
  if($query){ $d=(($query -split '&') | Sort-Object) -join '&'; $d += '&' }
  $raw = "$d$ts$nonce" + 'b!5Hb25R#t'
  $md5=[System.Security.Cryptography.MD5]::Create()
  $sign=([BitConverter]::ToString($md5.ComputeHash([Text.Encoding]::UTF8.GetBytes($raw))) -replace '-','').ToLower()
  curl.exe -s -m 40 "https://m.svw-volkswagen.com/cc-scg/$path" `
    -H "User-Agent: Mozilla/5.0 (iPhone)" -H "Referer: https://m.svw-volkswagen.com/carconfig/" `
    -H 'X-App-Key: VW_CC' -H 'X-Channel: vwcc_webgl' -H "X-Timestamp: $ts" -H "X-Nonce: $nonce" `
    -H "X-Sign: $sign" -H 'Content-Type: application/json' -H 'Accept-Language: zh-cn,zh'
}
SvwGet $Path
