'use strict';

const { getConfig } = require('../config');
const logger = require('../utils/logger');

function isLocalHost(hostHeader) {
  if (!hostHeader) return false;
  const host = hostHeader.split(':')[0].toLowerCase();
  return host === '127.0.0.1' || host === 'localhost';
}

function isLoopbackOrigin(origin) {
  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    return hostname === '127.0.0.1' || hostname === 'localhost';
  } catch {
    return false;
  }
}

function corsMiddleware(req, res, next) {
  const config = getConfig();
  const origin = req.get('Origin');
  const allowed = config.allowedOrigins || [];

  // Same-origin settings UI and tools without Origin (curl) from loopback
  if (!origin) {
    if (isLocalHost(req.get('Host'))) {
      res.setHeader('Vary', 'Origin');
      return next();
    }
    logger.warn('Solicitud sin Origin rechazada', { endpoint: req.path });
    return res.status(403).json({
      success: false,
      error: 'CORS_ORIGIN_REQUIRED',
      message: 'Se requiere header Origin para solicitudes remotas',
    });
  }

  const settingsOrigin =
    origin === `http://127.0.0.1:${config.port}` ||
    origin === `http://localhost:${config.port}`;

  // Loopback pages (cualquier puerto de Next) pueden hablar con el servicio local
  if (!allowed.includes(origin) && !settingsOrigin && !isLoopbackOrigin(origin)) {
    logger.warn('Origen CORS no permitido', { origin, endpoint: req.path });
    return res.status(403).json({
      success: false,
      error: 'CORS_ORIGIN_NOT_ALLOWED',
      message: 'Origen CORS no permitido',
    });
  }

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Vary', 'Origin');
  return handlePreflight(req, res, next);
}

function handlePreflight(req, res, next) {
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, OPTIONS'
  );
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Giganet-Print-Key');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  return next();
}

module.exports = {
  corsMiddleware,
};
