$dir = $PSScriptRoot
$models = [ordered]@{
  'Pro'   = 'SVMZC11F6001'
  'Max'   = 'SVMZC12F7001'
  'MaxL'  = 'SVMZC12F7002'
  'Ultra' = 'SVMZC13F7001'
}
$data = @{}
foreach($k in $models.Keys){
  $j = [System.IO.File]::ReadAllText((Join-Path $dir ("svw_8x_{0}.json" -f $models[$k])),[Text.Encoding]::UTF8) | ConvertFrom-Json
  $data[$k] = $j.retData.modelOptionList
}
$all = @{}
foreach($k in $models.Keys){ foreach($it in $data[$k]){ if(-not $all.ContainsKey($it.customOptionId)){ $all[$it.customOptionId] = $it } } }

$patterns = [System.IO.File]::ReadAllLines((Join-Path $dir 'svw_pats.txt'),[Text.Encoding]::UTF8)
$sb = New-Object System.Text.StringBuilder
foreach($pat in $patterns){
  [void]$sb.AppendLine("### $pat")
  foreach($id in $all.Keys){
    $it = $all[$id]
    $name = ($it.optionNameCn -replace '<[^>]+>',' ' -replace '\s+',' ').Trim()
    $remark = $it.optionTypeRemark
    $blob = "$name # $remark"
    if($blob -match $pat){
      $marks = foreach($k in $models.Keys){ if(($data[$k] | Where-Object { $_.customOptionId -eq $id })){ 'Y' } else { '-' } }
      [void]$sb.AppendLine(("{0} [{1}] {2} || {3}" -f ($marks -join ''), $it.optionGroupName, $name, $remark))
    }
  }
}
[System.IO.File]::WriteAllText((Join-Path $dir 'svw_compare_out.txt'), $sb.ToString(), (New-Object Text.UTF8Encoding($false)))
