'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { SERVICE_NAME } = require('../src/config');
const logger = require('../src/utils/logger');

const LABEL = 'com.giganet.printservice';
const PLIST_PATH = path.join(os.homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);

function launchctl(...args) {
  try {
    return execFileSync('launchctl', args, { encoding: 'utf8' });
  } catch (err) {
    const msg = (err.stderr || err.message || '').toString();
    if (/not loaded|Could not find|No such process/i.test(msg)) {
      return '';
    }
    throw err;
  }
}

function uidDomain() {
  return `gui/${process.getuid()}`;
}

function main() {
  if (process.platform === 'win32') {
    return require('./uninstall-windows').main();
  }
  if (process.platform !== 'darwin') {
    console.error('uninstall-service solo está soportado en macOS y Windows.');
    process.exit(1);
  }

  console.log(`Desinstalando ${SERVICE_NAME}…`);

  try {
    launchctl('bootout', uidDomain(), PLIST_PATH);
  } catch {
    try {
      launchctl('unload', PLIST_PATH);
    } catch {
      // ignore
    }
  }

  if (fs.existsSync(PLIST_PATH)) {
    fs.unlinkSync(PLIST_PATH);
    console.log(`Eliminado: ${PLIST_PATH}`);
  } else {
    console.log('No se encontró el plist (ya desinstalado).');
  }

  logger.info('Servicio desinstalado (configuración de usuario conservada)');
  console.log('\nLaunchAgent eliminado. La configuración en');
  console.log('~/Library/Application Support/GiganetPrintService/ NO se borró.');
}

main();
