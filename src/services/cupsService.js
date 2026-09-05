'use strict';

const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

async function run(cmd, args, options = {}) {
  const { timeout = 15000 } = options;
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, {
      timeout,
      maxBuffer: 2 * 1024 * 1024,
      env: { ...process.env, LANG: 'en_US.UTF-8' },
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

/**
 * Lista impresoras CUPS con estado.
 * @returns {Promise<Array<{name: string, default: boolean, status: string, enabled: boolean}>>}
 */
async function listPrinters() {
  const printers = [];
  let defaultName = null;

  try {
    const { stdout: dOut } = await run('lpstat', ['-d']);
    const m = dOut.match(/system default destination:\s*(.+)/i);
    if (m) {
      defaultName = m[1].trim();
    }
  } catch {
    // No default configured is fine
  }

  try {
    const { stdout } = await run('lpstat', ['-p']);
    const lines = stdout.split('\n').filter(Boolean);
    for (const line of lines) {
      // printer NAME is idle.  enabled since ...
      // printer NAME disabled since ... -
      const match = line.match(/^printer\s+(\S+)\s+(.+)$/i);
      if (!match) continue;
      const name = match[1];
      const rest = match[2].toLowerCase();
      const enabled = !rest.includes('disabled');
      let status = 'unknown';
      if (rest.includes('idle')) status = 'idle';
      else if (rest.includes('printing')) status = 'printing';
      else if (rest.includes('disabled')) status = 'disabled';
      else if (rest.includes('stopped')) status = 'stopped';

      printers.push({
        name,
        default: defaultName === name,
        status,
        enabled,
      });
    }
  } catch (err) {
    if (String(err.message || '').includes('No destinations')) {
      return [];
    }
    throw err;
  }

  return printers;
}

async function getDefaultPrinter() {
  try {
    const { stdout } = await run('lpstat', ['-d']);
    const m = stdout.match(/system default destination:\s*(.+)/i);
    return m ? m[1].trim() : null;
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
async function printFile({ printer, filePath, copies = 1, raw = false, timeoutMs = 30000 }) {
  const args = ['-d', printer, '-n', String(copies)];
  if (raw) {
    args.push('-o', 'raw');
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
