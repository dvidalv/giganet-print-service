'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const { SERVICE_NAME, SUPPORT_DIR } = require('../src/config');
const { WINDOWS_TASK_NAME } = require('../src/platform');
const logger = require('../src/utils/logger');

function main() {
  if (process.platform !== 'win32') {
    console.error('Este desinstalador es solo para Windows.');
    process.exit(1);
  }

  console.log(`Desinstalando ${SERVICE_NAME}…`);

  const scriptPath = path.join(__dirname, 'windows', 'unregister-task.ps1');
  const result = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      scriptPath,
      '-TaskName',
      WINDOWS_TASK_NAME,
    ],
    { encoding: 'utf8', windowsHide: true }
  );

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.warn((result.stderr || result.stdout || '').trim());
  }

  logger.info('Servicio desinstalado (configuración de usuario conservada)');
  console.log('\nTarea programada eliminada. La configuración en');
  console.log(`${SUPPORT_DIR} NO se borró.`);
}

module.exports = { main };

if (require.main === module) {
  main();
}
