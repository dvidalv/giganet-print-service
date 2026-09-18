'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const {
  ensureSupportDir,
  loadConfig,
  updateConfig,
  CONFIG_PATH,
  SUPPORT_DIR,
  SERVICE_NAME,
} = require('../src/config');
const logger = require('../src/utils/logger');

const LABEL = 'com.giganet.printservice';
const PLIST_PATH = path.join(os.homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const NODE_BIN = process.execPath;
const SERVER_JS = path.join(PROJECT_ROOT, 'src', 'server.js');
const LOG_DIR = path.join(os.homedir(), 'Library', 'Logs', 'GiganetPrintService');

function ensureDirs() {
  ensureSupportDir();
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true, mode: 0o700 });
  }
  const agentsDir = path.dirname(PLIST_PATH);
  if (!fs.existsSync(agentsDir)) {
    fs.mkdirSync(agentsDir, { recursive: true });
  }
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildPlist() {
  const stdoutLog = path.join(LOG_DIR, 'launchd.stdout.log');
  const stderrLog = path.join(LOG_DIR, 'launchd.stderr.log');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${escapeXml(NODE_BIN)}</string>
    <string>${escapeXml(SERVER_JS)}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${escapeXml(PROJECT_ROOT)}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${escapeXml(stdoutLog)}</string>
  <key>StandardErrorPath</key>
  <string>${escapeXml(stderrLog)}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin</string>
  </dict>
</dict>
</plist>
`;
}

function launchctl(...args) {
  try {
    return execFileSync('launchctl', args, { encoding: 'utf8' });
  } catch (err) {
    const msg = (err.stderr || err.message || '').toString();
    // Ignore "not loaded" style errors on bootout
    if (/not loaded|Could not find|No such process/i.test(msg)) {
      return '';
    }
    throw err;
  }
}

function freeListenPort(port) {
  let pids = [];
  try {
    const out = execFileSync('lsof', ['-ti', `tcp:${port}`], { encoding: 'utf8' });
    pids = out
      .split(/\s+/)
      .map((s) => Number(s))
      .filter((n) => n && n !== process.pid);
  } catch {
    return;
  }
  if (!pids.length) return;
  console.log(`Puerto ${port} ocupado por PID ${pids.join(', ')}; se detiene para reinstalar.`);
  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      /* ya no existe */
    }
  }
  const until = Date.now() + 1500;
  while (Date.now() < until) {
    try {
      execFileSync('lsof', ['-ti', `tcp:${port}`], { encoding: 'utf8', stdio: 'pipe' });
    } catch {
      return;
    }
  }
  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      /* ignore */
    }
  }
}

function uidDomain() {
  return `gui/${process.getuid()}`;
}

function main() {
  if (process.platform !== 'darwin') {
    console.error('install-service solo está soportado en macOS.');
    process.exit(1);
  }

  console.log(`Instalando ${SERVICE_NAME}…`);
  ensureDirs();

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

  // Unload previous if present
  try {
    launchctl('bootout', uidDomain(), PLIST_PATH);
  } catch {
    // ignore
  }

  freeListenPort(config.port || 9100);

  fs.writeFileSync(PLIST_PATH, buildPlist(), { encoding: 'utf8', mode: 0o644 });
  console.log(`LaunchAgent: ${PLIST_PATH}`);

  launchctl('bootstrap', uidDomain(), PLIST_PATH);
  launchctl('enable', `${uidDomain()}/${LABEL}`);
  try {
    launchctl('kickstart', '-k', `${uidDomain()}/${LABEL}`);
  } catch (err) {
    console.warn('Advertencia al iniciar con kickstart:', err.message);
  }

  logger.info('Servicio instalado vía LaunchAgent', { plist: PLIST_PATH });

  console.log('\nListo.');
  console.log(`  Status:   http://127.0.0.1:${config.port}/status`);
  console.log(`  Settings: http://127.0.0.1:${config.port}/settings`);
  try {
    const status = execFileSync(
      'curl',
      ['-sS', '--max-time', '2', `http://127.0.0.1:${config.port}/status`],
      { encoding: 'utf8' }
    );
    console.log(`  Verificación: ${status.trim()}`);
  } catch {
    console.warn('  No se pudo leer /status todavía; espera un segundo y recarga /settings.');
  }
  console.log('\nEl servicio arrancará automáticamente al iniciar sesión.');
}

main();
