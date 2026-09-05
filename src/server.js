'use strict';

const http = require('http');
const path = require('path');
const express = require('express');
const {
  SERVICE_NAME,
  SERVICE_VERSION,
  loadConfig,
  getConfig,
  getSettingsPageConfig,
} = require('./config');
const logger = require('./utils/logger');
const { corsMiddleware } = require('./middleware/cors');
const { apiKeyMiddleware } = require('./middleware/apiKey');

const statusRoutes = require('./routes/status');
const printersRoutes = require('./routes/printers');
const printRoutes = require('./routes/print');
const configRoutes = require('./routes/config');
const testPrintRoutes = require('./routes/testPrint');

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '25mb' }));

  // Security: never trust proxy for binding decisions
  app.set('trust proxy', false);

  app.use(corsMiddleware);

  // Public status (no API key) — registered before apiKey middleware
  app.use('/status', statusRoutes);

  // Settings UI (HTML) — loopback only, no API key for the page itself
  app.get('/settings', (req, res) => {
    const host = (req.get('Host') || '').split(':')[0];
    if (host !== '127.0.0.1' && host !== 'localhost') {
      return res.status(403).send('Settings solo disponible en localhost');
    }
    res.sendFile(path.join(__dirname, '..', 'public', 'settings.html'));
  });

  app.get('/settings/bootstrap', (req, res) => {
    const host = (req.get('Host') || '').split(':')[0];
    if (host !== '127.0.0.1' && host !== 'localhost') {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Solo disponible en localhost',
      });
    }
    const cfg = getSettingsPageConfig();
    res.json({
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      ...cfg,
    });
  });

  // Protected API
  app.use(apiKeyMiddleware);
  app.use('/printers', printersRoutes);
  app.use('/print', printRoutes);
  app.use('/config', configRoutes);
  app.use('/test-print', testPrintRoutes);

  app.get('/', (req, res) => {
    res.json({
      status: 'online',
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      settings: `http://127.0.0.1:${getConfig().port}/settings`,
    });
  });

  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: 'NOT_FOUND',
      message: 'Endpoint no encontrado',
    });
  });

  app.use((err, req, res, _next) => {
    logger.error('Error no controlado', {
      endpoint: req.path,
      message: err.message,
    });
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({
        success: false,
        error: 'INVALID_JSON',
        message: 'JSON inválido en el cuerpo de la solicitud',
      });
    }
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Error interno del servidor',
    });
  });

  return app;
}

function start() {
  loadConfig();
  const config = getConfig();
  const host = '127.0.0.1';
  const port = config.port || 9100;

  const app = createApp();
  const server = http.createServer(app);

  server.listen(port, host, () => {
    logger.info(`${SERVICE_NAME} v${SERVICE_VERSION} escuchando`, {
      host,
      port,
      endpoint: `http://${host}:${port}`,
    });
    console.log(`\n${SERVICE_NAME} v${SERVICE_VERSION}`);
    console.log(`  API:      http://${host}:${port}`);
    console.log(`  Settings: http://${host}:${port}/settings`);
    console.log(`  Status:   http://${host}:${port}/status\n`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`Puerto ${port} en uso`, { port });
      console.error(`Error: el puerto ${port} ya está en uso.`);
      process.exit(1);
    }
    logger.error('Error del servidor', { message: err.message });
    process.exit(1);
  });

  const shutdown = (signal) => {
    logger.info(`Apagando (${signal})`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  return server;
}

if (require.main === module) {
  start();
}

module.exports = { createApp, start };
