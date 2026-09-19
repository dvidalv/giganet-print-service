param(
  [Parameter(Mandatory = $true)][string]$TaskName
)

$ErrorActionPreference = 'Continue'
Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
Write-Output "OK"
