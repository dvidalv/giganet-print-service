$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Map-Win32Status([int]$code, [bool]$offline) {
  if ($offline) { return 'offline' }
  switch ($code) {
    3 { return 'idle' }
    4 { return 'printing' }
    5 { return 'printing' }
    6 { return 'stopped' }
    7 { return 'offline' }
    default { return 'unknown' }
  }
}

$items = @()
try {
  $items = @(Get-CimInstance -ClassName Win32_Printer | ForEach-Object {
    $offline = [bool]$_.WorkOffline
    [PSCustomObject]@{
      name    = $_.Name
      default = [bool]$_.Default
      status  = Map-Win32Status ([int]$_.PrinterStatus) $offline
      enabled = -not $offline
    }
  })
} catch {
  if (Get-Command Get-Printer -ErrorAction SilentlyContinue) {
    $defaultName = $null
    try {
      $defaultName = (Get-CimInstance -ClassName Win32_Printer -Filter 'Default=true' -ErrorAction SilentlyContinue).Name
    } catch { }
    $items = @(Get-Printer | ForEach-Object {
      $statusText = [string]$_.PrinterStatus
      $offline = $statusText -match 'Offline|Error|NoToner|PaperOut|DoorOpen|OutputBinFull'
      $mapped = if ($offline) { 'offline' }
        elseif ($statusText -match 'Normal|Idle|Other') { 'idle' }
        elseif ($statusText -match 'Printing|Warming|Initializing') { 'printing' }
        else { 'unknown' }
      [PSCustomObject]@{
        name    = $_.Name
        default = $defaultName -and ($_.Name -eq $defaultName)
        status  = $mapped
        enabled = -not $offline
      }
    })
  } else {
    throw $_.Exception
  }
}

if ($items.Count -eq 0) {
  Write-Output '[]'
} else {
  $items | ConvertTo-Json -Compress
}
