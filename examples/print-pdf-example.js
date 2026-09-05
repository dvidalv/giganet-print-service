/**
 * Ejemplo mínimo (Node / browser) de llamada a /print
 *
 * En el navegador (desde tu PWA HTTPS), usa targetAddressSpace: 'loopback'.
 */

const SERVICE = 'http://127.0.0.1:9100';
const API_KEY = process.env.GIGANET_PRINT_KEY || 'TU_API_KEY';

async function printPdfBase64(pdfBase64, printer) {
  const res = await fetch(`${SERVICE}/print`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Giganet-Print-Key': API_KEY,
    },
    // Chrome Local Network Access
    targetAddressSpace: 'loopback',
    body: JSON.stringify({
      printer,
      type: 'pdf',
      data: pdfBase64,
      copies: 1,
    }),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(`${body.error}: ${body.message}`);
  }
  return body;
}

module.exports = { printPdfBase64 };
