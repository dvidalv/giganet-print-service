'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const LABEL = 'com.giganet.printservice';
const PLIST_PATH = path.join(os.homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);

function uidDomain() {
  return `gui/${process.getuid()}`;
}

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

/**
 * Para el LaunchAgent para que KeepAlive no vuelva a levantar el proceso.
 * Conserva el plist; install-service lo vuelve a habilitar.
 */
function stopLaunchAgent() {
  if (process.platform !== 'darwin') {
    return { ok: true, launchAgent: false };
  }
  try {
    launchctl('bootout', uidDomain(), PLIST_PATH);
  } catch {
    try {
      launchctl('unload', PLIST_PATH);
    } catch {
      /* npm start sin LaunchAgent */
    }
  }
  try {
    launchctl('disable', `${uidDomain()}/${LABEL}`);
  } catch {
    /* ignore */
  }
  return {
    ok: true,
    launchAgent: fs.existsSync(PLIST_PATH),
    plist: PLIST_PATH,
  };
}

module.exports = {
  LABEL,
  PLIST_PATH,
  stopLaunchAgent,
};
