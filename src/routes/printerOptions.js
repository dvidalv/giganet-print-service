'use strict';

const express = require('express');
const { getConfig, updateConfig, normalizeOrientation } = require('../config');
const logger = require('../utils/logger');

const router = express.Router();

router.get('/', (req, res) => {
  const config = getConfig();
  res.json({
    success: true,
    printerOptions: config.printerOptions || {},
  });
});

router.get('/:printerName', (req, res) => {
  const { printerName } = req.params;
  const config = getConfig();
  const options = config.printerOptions?.[printerName] || {};
  res.json({
    success: true,
    printer: printerName,
    options,
  });
});

router.put('/:printerName', (req, res) => {
  const { printerName } = req.params;
  const { media, orientation } = req.body;

  if (!printerName || printerName.trim() === '') {
    return res.status(400).json({
      success: false,
      error: 'INVALID_PRINTER_NAME',
      message: 'El nombre de la impresora es requerido',
    });
  }

  const options = {};
  if (media !== undefined && media !== null && media !== '') {
    options.media = String(media).trim();
  }
  if (orientation !== undefined && orientation !== null && orientation !== '') {
    const orient = normalizeOrientation(orientation);
    if (!orient) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_ORIENTATION',
        message:
          'Orientación inválida. Use: portrait, landscape, reverse-portrait, reverse-landscape, o 3–6',
      });
    }
    options.orientation = orient;
  }

  try {
    const config = getConfig();
    const newPrinterOptions = { ...(config.printerOptions || {}) };
    if (Object.keys(options).length === 0) {
      delete newPrinterOptions[printerName];
    } else {
      newPrinterOptions[printerName] = options;
    }

    updateConfig({ printerOptions: newPrinterOptions });

    logger.requestLog({
      endpoint: '/printer-options/:printerName',
      printer: printerName,
      success: true,
      message: 'Opciones de impresora actualizadas',
    });

    res.json({
      success: true,
      message: 'Opciones de impresora actualizadas correctamente',
      printer: printerName,
      options: newPrinterOptions[printerName],
    });
  } catch (err) {
    logger.requestLog({
      endpoint: '/printer-options/:printerName',
      printer: printerName,
      success: false,
      errorCode: err.code || 'UPDATE_ERROR',
      message: err.message,
    });
    res.status(500).json({
      success: false,
      error: err.code || 'UPDATE_ERROR',
      message: err.message || 'Error al actualizar opciones de impresora',
    });
  }
});

router.delete('/:printerName', (req, res) => {
  const { printerName } = req.params;

  if (!printerName || printerName.trim() === '') {
    return res.status(400).json({
      success: false,
      error: 'INVALID_PRINTER_NAME',
      message: 'El nombre de la impresora es requerido',
    });
  }

  try {
    const config = getConfig();
    const newPrinterOptions = { ...config.printerOptions };
    delete newPrinterOptions[printerName];

    updateConfig({ printerOptions: newPrinterOptions });

    logger.requestLog({
      endpoint: '/printer-options/:printerName',
      printer: printerName,
      success: true,
      message: 'Opciones de impresora eliminadas',
    });

    res.json({
      success: true,
      message: 'Opciones de impresora eliminadas correctamente',
      printer: printerName,
    });
  } catch (err) {
    logger.requestLog({
      endpoint: '/printer-options/:printerName',
      printer: printerName,
      success: false,
      errorCode: err.code || 'DELETE_ERROR',
      message: err.message,
    });
    res.status(500).json({
      success: false,
      error: err.code || 'DELETE_ERROR',
      message: err.message || 'Error al eliminar opciones de impresora',
    });
  }
});

module.exports = router;
