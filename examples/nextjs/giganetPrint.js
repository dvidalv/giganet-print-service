/**
 * Cliente reutilizable para Giganet Print Service (Next.js / PWA).
 *
 * Uso:
 *   import { checkPrintService, printPdf, getPrinters } from '@/lib/giganetPrint';
 */

export const PRINT_SERVICE_URL =
  process.env.NEXT_PUBLIC_GIGANET_PRINT_URL || 'http://127.0.0.1:9100';

export const PRINT_SERVICE_API_KEY =
  process.env.NEXT_PUBLIC_GIGANET_PRINT_KEY || '';

/**
 * fetch hacia loopback con anotación Local Network Access (Chrome).
 * targetAddressSpace evita bloqueos de mixed content en HTTPS → http://127.0.0.1
 */
async function localFetch(path, options = {}) {
  const url = `${PRINT_SERVICE_URL}${path}`;
  const headers = {
    ...(options.headers || {}),
  };

  const init = {
    ...options,
    headers,
    // Chrome Local Network Access (loopback)
    targetAddressSpace: 'loopback',
  };

  return fetch(url, init);
}

function authHeaders(extra = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...extra,
  };
  if (PRINT_SERVICE_API_KEY) {
    headers['X-Giganet-Print-Key'] = PRINT_SERVICE_API_KEY;
  }
  return headers;
}

/**
 * Verifica si el servicio local está instalado y en línea.
 * No requiere API Key.
 *
 * @returns {Promise<{ online: boolean, service?: string, version?: string, error?: string }>}
 */
export async function checkPrintService() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await localFetch('/status', {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      return { online: false, error: `HTTP ${res.status}` };
    }

    const data = await res.json();
    if (data.status === 'online') {
      return {
        online: true,
        service: data.service,
        version: data.version,
      };
    }
    return { online: false, error: 'Respuesta inesperada' };
  } catch (err) {
    return {
      online: false,
      error: err.name === 'AbortError' ? 'timeout' : err.message || 'unreachable',
    };
  }
}

/**
 * Lista impresoras del servicio local (CUPS en Mac, spooler en Windows).
 */
export async function getPrinters() {
  const res = await localFetch('/printers', {
    method: 'GET',
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'No se pudieron listar impresoras');
  }
  return data.printers;
}

/**
 * Envía un PDF (Base64) a imprimir.
 *
 * @param {object} opts
 * @param {string} opts.data - PDF en Base64 (con o sin data: URL)
 * @param {string} [opts.printer] - Nombre CUPS; si se omite usa role o defaultPrinter
 * @param {string} [opts.role] - label | ticket | factura | estudio
 * @param {number} [opts.copies=1]
 */
export async function printPdf({ data, printer, role, copies = 1 }) {
  const res = await localFetch('/print', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      type: 'pdf',
      data,
      printer,
      role,
      copies,
    }),
  });
  const body = await res.json();
  if (!res.ok || !body.success) {
    const err = new Error(body.message || 'Error de impresión');
    err.code = body.error;
    throw err;
  }
  return body;
}

/**
 * Prueba de impresión.
 */
export async function testPrint(printer) {
  const res = await localFetch('/test-print', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(printer ? { printer } : {}),
  });
  const body = await res.json();
  if (!res.ok || !body.success) {
    const err = new Error(body.message || 'Error en prueba');
    err.code = body.error;
    throw err;
  }
  return body;
}

/**
 * Convierte un Blob/File PDF a Base64 (sin prefijo data:).
 */
export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
