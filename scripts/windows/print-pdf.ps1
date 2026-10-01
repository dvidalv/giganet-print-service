param(
  [Parameter(Mandatory = $true)][string]$PrinterName,
  [Parameter(Mandatory = $true)][string]$FilePath,
  [int]$Copies = 1,
  [string]$SumatraPath = '',
  [string]$PrintSettings = ''
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

# Mensajes solo ASCII: PowerShell 5.1 lee este archivo (UTF-8 sin BOM) como ANSI.

# Start-Process une -ArgumentList con espacios sin comillas: "EPSON L220 Series"
# llegaria como tres argumentos. Se arma la linea de comandos a mano.
function ConvertTo-ArgumentLine([string[]]$values) {
  ($values | ForEach-Object {
    if ($_ -match '[\s"]') { '"' + ($_ -replace '"', '\"') + '"' } else { $_ }
  }) -join ' '
}

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
  $argLine = ConvertTo-ArgumentLine $sumatraArgs
  $proc = Start-Process -FilePath $SumatraPath -ArgumentList $argLine -Wait -PassThru -WindowStyle Hidden
  if ($proc.ExitCode -ne 0) {
    throw "SumatraPDF termino con codigo $($proc.ExitCode) (impresora: $PrinterName)"
  }
  exit 0
}

# Fallback: verbo PrintTo del visor PDF asociado (Edge / Adobe).
$printToArg = ConvertTo-ArgumentLine @($PrinterName)
for ($i = 0; $i -lt $Copies; $i++) {
  $proc = Start-Process -FilePath $FilePath -Verb PrintTo -ArgumentList $printToArg -Wait -PassThru -WindowStyle Hidden -ErrorAction Stop
  if ($null -ne $proc -and $proc.ExitCode -and $proc.ExitCode -ne 0) {
    throw "PrintTo termino con codigo $($proc.ExitCode) (impresora: $PrinterName)"
  }
}
