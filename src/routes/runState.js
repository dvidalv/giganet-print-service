'use strict';

const { updateConfig, getConfig } = require('../config');
const logger = require('../utils/logger');

function isLoopbackHost(req) {
  const host = (req.get('Host') || '').split(':')[0].toLowerCase();
  return host === '127.0.0.1' || host === 'localhost';
}

function respondPaused(req, res, paused) {
  if (!isLoopbackHost(req)) {
    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      message: 'Solo permitido desde esta Mac (localhost)',
    });
  }
  const updated = updateConfig({ paused: Boolean(paused) });
  logger.requestLog({
    endpoint: req.path,
    success: true,
    message: updated.paused ? 'Impresión pausada' : 'Impresión reanudada',
  });
  res.json({
    success: true,
    paused: Boolean(updated.paused),
    status: updated.paused ? 'paused' : 'online',
    message: updated.paused
      ? 'Servicio pausado. LPCR no imprimirá hasta que pulses Iniciar.'
      : 'Servicio en línea.',
  });
}

function handleStop(req, res) {
  return respondPaused(req, res, true);
}

function handleStart(req, res) {
  return respondPaused(req, res, false);
}

function rejectIfPaused(res) {
  const config = getConfig();
  if (!config.paused) return false;
  res.status(503).json({
    success: false,
    error: 'SERVICE_PAUSED',
    message:
      'El servicio de impresión está detenido. En /settings pulsa Iniciar servicio.',
  });
  return true;
}

module.exports = {
  handleStop,
  handleStart,
  rejectIfPaused,
};
