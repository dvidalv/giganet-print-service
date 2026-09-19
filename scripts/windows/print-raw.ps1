param(
  [Parameter(Mandatory = $true)][string]$PrinterName,
  [Parameter(Mandatory = $true)][string]$FilePath,
  [int]$Copies = 1
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $FilePath)) {
  throw "No existe el archivo: $FilePath"
}

if ($Copies -lt 1) { $Copies = 1 }

$source = @'
using System;
using System.Runtime.InteropServices;

public class GiganetRawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DOCINFO {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
  }

  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool OpenPrinter(string pPrinterName, out IntPtr hPrinter, IntPtr pDefault);

  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In] DOCINFO di);

  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

  public static void SendBytes(string printerName, byte[] bytes, string docName) {
    IntPtr hPrinter;
    if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) {
      throw new System.Exception("OpenPrinter failed: " + Marshal.GetLastWin32Error());
    }
    try {
      DOCINFO di = new DOCINFO();
      di.pDocName = docName;
      di.pDataType = "RAW";
      if (!StartDocPrinter(hPrinter, 1, di)) {
        throw new System.Exception("StartDocPrinter failed: " + Marshal.GetLastWin32Error());
      }
      try {
        if (!StartPagePrinter(hPrinter)) {
          throw new System.Exception("StartPagePrinter failed: " + Marshal.GetLastWin32Error());
        }
        try {
          IntPtr p = Marshal.AllocHGlobal(bytes.Length);
          try {
            Marshal.Copy(bytes, 0, p, bytes.Length);
            int written;
            if (!WritePrinter(hPrinter, p, bytes.Length, out written)) {
              throw new System.Exception("WritePrinter failed: " + Marshal.GetLastWin32Error());
            }
          } finally {
            Marshal.FreeHGlobal(p);
          }
        } finally {
          EndPagePrinter(hPrinter);
        }
      } finally {
        EndDocPrinter(hPrinter);
      }
    } finally {
      ClosePrinter(hPrinter);
    }
  }
}
'@

if (-not ([System.Management.Automation.PSTypeName]'GiganetRawPrinter').Type) {
  Add-Type -TypeDefinition $source -Language CSharp
}

$bytes = [System.IO.File]::ReadAllBytes($FilePath)
for ($i = 0; $i -lt $Copies; $i++) {
  [GiganetRawPrinter]::SendBytes($PrinterName, $bytes, 'Giganet Print Service')
}
