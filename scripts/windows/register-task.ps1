param(
  [Parameter(Mandatory = $true)][string]$NodePath,
  [Parameter(Mandatory = $true)][string]$ServerJs,
  [Parameter(Mandatory = $true)][string]$WorkingDirectory,
  [Parameter(Mandatory = $true)][string]$TaskName
)

$ErrorActionPreference = 'Stop'

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

$argument = '"' + $ServerJs + '"'
$action = New-ScheduledTaskAction -Execute $NodePath -Argument $argument -WorkingDirectory $WorkingDirectory
$trigger = New-ScheduledTaskTrigger -AtLogOn
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -MultipleInstances IgnoreNew

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $trigger `
  -Principal $principal `
  -Settings $settings `
  -Description 'Giganet Print Service — API local de impresión (127.0.0.1)' `
  | Out-Null

Start-ScheduledTask -TaskName $TaskName
Write-Output "OK $TaskName"
