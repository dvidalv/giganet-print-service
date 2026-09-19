'use strict';

const fs = require('fs');
const path = require('path');
const { getLogDir } = require('../platform');

const LOG_DIR = getLogDir();

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true, mode: 0o700 });
  }
}

function todayFile() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return path.join(LOG_DIR, `giganet-print-${y}-${m}-${day}.log`);
}

function formatLine(level, message, meta = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...sanitizeMeta(meta),
  };
  return JSON.stringify(entry);
}

function sanitizeMeta(meta) {
  const out = {};
  for (const [key, value] of Object.entries(meta)) {
    if (key === 'data' || key === 'body' || key === 'pdf' || key === 'content') {
      continue;
    }
    if (typeof value === 'string' && value.length > 500) {
      out[key] = value.slice(0, 500) + '…';
    } else {
      out[key] = value;
    }
  }
  return out;
}

function write(level, message, meta) {
  try {
    ensureLogDir();
    fs.appendFileSync(todayFile(), formatLine(level, message, meta) + '\n', 'utf8');
  } catch {
    // Logging must never crash the service
  }

  const prefix = `[${new Date().toISOString()}] ${level.toUpperCase()}`;
  if (level === 'error') {
    console.error(prefix, message, meta && Object.keys(meta).length ? meta : '');
  } else {
    console.log(prefix, message, meta && Object.keys(meta).length ? meta : '');
  }
}

function info(message, meta) {
  write('info', message, meta);
}

function warn(message, meta) {
  write('warn', message, meta);
}

function error(message, meta) {
  write('error', message, meta);
}

function requestLog({ endpoint, printer, success, errorCode, message }) {
  write(success ? 'info' : 'error', message || (success ? 'OK' : 'Error'), {
    endpoint,
    printer: printer || null,
    success: Boolean(success),
    error: errorCode || null,
  });
}

module.exports = {
  LOG_DIR,
  info,
  warn,
  error,
  requestLog,
};
