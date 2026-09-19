'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const logger = require('./utils/logger');

const SERVICE_NAME = 'Giganet Print Service';
const SERVICE_VERSION = '1.2.6';

/** Roles LPCR: etiqueta Zebra, recibo Epson 80mm, factura/estudio carta. */
const PRINT_ROLE_KEYS = ['label', 'ticket', 'factura', 'estudio'];

/** Opciones `lp -o` por role (tamaño de papel CUPS). */
const ROLE_LP_OPTIONS = {
  label: ['media=Custom.2x1in', 'fit-to-page'],
  ticket: ['fit-to-page'],
  factura: ['media=Letter', 'fit-to-page'],
  estudio: ['media=Letter', 'fit-to-page'],
};

function lpOptionsForRole(role) {
  const key = String(role || '').trim().toLowerCase();
  return ROLE_LP_OPTIONS[key] ? [...ROLE_LP_OPTIONS[key]] : [];
}

const SUPPORT_DIR = path.join(
  os.homedir(),
  'Library',
  'Application Support',
  'GiganetPrintService'
);
const CONFIG_PATH = path.join(SUPPORT_DIR, 'config.json');
const DEFAULT_CONFIG_PATH = path.join(__dirname, '..', 'config', 'default.json');

/** @type {object | null} */
let cachedConfig = null;

function ensureSupportDir() {
  if (!fs.existsSync(SUPPORT_DIR)) {
    fs.mkdirSync(SUPPORT_DIR, { recursive: true, mode: 0o700 });
  }
}

function generateApiKey() {
  return crypto.randomBytes(32).toString('hex');
}

function readDefaultConfig() {
  const raw = fs.readFileSync(DEFAULT_CONFIG_PATH, 'utf8');
  return JSON.parse(raw);
}

function normalizePrinterRoles(rawRoles, defaults) {
  const base =
    defaults && typeof defaults === 'object'
      ? { ...defaults }
      : Object.fromEntries(PRINT_ROLE_KEYS.map((k) => [k, '']));
  const incoming = rawRoles && typeof rawRoles === 'object' ? rawRoles : {};
  const out = {};
  for (const key of PRINT_ROLE_KEYS) {
    const value = incoming[key] !== undefined ? incoming[key] : base[key];
    out[key] = String(value || '').trim();
  }
  return out;
}

function normalizePrinterOptions(rawOptions) {
  if (!rawOptions || typeof rawOptions !== 'object') {
    return {};
  }
  const normalized = {};
  for (const [printerName, options] of Object.entries(rawOptions)) {
    if (!options || typeof options !== 'object') continue;
    const opts = {};
    if (options.media) {
      opts.media = String(options.media).trim();
    }
    if (options.orientation) {
      const orient = String(options.orientation).trim();
      if (['portrait', 'landscape', '3', '4'].includes(orient)) {
        opts.orientation = orient === 'portrait' ? '4' : orient === 'landscape' ? '3' : orient;
      }
    }
    if (Object.keys(opts).length > 0) {
      normalized[printerName] = opts;
    }
  }
  return normalized;
}

function loadConfig({ createIfMissing = true } = {}) {
  ensureSupportDir();

  if (!fs.existsSync(CONFIG_PATH)) {
    if (!createIfMissing) {
      return null;
    }
    const defaults = readDefaultConfig();
    const initial = {
      ...defaults,
      printerRoles: normalizePrinterRoles(
        defaults.printerRoles,
        defaults.printerRoles
      ),
      printerOptions: normalizePrinterOptions(defaults.printerOptions),
      apiKey: defaults.apiKey || generateApiKey(),
    };
    writeConfig(initial);
    cachedConfig = initial;
    return { ...initial };
  }

  const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  const defaults = readDefaultConfig();
  const merged = {
    ...defaults,
    ...parsed,
    allowedOrigins: Array.isArray(parsed.allowedOrigins)
      ? parsed.allowedOrigins
      : defaults.allowedOrigins,
    printerRoles: normalizePrinterRoles(
      parsed.printerRoles,
      defaults.printerRoles
    ),
    printerOptions: normalizePrinterOptions(parsed.printerOptions || {}),
  };

  if (!merged.apiKey) {
    merged.apiKey = generateApiKey();
    writeConfig(merged);
  } else if (
    !parsed.printerRoles ||
    PRINT_ROLE_KEYS.some(
      (key) => !Object.prototype.hasOwnProperty.call(parsed.printerRoles, key)
    )
  ) {
    writeConfig(merged);
  }

  cachedConfig = merged;
  return { ...merged };
}

function persistConfigFile(toSave) {
  ensureSupportDir();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(toSave, null, 2) + '\n', {
    encoding: 'utf8',
    mode: 0o600,
  });
}

function writeConfig(config, { optionalPersist = false } = {}) {
  const defaults = readDefaultConfig();
  const toSave = {
    defaultPrinter: config.defaultPrinter || '',
    port: Number(config.port) || 9100,
    host: '127.0.0.1',
    apiKey: config.apiKey,
    allowedOrigins: Array.isArray(config.allowedOrigins)
      ? config.allowedOrigins
      : [],
    printTimeoutMs: Number(config.printTimeoutMs) || 30000,
    paused: config.paused === true,
    printerRoles: normalizePrinterRoles(
      config.printerRoles,
      defaults.printerRoles
    ),
    printerOptions: normalizePrinterOptions(config.printerOptions || {}),
  };
  cachedConfig = toSave;
  try {
    persistConfigFile(toSave);
  } catch (err) {
    if (optionalPersist) {
      logger.warn('No se pudo guardar config.json; el estado queda en memoria', {
        message: err.message,
      });
      return { ...toSave };
    }
    throw err;
  }
  return { ...toSave };
}

function getConfig() {
  if (!cachedConfig) {
    return loadConfig();
  }
  return { 
    ...cachedConfig, 
    printerRoles: { ...cachedConfig.printerRoles },
    printerOptions: { ...cachedConfig.printerOptions }
  };
}

function updateConfig(partial) {
  const current = getConfig();
  const next = { 
    ...current, 
    printerRoles: { ...current.printerRoles },
    printerOptions: { ...current.printerOptions }
  };

  if (partial.defaultPrinter !== undefined) {
    next.defaultPrinter = String(partial.defaultPrinter || '');
  }
  if (partial.port !== undefined) {
    const port = Number(partial.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      const err = new Error('Puerto inválido');
      err.code = 'INVALID_PORT';
      throw err;
    }
    next.port = port;
  }
  if (partial.apiKey !== undefined && partial.apiKey !== '') {
    next.apiKey = String(partial.apiKey);
  }
  if (partial.allowedOrigins !== undefined) {
    if (!Array.isArray(partial.allowedOrigins)) {
      const err = new Error('allowedOrigins debe ser un arreglo');
      err.code = 'INVALID_ORIGINS';
      throw err;
    }
    next.allowedOrigins = partial.allowedOrigins
      .map((o) => String(o).trim())
      .filter(Boolean);
  }
  if (partial.printTimeoutMs !== undefined) {
    const ms = Number(partial.printTimeoutMs);
    if (!Number.isInteger(ms) || ms < 1000) {
      const err = new Error('printTimeoutMs inválido');
      err.code = 'INVALID_TIMEOUT';
      throw err;
    }
    next.printTimeoutMs = ms;
  }
  if (partial.paused !== undefined) {
    next.paused = Boolean(partial.paused);
  }
  if (partial.printerRoles !== undefined) {
    if (!partial.printerRoles || typeof partial.printerRoles !== 'object') {
      const err = new Error('printerRoles debe ser un objeto');
      err.code = 'INVALID_PRINTER_ROLES';
      throw err;
    }
    next.printerRoles = normalizePrinterRoles(
      { ...current.printerRoles, ...partial.printerRoles },
      current.printerRoles
    );
  }
  if (partial.printerOptions !== undefined) {
    if (!partial.printerOptions || typeof partial.printerOptions !== 'object') {
      const err = new Error('printerOptions debe ser un objeto');
      err.code = 'INVALID_PRINTER_OPTIONS';
      throw err;
    }
    next.printerOptions = normalizePrinterOptions({
      ...current.printerOptions,
      ...partial.printerOptions
    });
  }

  const onlyPaused =
    Object.prototype.hasOwnProperty.call(partial, 'paused') &&
    Object.keys(partial).every((key) => key === 'paused');
  return writeConfig(next, { optionalPersist: onlyPaused });
}

function getPublicConfig() {
  const config = getConfig();
  return {
    defaultPrinter: config.defaultPrinter,
    port: config.port,
    host: config.host,
    allowedOrigins: config.allowedOrigins,
    printTimeoutMs: config.printTimeoutMs,
    paused: config.paused === true,
    printerRoles: config.printerRoles,
    printerOptions: config.printerOptions,
    hasApiKey: Boolean(config.apiKey),
  };
}

function getSettingsPageConfig() {
  const config = getConfig();
  return {
    ...getPublicConfig(),
    apiKey: config.apiKey,
  };
}

/**
 * Resuelve nombre de impresora: explícita → role → default.
 * @param {{ printer?: string, role?: string }} opts
 * @returns {string}
 */
function resolvePrinterNameFromConfig({ printer, role } = {}) {
  const config = getConfig();
  const explicit = String(printer || '').trim();
  if (explicit) return explicit;

  const roleKey = String(role || '').trim().toLowerCase();
  if (roleKey && PRINT_ROLE_KEYS.includes(roleKey)) {
    const mapped = String(config.printerRoles?.[roleKey] || '').trim();
    if (mapped) return mapped;
  }

  return String(config.defaultPrinter || '').trim();
}

/**
 * Construye lpOptions desde printerOptions de configuración
 * @param {string} printerName
 * @returns {string[]}
 */
function lpOptionsForPrinter(printerName) {
  const config = getConfig();
  const options = config.printerOptions?.[printerName];
  if (!options || typeof options !== 'object') {
    return [];
  }
  const lpOpts = [];
  if (options.media) {
    lpOpts.push(`media=${options.media}`);
  }
  if (options.orientation) {
    lpOpts.push(`orientation-requested=${options.orientation}`);
  }
  return lpOpts;
}

module.exports = {
  SERVICE_NAME,
  SERVICE_VERSION,
  PRINT_ROLE_KEYS,
  ROLE_LP_OPTIONS,
  lpOptionsForRole,
  lpOptionsForPrinter,
  SUPPORT_DIR,
  CONFIG_PATH,
  ensureSupportDir,
  generateApiKey,
  loadConfig,
  getConfig,
  writeConfig,
  updateConfig,
  getPublicConfig,
  getSettingsPageConfig,
  normalizePrinterRoles,
  normalizePrinterOptions,
  resolvePrinterNameFromConfig,
};
