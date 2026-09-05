'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const TEMP_DIR = path.join(os.tmpdir(), 'giganet-print-service');

function ensureTempDir() {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true, mode: 0o700 });
  }
}

function stripDataUrl(base64) {
  if (typeof base64 !== 'string') {
    return null;
  }
  const trimmed = base64.trim();
  const match = trimmed.match(/^data:[^;]+;base64,(.+)$/i);
  return match ? match[1] : trimmed;
}

function decodeBase64(base64) {
  const cleaned = stripDataUrl(base64);
  if (!cleaned) {
    const err = new Error('Base64 inválido o vacío');
    err.code = 'INVALID_BASE64';
    throw err;
  }

  // Basic validation: only base64 alphabet and padding
  if (!/^[A-Za-z0-9+/=\s]+$/.test(cleaned)) {
    const err = new Error('Base64 inválido');
    err.code = 'INVALID_BASE64';
    throw err;
  }

  let buffer;
  try {
    buffer = Buffer.from(cleaned.replace(/\s+/g, ''), 'base64');
  } catch {
    const err = new Error('No se pudo decodificar Base64');
    err.code = 'INVALID_BASE64';
    throw err;
  }

  if (!buffer.length) {
    const err = new Error('Base64 vacío');
    err.code = 'INVALID_BASE64';
    throw err;
  }

  // Round-trip check catches many corrupt inputs
  const reencoded = buffer.toString('base64').replace(/=+$/, '');
  const original = cleaned.replace(/\s+/g, '').replace(/=+$/, '');
  if (reencoded !== original && Buffer.from(cleaned.replace(/\s+/g, ''), 'base64').length === 0) {
    const err = new Error('Base64 inválido');
    err.code = 'INVALID_BASE64';
    throw err;
  }

  return buffer;
}

function createTempFile(buffer, extension = '.bin') {
  ensureTempDir();
  const name = `print-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${extension}`;
  const filePath = path.join(TEMP_DIR, name);
  fs.writeFileSync(filePath, buffer, { mode: 0o600 });
  return filePath;
}

function removeTempFile(filePath) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // ignore cleanup errors
  }
}

function withTempFile(buffer, extension, fn) {
  const filePath = createTempFile(buffer, extension);
  return Promise.resolve()
    .then(() => fn(filePath))
    .finally(() => removeTempFile(filePath));
}

module.exports = {
  TEMP_DIR,
  decodeBase64,
  createTempFile,
  removeTempFile,
  withTempFile,
};
