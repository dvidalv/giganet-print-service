'use strict';

const { decodeBase64, withTempFile } = require('../utils/tempFiles');
const cupsService = require('../services/cupsService');

function assertValidPdf(buffer) {
  // PDF magic: %PDF-
  if (buffer.length < 5 || buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    const err = new Error('El contenido no es un PDF válido');
    err.code = 'INVALID_PDF';
    throw err;
  }
}

/**
 * Imprime un PDF en Base64 mediante CUPS (lp).
 */
async function printPdf({ printer, data, copies = 1, timeoutMs = 30000, lpOptions = [] }) {
  const buffer = decodeBase64(data);
  assertValidPdf(buffer);

  return withTempFile(buffer, '.pdf', async (filePath) => {
    const result = await cupsService.printFile({
      printer,
      filePath,
      copies,
      raw: false,
      timeoutMs,
      lpOptions,
    });
    return {
      success: true,
      message: 'Documento enviado a impresión',
      printer,
      jobInfo: result.stdout || null,
    };
  });
}

module.exports = {
  printPdf,
  assertValidPdf,
};
