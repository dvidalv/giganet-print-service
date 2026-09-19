'use strict';

const {
  getConfig,
  resolvePrinterNameFromConfig,
  PRINT_ROLE_KEYS,
  lpOptionsForRole,
  lpOptionsForPrinter,
} = require('../config');
const cupsService = require('./cupsService');
const pdfPrinter = require('../printers/pdfPrinter');
const rawPrinter = require('../printers/rawPrinter');
const escposPrinter = require('../printers/escposPrinter');

function createError(code, message, status = 400) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
}

/**
 * @param {{ printer?: string, role?: string }} [opts]
 */
async function resolvePrinter(opts = {}) {
  const requested =
    typeof opts === 'string'
      ? opts
      : resolvePrinterNameFromConfig({
          printer: opts.printer,
          role: opts.role,
        });

  const name = String(requested || '').trim();

  if (!name) {
    throw createError(
      'NO_DEFAULT_PRINTER',
      'No se indicó impresora y no hay impresora predeterminada configurada',
      400
    );
  }

  const printer = await cupsService.getPrinter(name);
  if (!printer) {
    throw createError('PRINTER_NOT_FOUND', 'La impresora indicada no existe', 404);
  }

  if (!printer.enabled || printer.status === 'disabled' || printer.status === 'stopped') {
    throw createError(
      'PRINTER_OFFLINE',
      'La impresora está offline o deshabilitada',
      503
    );
  }

  return printer.name;
}

function normalizeCopies(copies) {
  const n = copies === undefined || copies === null ? 1 : Number(copies);
  if (!Number.isInteger(n) || n < 1 || n > 99) {
    throw createError('INVALID_COPIES', 'El número de copias debe ser un entero entre 1 y 99');
  }
  return n;
}

function normalizeRole(role) {
  if (role === undefined || role === null || role === '') return undefined;
  const key = String(role).trim().toLowerCase();
  if (!PRINT_ROLE_KEYS.includes(key)) {
    throw createError(
      'INVALID_PRINT_ROLE',
      `Role de impresión no válido: ${role}. Use: ${PRINT_ROLE_KEYS.join(', ')}`
    );
  }
  return key;
}

/**
 * Despacha la impresión según type: pdf | raw | escpos
 */
async function printDocument(payload) {
  const config = getConfig();
  const type = String(payload.type || 'pdf').toLowerCase();
  const copies = normalizeCopies(payload.copies);
  const role = normalizeRole(payload.role);
  const printer = await resolvePrinter({
    printer: payload.printer,
    role,
  });
  const timeoutMs = config.printTimeoutMs || 30000;

  if (!payload.data) {
    throw createError('INVALID_BASE64', 'Falta el campo data (Base64)');
  }

  const roleLpOptions = lpOptionsForRole(role);
  const printerLpOptions = lpOptionsForPrinter(printer);
  const combinedLpOptions = [...roleLpOptions, ...printerLpOptions];

  switch (type) {
    case 'pdf':
      return pdfPrinter.printPdf({
        printer,
        data: payload.data,
        copies,
        timeoutMs,
        lpOptions: combinedLpOptions,
      });
    case 'raw':
      return rawPrinter.printRaw({
        printer,
        data: payload.data,
        copies,
        timeoutMs,
      });
    case 'escpos':
      return escposPrinter.printEscPos({
        printer,
        data: payload.data,
        copies,
        timeoutMs,
      });
    default:
      throw createError(
        'UNSUPPORTED_TYPE',
        `Tipo de impresión no soportado: ${type}. Use pdf, raw o escpos`
      );
  }
}

async function listPrinters() {
  return cupsService.listPrinters();
}

/**
 * Genera un PDF mínimo válido para prueba (una página A4 con texto).
 * Sin dependencias externas — PDF escrito a mano.
 */
function buildTestPdf({ printerName, when, role }) {
  const lines = [
    'Giganet Print Service',
    'Prueba de impresion correcta.',
    `Impresora: ${printerName}`,
    role ? `Role: ${role}` : null,
    `Fecha: ${when}`,
    'Servicio: OK',
  ].filter(Boolean);

  let mediaBox = [0, 0, 612, 792];
  let startY = 750;
  let fontSize = 16;
  if (role === 'label') {
    mediaBox = [0, 0, 144, 72];
    startY = 56;
    fontSize = 7;
  } else if (role === 'ticket') {
    mediaBox = [0, 0, 227, 400];
    startY = 370;
    fontSize = 11;
  }

  const contentLines = [
    'BT',
    `/F1 ${fontSize} Tf`,
    `${role === 'label' ? 8 : 50} ${startY} Td`,
    `${role === 'label' ? 9 : 20} TL`,
  ];
  lines.forEach((line, i) => {
    const escaped = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    if (i === 0) {
      contentLines.push(`(${escaped}) Tj`);
    } else {
      contentLines.push('T*');
      contentLines.push(`(${escaped}) Tj`);
    }
  });
  contentLines.push('ET');
  const stream = contentLines.join('\n');

  const objects = [];
  objects.push('1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n');
  objects.push('2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n');
  objects.push(
    `3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [${mediaBox.join(' ')}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n`
  );
  objects.push(
    `4 0 obj<< /Length ${Buffer.byteLength(stream, 'utf8')} >>stream\n${stream}\nendstream\nendobj\n`
  );
  objects.push('5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n');

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }
  const xrefPos = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefPos}\n%%EOF\n`;

  return Buffer.from(pdf, 'utf8');
}

/**
 * @param {{ printer?: string, role?: string } | string} [opts]
 */
async function testPrint(opts = {}) {
  const printerOpt = typeof opts === 'string' ? { printer: opts } : opts || {};
  const role = normalizeRole(printerOpt.role);
  const printer = await resolvePrinter({
    printer: printerOpt.printer,
    role,
  });
  const when = new Date()
    .toLocaleString('sv-SE', { hour12: false })
    .replace('T', ' ')
    .slice(0, 16);
  const pdf = buildTestPdf({ printerName: printer, when, role });
  const data = pdf.toString('base64');

  return printDocument({
    printer,
    role,
    type: 'pdf',
    data,
    copies: 1,
  });
}

module.exports = {
  printDocument,
  listPrinters,
  testPrint,
  resolvePrinter,
};
