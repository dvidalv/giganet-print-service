'use strict';

const PT_PER_MM = 72 / 25.4;

/**
 * Tamaño de la primera página de un PDF (MediaBox) en puntos, o null si no se
 * puede leer (p. ej. diccionarios dentro de object streams comprimidos).
 * Los PDF de Chromium/Puppeteer escriben el MediaBox en texto plano.
 *
 * @param {Buffer} buffer
 * @returns {{ widthPt: number, heightPt: number } | null}
 */
function pdfFirstPageSizePt(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return null;
  const text = buffer.toString('latin1');
  const match = text.match(
    /\/MediaBox\s*\[\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*\]/
  );
  if (!match) return null;

  const [x0, y0, x1, y1] = match.slice(1, 5).map(Number);
  const widthPt = Math.abs(x1 - x0);
  const heightPt = Math.abs(y1 - y0);
  if (!Number.isFinite(widthPt) || !Number.isFinite(heightPt)) return null;
  return { widthPt, heightPt };
}

/**
 * Tamaño de la primera página de un PDF en mm enteros, o null si no se puede leer.
 *
 * @param {Buffer} buffer
 * @returns {{ widthMm: number, heightMm: number } | null}
 */
function pdfFirstPageSizeMm(buffer) {
  const size = pdfFirstPageSizePt(buffer);
  if (!size) return null;
  const widthMm = size.widthPt / PT_PER_MM;
  const heightMm = size.heightPt / PT_PER_MM;
  if (widthMm < 10 || heightMm < 10) return null;

  // Chromium deja 80 mm en 80.1; los drivers térmicos rechazan anchos mayores
  // al rollo. El alto se redondea hacia arriba para no recortar la última línea.
  return {
    widthMm: Math.round(widthMm),
    heightMm: Math.ceil(heightMm),
  };
}

module.exports = { pdfFirstPageSizeMm, pdfFirstPageSizePt };
