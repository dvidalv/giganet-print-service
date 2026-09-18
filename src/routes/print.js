'use strict';

const express = require('express');
const printerService = require('../services/printerService');
const logger = require('../utils/logger');
const { rejectIfPaused } = require('./runState');

const router = express.Router();

function sendError(res, err) {
  const status = err.status || (err.code === 'PRINTER_NOT_FOUND' ? 404 : 400);
  const map = {
    PRINTER_NOT_FOUND: 404,
    PRINTER_OFFLINE: 503,
    PRINT_TIMEOUT: 504,
    LP_ERROR: 500,
    NO_DEFAULT_PRINTER: 400,
    INVALID_BASE64: 400,
    INVALID_PDF: 400,
    INVALID_COPIES: 400,
    UNSUPPORTED_TYPE: 400,
  };
  const code = err.code || 'PRINT_ERROR';
  res.status(map[code] || status).json({
    success: false,
    error: code,
    message: err.message || 'Error de impresión',
  });
}

router.post('/', async (req, res) => {
  if (rejectIfPaused(res)) return;
  const body = req.body || {};
  const printerHint = body.printer || null;

  try {
    const result = await printerService.printDocument(body);
    logger.requestLog({
      endpoint: '/print',
      printer: result.printer,
      success: true,
      message: result.message,
    });
    res.json({
      success: true,
      message: result.message,
      printer: result.printer,
    });
  } catch (err) {
    logger.requestLog({
      endpoint: '/print',
      printer: printerHint,
      success: false,
      errorCode: err.code || 'PRINT_ERROR',
      message: err.message,
    });
    sendError(res, err);
  }
});

module.exports = router;
