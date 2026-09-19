param(
  [Parameter(Mandatory = $true)][int]$Port,
  [int]$KeepPid = 0
)

$ErrorActionPreference = 'SilentlyContinue'
$conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if (-not $conns) { exit 0 }

$pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique | Where-Object { $_ -and $_ -ne $KeepPid }
foreach ($procId in $pids) {
  Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
}
Write-Output ($pids -join ',')
