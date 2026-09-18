'use strict';

const express = require('express');
const {
  getPublicConfig,
  updateConfig,
  getSettingsPageConfig,
} = require('../config');
const logger = require('../utils/logger');

const router = express.Router();

function publicShape(updated, includeApiKey) {
  const base = {
    defaultPrinter: updated.defaultPrinter,
    port: updated.port,
    host: updated.host,
    allowedOrigins: updated.allowedOrigins,
    printTimeoutMs: updated.printTimeoutMs,
    paused: Boolean(updated.paused),
    printerRoles: updated.printerRoles,
  };
  if (includeApiKey) {
    return { ...base, apiKey: updated.apiKey };
  }
  return { ...base, hasApiKey: Boolean(updated.apiKey) };
}

router.get('/', (req, res) => {
  // For local settings UI we may include apiKey when ?full=1 and Host is loopback
  const host = (req.get('Host') || '').split(':')[0];
  const isLoopback = host === '127.0.0.1' || host === 'localhost';
  const wantFull = req.query.full === '1' || req.query.full === 'true';

  if (wantFull && isLoopback) {
    const full = getSettingsPageConfig();
    logger.requestLog({
      endpoint: '/config',
      success: true,
      message: 'Configuración completa (loopback)',
    });
    return res.json(full);
  }

  const publicConfig = getPublicConfig();
  logger.requestLog({
    endpoint: '/config',
    success: true,
    message: 'Configuración pública',
  });
  return res.json(publicConfig);
});

router.post('/', (req, res) => {
  try {
    const body = req.body || {};
    if (body.stopService === true) {
      const { handleStop } = require('./runState');
      return handleStop(req, res);
    }
    if (body.startService === true || body.paused === false) {
      const { handleStart } = require('./runState');
      return handleStart(req, res);
    }
    if (body.paused === true) {
      const { handleStop } = require('./runState');
      return handleStop(req, res);
    }
    const allowed = {};
    if (body.defaultPrinter !== undefined) allowed.defaultPrinter = body.defaultPrinter;
    if (body.allowedOrigins !== undefined) allowed.allowedOrigins = body.allowedOrigins;
    if (body.printTimeoutMs !== undefined) allowed.printTimeoutMs = body.printTimeoutMs;
    if (body.printerRoles !== undefined) allowed.printerRoles = body.printerRoles;
    // Do not allow changing port/host via API while running without restart clarity;
    // port change is accepted into file but requires service restart.
    if (body.port !== undefined) allowed.port = body.port;
    // Regenerating apiKey only if explicitly requested
    if (body.regenerateApiKey === true) {
      const { generateApiKey } = require('../config');
      allowed.apiKey = generateApiKey();
    } else if (typeof body.apiKey === 'string' && body.apiKey.trim().length >= 16) {
      allowed.apiKey = body.apiKey.trim();
    }

    const updated = updateConfig(allowed);
    logger.requestLog({
      endpoint: '/config',
      printer: updated.defaultPrinter || null,
      success: true,
      message: 'Configuración actualizada',
    });

    const host = (req.get('Host') || '').split(':')[0];
    const isLoopback = host === '127.0.0.1' || host === 'localhost';
    res.json({
      success: true,
      message: 'Configuración guardada',
      config: publicShape(updated, isLoopback),
    });
  } catch (err) {
    logger.requestLog({
      endpoint: '/config',
      success: false,
      errorCode: err.code || 'CONFIG_ERROR',
      message: err.message,
    });
    res.status(400).json({
      success: false,
      error: err.code || 'CONFIG_ERROR',
      message: err.message || 'No se pudo guardar la configuración',
    });
  }
});

module.exports = router;
