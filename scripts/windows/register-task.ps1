param(
  [Parameter(Mandatory = $true)][string]$LauncherPath,
  [Parameter(Mandatory = $true)][string]$WorkingDirectory,
  [Parameter(Mandatory = $true)][string]$TaskName
)

$ErrorActionPreference = 'Stop'

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

# node.exe es una app de consola: lanzado directo desde la tarea abre una ventana
# y cerrarla detiene el servicio. wscript + VBS lo arranca oculto.
$argument = '//B //Nologo "' + $LauncherPath + '"'
$action = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument $argument -WorkingDirectory $WorkingDirectory
# -AtLogOn sin -User = "cualquier usuario" y Windows exige Administrador.
$userId = if ($env:USERDOMAIN) { "$env:USERDOMAIN\$env:USERNAME" } else { $env:USERNAME }
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $userId
$principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited
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
  -Description 'Giganet Print Service - API local de impresion (127.0.0.1)' `
  | Out-Null

Start-ScheduledTask -TaskName $TaskName
Write-Output "OK $TaskName"
