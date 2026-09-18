'use strict';

const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const LPSTAT_BIN = '/usr/bin/lpstat';
const LP_BIN = '/usr/bin/lp';

function cupsEnv() {
  return {
    ...process.env,
    LANG: 'C',
    LC_ALL: 'C',
    LC_MESSAGES: 'C',
  };
}

function resolveBin(cmd) {
  if (cmd === 'lpstat') return LPSTAT_BIN;
  if (cmd === 'lp') return LP_BIN;
  return cmd;
}

async function run(cmd, args, options = {}) {
  const { timeout = 15000 } = options;
  try {
    const { stdout, stderr } = await execFileAsync(resolveBin(cmd), args, {
      timeout,
      maxBuffer: 2 * 1024 * 1024,
      env: cupsEnv(),
    });
    return { stdout: stdout || '', stderr: stderr || '' };
  } catch (err) {
    if (err.killed && err.signal === 'SIGTERM') {
      const e = new Error('Timeout ejecutando comando de impresión');
      e.code = 'PRINT_TIMEOUT';
      throw e;
    }
    const e = new Error(err.stderr || err.message || 'Error ejecutando comando');
    e.code = err.code === 'ETIMEDOUT' ? 'PRINT_TIMEOUT' : 'LP_ERROR';
    e.stderr = err.stderr;
    e.stdout = err.stdout;
    throw e;
  }
}

function parseDefaultName(stdout) {
  const m = String(stdout || '').match(
    /(?:system default destination|destino predeterminado del sistema|destino por omisi[oó]n del sistema):\s*(\S+)/i
  );
  return m ? m[1].trim() : null;
}

function isNoDestinations(err) {
  const msg = `${err.message || ''} ${err.stderr || ''} ${err.stdout || ''}`.toLowerCase();
  return (
    msg.includes('no destinations') ||
    msg.includes('no destination') ||
    msg.includes('ningún destino') ||
    msg.includes('ningun destino') ||
    msg.includes('no se han a')
  );
}

function parsePrinterStatusLine(line) {
  const match = String(line || '').match(
    /^(?:printer|impresora|la impresora)\s+(\S+)\s+(.+)$/i
  );
  if (!match) return null;
  const name = match[1];
  const rest = match[2].toLowerCase();
  const enabled =
    !/\bdisabled\b/.test(rest) &&
    !rest.includes('deshabilitad') &&
    !rest.includes('desactivad');
  let status = 'unknown';
  if (rest.includes('idle') || rest.includes('inactiv')) status = 'idle';
  else if (rest.includes('printing') || rest.includes('imprimiendo')) status = 'printing';
  else if (rest.includes('disabled') || rest.includes('deshabilitad') || rest.includes('desactivad')) {
    status = 'disabled';
  } else if (rest.includes('stopped') || rest.includes('detenid')) status = 'stopped';
  return { name, enabled, status };
}

async function listPrinterNamesFallback() {
  const names = new Set();
  try {
    const { stdout } = await run('lpstat', ['-e']);
    for (const line of stdout.split('\n')) {
      const name = line.trim();
      if (name) names.add(name);
    }
  } catch {
    /* lpstat -e no existe en CUPS antiguos */
  }
  try {
    const { stdout } = await run('lpstat', ['-v']);
    for (const line of stdout.split('\n')) {
      const m = line.match(/^(?:device for|dispositivo para)\s+(.+?):/i);
      if (m) names.add(m[1].trim());
    }
  } catch {
    /* sin colas */
  }
  return [...names];
}

/**
 * Lista impresoras CUPS con estado.
 * @returns {Promise<Array<{name: string, default: boolean, status: string, enabled: boolean}>>}
 */
async function listPrinters() {
  const byName = new Map();
  let defaultName = null;

  try {
    const { stdout: dOut } = await run('lpstat', ['-d']);
    defaultName = parseDefaultName(dOut);
  } catch {
    // No default configured is fine
  }

  try {
    const { stdout } = await run('lpstat', ['-p']);
    for (const line of stdout.split('\n').filter(Boolean)) {
      const parsed = parsePrinterStatusLine(line);
      if (!parsed) continue;
      byName.set(parsed.name, {
        name: parsed.name,
        default: defaultName === parsed.name,
        status: parsed.status,
        enabled: parsed.enabled,
      });
    }
  } catch (err) {
    if (!isNoDestinations(err)) throw err;
  }

  if (byName.size === 0) {
    const fallback = await listPrinterNamesFallback();
    for (const name of fallback) {
      byName.set(name, {
        name,
        default: defaultName === name,
        status: 'unknown',
        enabled: true,
      });
    }
  } else if (defaultName && !byName.has(defaultName)) {
    byName.set(defaultName, {
      name: defaultName,
      default: true,
      status: 'unknown',
      enabled: true,
    });
  }

  return [...byName.values()];
}

async function getDefaultPrinter() {
  try {
    const { stdout } = await run('lpstat', ['-d']);
    return parseDefaultName(stdout);
  } catch {
    return null;
  }
}

async function printerExists(name) {
  const printers = await listPrinters();
  return printers.some((p) => p.name === name);
}

async function getPrinter(name) {
  const printers = await listPrinters();
  return printers.find((p) => p.name === name) || null;
}

/**
 * Envía un archivo a CUPS con lp.
 */
async function printFile({
  printer,
  filePath,
  copies = 1,
  raw = false,
  timeoutMs = 30000,
  lpOptions = [],
}) {
  const args = ['-d', printer, '-n', String(copies)];
  if (raw) {
    args.push('-o', 'raw');
  }
  for (const opt of lpOptions || []) {
    const value = String(opt || '').trim();
    if (value) args.push('-o', value);
  }
  args.push(filePath);

  try {
    const { stdout, stderr } = await run('lp', args, { timeout: timeoutMs });
    return {
      success: true,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    };
  } catch (err) {
    if (err.code === 'PRINT_TIMEOUT') {
      throw err;
    }
    const msg = `${err.stderr || ''} ${err.message || ''}`.toLowerCase();
    if (msg.includes('not found') || msg.includes('unknown destination')) {
      const e = new Error('La impresora indicada no existe');
      e.code = 'PRINTER_NOT_FOUND';
      throw e;
    }
    if (msg.includes('disabled') || msg.includes('not accepting')) {
      const e = new Error('La impresora está offline o no acepta trabajos');
      e.code = 'PRINTER_OFFLINE';
      throw e;
    }
    const e = new Error(err.message || 'Error ejecutando lp');
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
};
