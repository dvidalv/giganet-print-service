'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { spawnSync } = require('child_process');
const {
  ensureSupportDir,
  loadConfig,
  updateConfig,
  CONFIG_PATH,
  SUPPORT_DIR,
  SERVICE_NAME,
} = require('../src/config');
const { getLogDir, getToolsDir, WINDOWS_TASK_NAME } = require('../src/platform');
const logger = require('../src/utils/logger');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const NODE_BIN = process.execPath;
const SERVER_JS = path.join(PROJECT_ROOT, 'src', 'server.js');
const WINDOWS_SCRIPTS = path.join(__dirname, 'windows');

const SUMATRA_VERSION = '3.5.2';
const SUMATRA_URL =
  process.arch === 'ia32'
    ? `https://www.sumatrapdfreader.org/dl/rel/${SUMATRA_VERSION}/SumatraPDF-${SUMATRA_VERSION}-32.exe`
    : `https://www.sumatrapdfreader.org/dl/rel/${SUMATRA_VERSION}/SumatraPDF-${SUMATRA_VERSION}-64.exe`;

function runPs1(scriptName, extraArgs = [], options = {}) {
  const scriptPath = path.join(WINDOWS_SCRIPTS, scriptName);
  const result = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      scriptPath,
      ...extraArgs,
    ],
    {
      encoding: 'utf8',
      windowsHide: true,
      timeout: options.timeout || 30000,
    }
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const err = new Error(
      (result.stderr || result.stdout || `PowerShell código ${result.status}`).trim()
    );
    throw err;
  }
  return (result.stdout || '').trim();
}

function downloadFile(url, dest, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https:') ? https : http;
    const req = client.get(
      url,
      { headers: { 'User-Agent': 'GiganetPrintService' } },
      (res) => {
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location &&
          redirectsLeft > 0
        ) {
          res.resume();
          const next = new URL(res.headers.location, url).toString();
          downloadFile(next, dest, redirectsLeft - 1).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode} al descargar SumatraPDF`));
          return;
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve(dest)));
        file.on('error', (err) => {
          try {
            fs.unlinkSync(dest);
          } catch {
            /* ignore */
          }
          reject(err);
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error('Timeout descargando SumatraPDF'));
    });
  });
}

async function ensureSumatra() {
  const toolsDir = getToolsDir();
  if (!fs.existsSync(toolsDir)) {
    fs.mkdirSync(toolsDir, { recursive: true });
  }
  const dest = path.join(toolsDir, 'SumatraPDF.exe');
  if (fs.existsSync(dest) && fs.statSync(dest).size > 100000) {
    return dest;
  }
  const { findSumatraPath } = require('../src/services/windowsPrintService');
  const existing = findSumatraPath();
  if (existing) return existing;

  console.log('Descargando SumatraPDF (impresión PDF silenciosa)…');
  try {
    await downloadFile(SUMATRA_URL, dest);
    if (!fs.existsSync(dest) || fs.statSync(dest).size < 100000) {
      throw new Error('Descarga incompleta');
    }
    console.log(`SumatraPDF: ${dest}`);
    return dest;
  } catch (err) {
    try {
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
    } catch {
      /* ignore */
    }
    console.warn('No se pudo descargar SumatraPDF:', err.message);
    console.warn(
      'La impresión PDF usará el visor asociado (PrintTo). Para impresión silenciosa instala SumatraPDF o vuelve a ejecutar npm run install-service con red.'
    );
    return '';
  }
}

function waitForStatus(port) {
  return new Promise((resolve) => {
    const deadline = Date.now() + 8000;
    const tryOnce = () => {
      const req = http.get(
        {
          host: '127.0.0.1',
          port,
          path: '/status',
          timeout: 1000,
        },
        (res) => {
          let body = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            body += chunk;
          });
          res.on('end', () => resolve(body.trim()));
        }
      );
      req.on('error', () => {
        if (Date.now() > deadline) return resolve('');
        setTimeout(tryOnce, 250);
      });
      req.on('timeout', () => {
        req.destroy();
        if (Date.now() > deadline) return resolve('');
        setTimeout(tryOnce, 250);
      });
    };
    tryOnce();
  });
}

async function main() {
  if (process.platform !== 'win32') {
    console.error('Este instalador es solo para Windows.');
    process.exit(1);
  }

  console.log(`Instalando ${SERVICE_NAME} (Windows)…`);
  ensureSupportDir();
  const logDir = getLogDir();
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const config = loadConfig({ createIfMissing: true });
  const importedKey = String(
    process.env.GIGANET_PRINT_KEY || process.env.GIGANET_PRINT_API_KEY || ''
  ).trim();
  if (importedKey.length >= 16 && importedKey !== config.apiKey) {
    updateConfig({ apiKey: importedKey });
    config.apiKey = importedKey;
    console.log('API Key tomada de GIGANET_PRINT_KEY (debe coincidir con Vercel).');
  }
  console.log(`Configuración: ${CONFIG_PATH}`);
  console.log(`API Key (guárdala): ${config.apiKey}`);
  console.log(
    'Si LPCR ya está en Vercel, esta clave DEBE ser NEXT_PUBLIC_GIGANET_PRINT_KEY. Pégala en /settings si es distinta.'
  );
  console.log(`Directorio de soporte: ${SUPPORT_DIR}`);

  const port = config.port || 9100;
  try {
    runPs1('free-port.ps1', ['-Port', String(port), '-KeepPid', String(process.pid)]);
  } catch {
    /* puerto libre o sin permiso */
  }

  await ensureSumatra();

  try {
    runPs1(
      'register-task.ps1',
      [
        '-NodePath', NODE_BIN,
        '-ServerJs', SERVER_JS,
        '-WorkingDirectory', PROJECT_ROOT,
        '-TaskName', WINDOWS_TASK_NAME,
      ],
      { timeout: 45000 }
    );
  } catch (err) {
    console.error('\nNo se pudo registrar la tarea programada.');
    console.error(err.message);
    console.error('\nEn PowerShell (sin Administrador):');
    console.error('  npm run install-service');
    console.error('\nMientras tanto puedes usar: npm start');
    process.exit(1);
  }

  logger.info('Servicio instalado vía Scheduled Task', { task: WINDOWS_TASK_NAME });

  console.log('\nListo.');
  console.log(`  Tarea:    ${WINDOWS_TASK_NAME} (al iniciar sesión)`);
  console.log(`  Status:   http://127.0.0.1:${port}/status`);
  console.log(`  Settings: http://127.0.0.1:${port}/settings`);

  const verified = await waitForStatus(port);
  if (verified) {
    console.log(`  Verificación: ${verified}`);
  } else {
    console.warn(
      '  No se pudo leer /status. Abre /settings o ejecuta: npm start'
    );
  }
  console.log('\nEl servicio arrancará automáticamente al iniciar sesión.');
}

module.exports = { main };

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
