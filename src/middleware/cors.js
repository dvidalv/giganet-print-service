'use strict';

const { getConfig } = require('../config');
const logger = require('../utils/logger');

function isLocalHost(hostHeader) {
  if (!hostHeader) return false;
  const host = hostHeader.split(':')[0].toLowerCase();
  return host === '127.0.0.1' || host === 'localhost';
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

  if (!allowed.includes(origin)) {
    // Always allow the settings page origin (local service itself)
    if (origin === `http://127.0.0.1:${config.port}` || origin === `http://localhost:${config.port}`) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
      return handlePreflight(req, res, next);
    }

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
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, X-Giganet-Print-Key'
  );
  res.setHeader('Access-Control-Max-Age', '86400');

  // Chrome Local Network Access / Private Network Access preflight support
  if (req.get('Access-Control-Request-Private-Network') === 'true') {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  return next();
}

module.exports = {
  corsMiddleware,
};
