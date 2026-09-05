'use strict';

const express = require('express');
const printerService = require('../services/printerService');
const logger = require('../utils/logger');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const printers = await printerService.listPrinters();
    logger.requestLog({
      endpoint: '/printers',
      success: true,
      message: `Listadas ${printers.length} impresoras`,
    });
    res.json({
      printers: printers.map((p) => ({
        name: p.name,
        default: p.default,
        status: p.status,
        enabled: p.enabled,
      })),
    });
  } catch (err) {
    logger.requestLog({
      endpoint: '/printers',
      success: false,
      errorCode: err.code || 'LIST_PRINTERS_ERROR',
      message: err.message,
    });
    res.status(500).json({
      success: false,
      error: err.code || 'LIST_PRINTERS_ERROR',
      message: err.message || 'No se pudieron listar las impresoras',
    });
  }
});

module.exports = router;
