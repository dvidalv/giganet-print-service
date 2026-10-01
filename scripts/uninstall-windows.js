'use strict';

const fs = require('fs');
const { spawnSync } = require('child_process');
const path = require('path');
const { SERVICE_NAME, SUPPORT_DIR, loadConfig } = require('../src/config');
const { WINDOWS_TASK_NAME, getWindowsStartupLauncherPath } = require('../src/platform');
const logger = require('../src/utils/logger');

function runPs1(scriptName, args) {
  return spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      path.join(__dirname, 'windows', scriptName),
      ...args,
    ],
    { encoding: 'utf8', windowsHide: true }
  );
}

function main() {
  if (process.platform !== 'win32') {
    console.error('Este desinstalador es solo para Windows.');
    process.exit(1);
  }

  console.log(`Desinstalando ${SERVICE_NAME}…`);

  const result = runPs1('unregister-task.ps1', ['-TaskName', WINDOWS_TASK_NAME]);
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.warn((result.stderr || result.stdout || '').trim());
  }

  const launcherPath = getWindowsStartupLauncherPath();
  if (fs.existsSync(launcherPath)) {
    try {
      fs.unlinkSync(launcherPath);
      console.log(`Arranque de la carpeta Inicio eliminado: ${launcherPath}`);
    } catch (err) {
      console.warn(`No se pudo borrar ${launcherPath}: ${err.message}`);
    }
  }

  const config = loadConfig({ createIfMissing: false });
  const port = (config && config.port) || 9100;
  runPs1('free-port.ps1', ['-Port', String(port), '-KeepPid', String(process.pid)]);

  logger.info('Servicio desinstalado (configuración de usuario conservada)');
  console.log('\nAutoarranque eliminado y servicio detenido. La configuración en');
  console.log(`${SUPPORT_DIR} NO se borró.`);
}

module.exports = { main };

if (require.main === module) {
  main();
}
