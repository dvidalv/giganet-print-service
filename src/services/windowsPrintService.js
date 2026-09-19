'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { getToolsDir } = require('../platform');

const SCRIPTS_DIR = path.join(__dirname, '..', '..', 'scripts', 'windows');

function wrapWinError(err, stdout, stderr) {
  const e = new Error(
    String(stderr || err.message || stdout || 'Error ejecutando PowerShell').trim()
  );
  e.code = 'LP_ERROR';
  e.stderr = stderr;
  e.stdout = stdout;
  return e;
}

function runPowerShell(scriptName, extraArgs = [], options = {}) {
  const { timeout = 30000 } = options;
  const scriptPath = path.join(SCRIPTS_DIR, scriptName);
  const args = [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    scriptPath,
    ...extraArgs,
  ];

  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      child.kill();
    }, timeout);

    const finish = (fn) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (err) => {
      finish(() => reject(wrapWinError(err, stdout, stderr)));
    });
    child.on('close', (code, signal) => {
      finish(() => {
        if (signal) {
          const e = new Error('Timeout ejecutando comando de impresión');
          e.code = 'PRINT_TIMEOUT';
          reject(e);
          return;
        }
        if (code !== 0) {
          reject(
            wrapWinError(
              new Error(stderr || stdout || `Código ${code}`),
              stdout,
              stderr
            )
          );
          return;
        }
        resolve({ stdout, stderr });
      });
    });
  });
}

function parsePrinterList(stdout) {
  const raw = String(stdout || '').trim();
  if (!raw) return [];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const items = Array.isArray(parsed) ? parsed : [parsed];
  return items
    .filter((p) => p && p.name)
    .map((p) => ({
      name: String(p.name),
      default: Boolean(p.default),
      status: String(p.status || 'unknown'),
      enabled: p.enabled !== false,
    }));
}

function samePrinterName(a, b) {
  return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

function findSumatraPath() {
  const envPath = String(process.env.GIGANET_SUMATRA_PATH || '').trim();
  const candidates = [
    envPath,
    path.join(getToolsDir(), 'SumatraPDF.exe'),
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'SumatraPDF', 'SumatraPDF.exe'),
    path.join(
      process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
      'SumatraPDF',
      'SumatraPDF.exe'
    ),
    path.join(
      process.env.LOCALAPPDATA || '',
      'SumatraPDF',
      'SumatraPDF.exe'
    ),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      /* ignore */
    }
  }
  return '';
}

function sumatraSettingsFromLpOptions(lpOptions, copies) {
  const parts = [];
  if (copies > 1) parts.push(`${copies}x`);
  for (const opt of lpOptions || []) {
    const value = String(opt || '').trim();
    if (!value) continue;
    if (value === 'fit-to-page') {
      parts.push('fit');
    } else if (
      value === 'orientation-requested=3' ||
      value === 'orientation-requested=5'
    ) {
      parts.push('landscape');
    } else if (
      value === 'orientation-requested=4' ||
      value === 'orientation-requested=6'
    ) {
      parts.push('portrait');
    } else if (value.startsWith('media=')) {
      const media = value.slice('media='.length);
      if (media && !/^custom\./i.test(media)) {
        parts.push(`paper=${media}`);
      }
    }
  }
  return parts.join(',');
}

async function listPrinters() {
  const { stdout } = await runPowerShell('list-printers.ps1', [], { timeout: 20000 });
  return parsePrinterList(stdout);
}

async function getDefaultPrinter() {
  const printers = await listPrinters();
  const found = printers.find((p) => p.default);
  return found ? found.name : null;
}

async function getPrinter(name) {
  const printers = await listPrinters();
  return printers.find((p) => samePrinterName(p.name, name)) || null;
}

async function printerExists(name) {
  return Boolean(await getPrinter(name));
}

async function printFile({
  printer,
  filePath,
  copies = 1,
  raw = false,
  timeoutMs = 30000,
  lpOptions = [],
}) {
  const known = await getPrinter(printer);
  if (!known) {
    const e = new Error('La impresora indicada no existe');
    e.code = 'PRINTER_NOT_FOUND';
    throw e;
  }
  if (!known.enabled || known.status === 'offline' || known.status === 'stopped') {
    const e = new Error('La impresora está offline o no acepta trabajos');
    e.code = 'PRINTER_OFFLINE';
    throw e;
  }

  const printerName = known.name;
  try {
    if (raw) {
      const { stdout, stderr } = await runPowerShell(
        'print-raw.ps1',
        [
          '-PrinterName', printerName,
          '-FilePath', filePath,
          '-Copies', String(copies),
        ],
        { timeout: timeoutMs }
      );
      return { success: true, stdout: stdout.trim(), stderr: stderr.trim() };
    }

    const sumatra = findSumatraPath();
    const settings = sumatraSettingsFromLpOptions(lpOptions, copies);
    const extra = [
      '-PrinterName', printerName,
      '-FilePath', filePath,
      '-Copies', String(copies),
    ];
    if (sumatra) extra.push('-SumatraPath', sumatra);
    if (settings) extra.push('-PrintSettings', settings);

    const { stdout, stderr } = await runPowerShell('print-pdf.ps1', extra, {
      timeout: timeoutMs,
    });
    return { success: true, stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (err) {
    if (err.code === 'PRINT_TIMEOUT' || err.code === 'PRINTER_NOT_FOUND' || err.code === 'PRINTER_OFFLINE') {
      throw err;
    }
    const msg = `${err.stderr || ''} ${err.message || ''}`.toLowerCase();
    if (msg.includes('not found') || msg.includes('no se encontró') || msg.includes('cannot find')) {
      const e = new Error('La impresora indicada no existe');
      e.code = 'PRINTER_NOT_FOUND';
      throw e;
    }
    if (msg.includes('offline') || msg.includes('not available')) {
      const e = new Error('La impresora está offline o no acepta trabajos');
      e.code = 'PRINTER_OFFLINE';
      throw e;
    }
    const e = new Error(err.message || 'Error enviando el trabajo a la impresora');
    e.code = 'LP_ERROR';
    throw e;
  }
}

module.exports = {
  listPrinters,
  getDefaultPrinter,
  printerExists,
  getPrinter,
  printFile,
  findSumatraPath,
  sumatraSettingsFromLpOptions,
  parsePrinterList,
};
