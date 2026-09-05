'use strict';

const { getConfig } = require('../config');
const logger = require('../utils/logger');

const API_KEY_HEADER = 'x-giganet-print-key';

function apiKeyMiddleware(req, res, next) {
  // /status is public; /settings HTML is served separately without this middleware
  if (req.path === '/status' || req.path === '/status/') {
    return next();
  }

  const config = getConfig();
  const provided = req.get(API_KEY_HEADER) || req.get('X-Giganet-Print-Key') || '';

  if (!config.apiKey) {
    logger.error('API key no configurada', { endpoint: req.path });
    return res.status(500).json({
      success: false,
      error: 'API_KEY_NOT_CONFIGURED',
      message: 'El servicio no tiene API Key configurada',
    });
  }

  if (!provided || provided !== config.apiKey) {
    logger.warn('API Key incorrecta', { endpoint: req.path });
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'API Key incorrecta o ausente',
    });
  }

  return next();
}

module.exports = {
  apiKeyMiddleware,
  API_KEY_HEADER,
};
