param(
  [switch]$SkipStatus
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
# Sin BOM: Node parsea la salida como JSON. UTF-8 para nombres con acentos.
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false

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

# Nombres desde el spooler local: rápido y no contacta impresoras de red.
# Win32_Printer sí las consulta y puede colgarse decenas de segundos.
$names = @()
$defaultName = $null
try {
  Add-Type -AssemblyName System.Drawing
  $names = @([System.Drawing.Printing.PrinterSettings]::InstalledPrinters)
  $defaultName = (New-Object System.Drawing.Printing.PrinterSettings).PrinterName
} catch {
  if (Get-Command Get-Printer -ErrorAction SilentlyContinue) {
    $names = @(Get-Printer | Select-Object -ExpandProperty Name)
  } else {
    throw $_.Exception
  }
}

$statusByName = @{}
if (-not $SkipStatus -and $names.Count -gt 0) {
  try {
    Get-CimInstance -ClassName Win32_Printer `
      -Property Name, PrinterStatus, WorkOffline, Default `
      -OperationTimeoutSec 5 `
      -ErrorAction Stop |
      ForEach-Object { $statusByName[$_.Name] = $_ }
  } catch {
    # Estado desconocido; la lista de nombres sigue siendo válida.
  }
}

$items = @(foreach ($name in $names) {
  $info = $statusByName[$name]
  $offline = $false
  $status = 'unknown'
  $isDefault = $defaultName -and ($name -eq $defaultName)
  if ($info) {
    $offline = [bool]$info.WorkOffline
    $status = Map-Win32Status ([int]$info.PrinterStatus) $offline
    if (-not $defaultName) { $isDefault = [bool]$info.Default }
  }
  [PSCustomObject]@{
    name    = $name
    default = [bool]$isDefault
    status  = $status
    enabled = -not $offline
  }
})

if ($items.Count -eq 0) {
  Write-Output '[]'
} else {
  ConvertTo-Json -InputObject $items -Compress
}
