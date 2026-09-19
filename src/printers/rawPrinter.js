'use strict';

const { decodeBase64, withTempFile } = require('../utils/tempFiles');
const printBackend = require('../services/printBackend');

/**
 * Imprime datos binarios crudos (p. ej. tickets): lp -o raw en macOS, RAW spooler en Windows.
 * Útil como base para ESC/POS y otros lenguajes de impresora térmica.
 */
async function printRaw({ printer, data, copies = 1, timeoutMs = 30000, extension = '.bin' }) {
  const buffer = decodeBase64(data);

  return withTempFile(buffer, extension, async (filePath) => {
    const result = await printBackend.printFile({
      printer,
      filePath,
      copies,
      raw: true,
      timeoutMs,
    });
    return {
      success: true,
      message: 'Datos raw enviados a impresión',
      printer,
      jobInfo: result.stdout || null,
    };
  });
}

module.exports = {
  printRaw,
};
