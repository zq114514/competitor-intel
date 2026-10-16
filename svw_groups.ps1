param([string]$GroupFile)
$dir = $PSScriptRoot
$models = [ordered]@{
  'Pro'   = 'SVMZC11F6001'
  'Max'   = 'SVMZC12F7001'
  'MaxL'  = 'SVMZC12F7002'
  'Ultra' = 'SVMZC13F7001'
}
$groups = [System.IO.File]::ReadAllLines((Join-Path $dir $GroupFile),[Text.Encoding]::UTF8)
$data = @{}
foreach($k in $models.Keys){
  $j = [System.IO.File]::ReadAllText((Join-Path $dir ("svw_8x_{0}.json" -f $models[$k])),[Text.Encoding]::UTF8) | ConvertFrom-Json
  $data[$k] = $j.retData.modelOptionList
}
$sb = New-Object System.Text.StringBuilder
$union = @{}
foreach($k in $models.Keys){ foreach($it in $data[$k]){ if(-not $union.ContainsKey($it.customOptionId)){ $union[$it.customOptionId] = $it } } }
foreach($g in $groups){
  [void]$sb.AppendLine("===== GROUP: $g =====")
  foreach($id in $union.Keys){
    $it = $union[$id]
    if($it.optionGroupName -ne $g){ continue }
    $name = ($it.optionNameCn -replace '<[^>]+>',' ' -replace '\s+',' ').Trim()
    $line = "{0} || {1}" -f $name, $it.optionTypeRemark
    foreach($k in $models.Keys){
      $mine = $data[$k] | Where-Object { $_.customOptionId -eq $id }
      if($mine){ $rm = $mine.optionTypeRemark; if($rm){ $line += " || ${k}:$rm" } }
    }
    [void]$sb.AppendLine($line)
  }
}
[System.IO.File]::WriteAllText((Join-Path $dir 'svw_groups_out.txt'), $sb.ToString(), (New-Object Text.UTF8Encoding($false)))
