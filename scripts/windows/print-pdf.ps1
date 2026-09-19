param(
  [Parameter(Mandatory = $true)][string]$PrinterName,
  [Parameter(Mandatory = $true)][string]$FilePath,
  [int]$Copies = 1,
  [string]$SumatraPath = '',
  [string]$PrintSettings = ''
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

if (-not (Test-Path -LiteralPath $FilePath)) {
  throw "No existe el archivo: $FilePath"
}

if ($Copies -lt 1) { $Copies = 1 }

if ($SumatraPath -and (Test-Path -LiteralPath $SumatraPath)) {
  $sumatraArgs = @(
    '-silent',
    '-print-to', $PrinterName,
    '-exit-when-done'
  )
  $settings = $PrintSettings
  if ($Copies -gt 1 -and $settings -notmatch '\d+x') {
    $settings = if ($settings) { "$Copies`x,$settings" } else { "$Copies`x" }
  }
  if ($settings) {
    $sumatraArgs += @('-print-settings', $settings)
  }
  $sumatraArgs += $FilePath
  $proc = Start-Process -FilePath $SumatraPath -ArgumentList $sumatraArgs -Wait -PassThru -WindowStyle Hidden
  if ($proc.ExitCode -ne 0) {
    throw "SumatraPDF terminó con código $($proc.ExitCode)"
  }
  exit 0
}

# Fallback: verbo PrintTo del visor PDF asociado (Edge / Adobe).
for ($i = 0; $i -lt $Copies; $i++) {
  $proc = Start-Process -FilePath $FilePath -Verb PrintTo -ArgumentList $PrinterName -Wait -PassThru -WindowStyle Hidden -ErrorAction Stop
  if ($null -ne $proc -and $proc.ExitCode -and $proc.ExitCode -ne 0) {
    throw "PrintTo terminó con código $($proc.ExitCode)"
  }
}
