'use strict';

const logger = require('../utils/logger');
const { stopLaunchAgent } = require('../utils/launchAgent');

function isLoopbackHost(req) {
  const host = (req.get('Host') || '').split(':')[0].toLowerCase();
  return host === '127.0.0.1' || host === 'localhost';
}

function handleShutdown(req, res) {
  if (!isLoopbackHost(req)) {
    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      message: 'El apagado solo está permitido desde esta Mac (localhost)',
    });
  }

  const server = req.app.get('httpServer');
  if (!server) {
    return res.status(503).json({
      success: false,
      error: 'SHUTDOWN_UNAVAILABLE',
      message: 'Este proceso no admite apagado. Reinicia con npm run install-service.',
    });
  }

  let launchAgent = false;
  try {
    const result = stopLaunchAgent();
    launchAgent = Boolean(result.launchAgent);
  } catch (err) {
    logger.warn('No se pudo desactivar el LaunchAgent', { message: err.message });
  }

  logger.requestLog({
    endpoint: req.path,
    success: true,
    message: 'Apagado solicitado desde /settings',
  });

  res.json({
    success: true,
    message: 'Servicio deteniéndose. Para volver a iniciarlo: npm run install-service',
    launchAgent,
  });

  res.on('finish', () => {
    setTimeout(() => {
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 2500).unref();
    }, 150);
  });
}

module.exports = { handleShutdown };
