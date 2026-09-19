'use strict';

const rawPrinter = require('./rawPrinter');

/**
 * Impresión ESC/POS.
 *
 * Fase actual: reenvía el payload Base64 como raw (CUPS en macOS, spooler RAW en Windows).
 * Extensión futura: builders de comandos ESC/POS (texto, corte, logo, etc.)
 * sin cambiar el contrato público de /print con type: "escpos".
 *
 * @example
 * // Futuro:
 * // const commands = buildEscPosTicket({ title, lines, cut: true });
 * // return rawPrinter.printRaw({ printer, data: commands.toString('base64'), ... });
 */
async function printEscPos(options) {
  const result = await rawPrinter.printRaw({
    ...options,
    extension: '.escpos',
  });
  return {
    ...result,
    message: 'Datos ESC/POS enviados a impresión (modo raw)',
  };
}

module.exports = {
  printEscPos,
};
