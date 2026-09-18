'use strict';

const express = require('express');
const printerService = require('../services/printerService');
const logger = require('../utils/logger');
const { rejectIfPaused } = require('./runState');

const router = express.Router();

router.post('/', async (req, res) => {
  if (rejectIfPaused(res)) return;
  const body = req.body || {};
  try {
    const result = await printerService.testPrint({
      printer: body.printer,
      role: body.role,
    });
    logger.requestLog({
      endpoint: '/test-print',
      printer: result.printer,
      success: true,
      message: 'Prueba de impresión enviada',
    });
    res.json({
      success: true,
      message: 'Prueba de impresión enviada',
      printer: result.printer,
    });
  } catch (err) {
    const map = {
      PRINTER_NOT_FOUND: 404,
      PRINTER_OFFLINE: 503,
      PRINT_TIMEOUT: 504,
      LP_ERROR: 500,
      NO_DEFAULT_PRINTER: 400,
      INVALID_PRINT_ROLE: 400,
    };
    logger.requestLog({
      endpoint: '/test-print',
      printer: body.printer || null,
      success: false,
      errorCode: err.code || 'TEST_PRINT_ERROR',
      message: err.message,
    });
    res.status(map[err.code] || 400).json({
      success: false,
      error: err.code || 'TEST_PRINT_ERROR',
      message: err.message || 'Error en prueba de impresión',
    });
  }
});

module.exports = router;
