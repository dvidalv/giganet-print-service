/**
 * Ejemplo de configuración de opciones de impresora
 * (tamaño de papel y orientación)
 * 
 * Giganet Print Service v1.2.6+
 */

const SERVICE = 'http://127.0.0.1:9100';
const API_KEY = process.env.GIGANET_PRINT_KEY || 'TU_API_KEY';

/**
 * Configura opciones para una impresora específica
 */
async function configurePrinterOptions(printerName, options) {
  const res = await fetch(`${SERVICE}/printer-options/${printerName}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Giganet-Print-Key': API_KEY,
    },
    body: JSON.stringify(options),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(`${body.error}: ${body.message}`);
  }
  return body;
}

/**
 * Obtiene las opciones configuradas para una impresora
 */
async function getPrinterOptions(printerName) {
  const res = await fetch(`${SERVICE}/printer-options/${printerName}`, {
    method: 'GET',
    headers: {
      'X-Giganet-Print-Key': API_KEY,
    },
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(`${body.error}: ${body.message}`);
  }
  return body;
}

/**
 * Obtiene todas las opciones de impresoras configuradas
 */
async function getAllPrinterOptions() {
  const res = await fetch(`${SERVICE}/printer-options`, {
    method: 'GET',
    headers: {
      'X-Giganet-Print-Key': API_KEY,
    },
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(`${body.error}: ${body.message}`);
  }
  return body;
}

/**
 * Elimina las opciones configuradas para una impresora
 */
async function deletePrinterOptions(printerName) {
  const res = await fetch(`${SERVICE}/printer-options/${printerName}`, {
    method: 'DELETE',
    headers: {
      'X-Giganet-Print-Key': API_KEY,
    },
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(`${body.error}: ${body.message}`);
  }
  return body;
}

// ============================================================================
// EJEMPLOS DE USO
// ============================================================================

async function ejemplos() {
  // 1. Configurar impresora de tickets con papel 80mm (Custom 3x5 inches)
  await configurePrinterOptions('EPSON_TM_T20III', {
    media: 'Custom.3x5in',
    orientation: 'portrait',
  });

  // 2. Configurar impresora de etiquetas Zebra 2x1 pulgadas
  await configurePrinterOptions('Zebra_ZD220', {
    media: 'Custom.2x1in',
    orientation: 'landscape',
  });

  // 3. Configurar impresora de facturas tamaño carta
  await configurePrinterOptions('HP_LaserJet', {
    media: 'Letter',
    orientation: 'portrait',
  });

  // 4. Configurar impresora con tamaño A4 horizontal
  await configurePrinterOptions('Canon_Printer', {
    media: 'A4',
    orientation: 'landscape', // También se puede usar '3'
  });

  // 5. Obtener opciones de una impresora específica
  const options = await getPrinterOptions('EPSON_TM_T20III');
  console.log('Opciones:', options);
  // { success: true, printer: 'EPSON_TM_T20III', options: { media: 'Custom.3x5in', orientation: '4' } }

  // 6. Obtener todas las opciones configuradas
  const allOptions = await getAllPrinterOptions();
  console.log('Todas las opciones:', allOptions);
  // { success: true, printerOptions: { 'EPSON_TM_T20III': {...}, 'Zebra_ZD220': {...} } }

  // 7. Eliminar configuración de una impresora
  await deletePrinterOptions('Canon_Printer');
}

// ============================================================================
// TAMAÑOS DE PAPEL COMUNES
// ============================================================================

const TAMAÑOS_PAPEL = {
  // Tamaños estándar
  Letter: 'media=Letter',           // 8.5 x 11 pulgadas
  Legal: 'media=Legal',             // 8.5 x 14 pulgadas
  A4: 'media=A4',                   // 210 x 297 mm
  A5: 'media=A5',                   // 148 x 210 mm

  // Tamaños personalizados (ejemplos para tickets y etiquetas)
  Ticket80mm: 'media=Custom.80x200mm',     // Tickets térmicos 80mm
  Ticket58mm: 'media=Custom.58x200mm',     // Tickets térmicos 58mm
  Label2x1: 'media=Custom.2x1in',          // Etiquetas 2x1 pulgadas
  Label4x6: 'media=Custom.4x6in',          // Etiquetas 4x6 pulgadas (envíos)
  Label100x50mm: 'media=Custom.100x50mm',  // Etiquetas 100x50mm
};

// ============================================================================
// ORIENTACIONES
// ============================================================================

const ORIENTACIONES = {
  portrait: '4',      // Vertical (portrait)
  landscape: '3',     // Horizontal (landscape)
};

// ============================================================================
// NOTAS IMPORTANTES
// ============================================================================

/*
1. FORMATO DE TAMAÑO PERSONALIZADO:
   - Pulgadas: Custom.WIDTHxHEIGHTin (ejemplo: Custom.2x1in)
   - Milímetros: Custom.WIDTHxHEIGHTmm (ejemplo: Custom.80x200mm)
   - Puntos: Custom.WIDTHxHEIGHT (ejemplo: Custom.144x72) [72 puntos = 1 pulgada]

2. PRIORIDAD DE OPCIONES:
   Las opciones se combinan en este orden:
   a) Opciones del role (si se especifica role: 'label', 'ticket', etc.)
   b) Opciones de la impresora (configuradas con /printer-options)
   
   Las opciones de impresora tienen mayor prioridad y sobrescriben las del role.

3. PERSISTENCIA:
   Las opciones se guardan en:
   macOS: ~/Library/Application Support/GiganetPrintService/config.json
   Windows: %APPDATA%\GiganetPrintService\config.json

4. APLICACIÓN AUTOMÁTICA:
   Una vez configuradas, las opciones se aplican automáticamente a todas
   las impresiones enviadas a esa impresora específica.

5. EJEMPLOS DE IMPRESIÓN:
   Una vez configurada la impresora, simplemente imprime normalmente:
*/

async function imprimirConOpcionesConfiguradas(pdfBase64) {
  // Las opciones se aplicarán automáticamente según la configuración
  const res = await fetch(`${SERVICE}/print`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Giganet-Print-Key': API_KEY,
    },
    body: JSON.stringify({
      printer: 'EPSON_TM_T20III',  // Ya tiene configurado Custom.3x5in + portrait
      type: 'pdf',
      data: pdfBase64,
      copies: 1,
    }),
  });

  return await res.json();
}

module.exports = {
  configurePrinterOptions,
  getPrinterOptions,
  getAllPrinterOptions,
  deletePrinterOptions,
  imprimirConOpcionesConfiguradas,
};
