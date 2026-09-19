'use strict';

const path = require('path');
const os = require('os');

const SERVICE_FOLDER = 'GiganetPrintService';
const WINDOWS_TASK_NAME = 'GiganetPrintService';
const LAUNCH_AGENT_LABEL = 'com.giganet.printservice';

function isWindows() {
  return process.platform === 'win32';
}

function isMac() {
  return process.platform === 'darwin';
}

function isSupportedPlatform() {
  return isWindows() || isMac();
}

function platformLabel() {
  if (isWindows()) return 'Windows';
  if (isMac()) return 'macOS';
  return process.platform;
}

function platformId() {
  if (isWindows()) return 'windows';
  if (isMac()) return 'macos';
  return process.platform;
}

function getSupportDir() {
  if (isWindows()) {
    const roaming =
      process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(roaming, SERVICE_FOLDER);
  }
  return path.join(os.homedir(), 'Library', 'Application Support', SERVICE_FOLDER);
}

function getLogDir() {
  if (isWindows()) {
    const local =
      process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(local, SERVICE_FOLDER, 'logs');
  }
  return path.join(os.homedir(), 'Library', 'Logs', SERVICE_FOLDER);
}

function getToolsDir() {
  if (isWindows()) {
    const local =
      process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(local, SERVICE_FOLDER, 'tools');
  }
  return path.join(getSupportDir(), 'tools');
}

function getLaunchAgentPlistPath() {
  return path.join(
    os.homedir(),
    'Library',
    'LaunchAgents',
    `${LAUNCH_AGENT_LABEL}.plist`
  );
}

function getConfigPath() {
  return path.join(getSupportDir(), 'config.json');
}

module.exports = {
  SERVICE_FOLDER,
  WINDOWS_TASK_NAME,
  LAUNCH_AGENT_LABEL,
  isWindows,
  isMac,
  isSupportedPlatform,
  platformLabel,
  platformId,
  getSupportDir,
  getLogDir,
  getToolsDir,
  getLaunchAgentPlistPath,
  getConfigPath,
};
