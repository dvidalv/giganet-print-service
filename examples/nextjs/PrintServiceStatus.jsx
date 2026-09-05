'use client';

/**
 * Ejemplo de componente React (Next.js App Router) para estado del servicio.
 *
 * Copia giganetPrint.js a tu app (p. ej. lib/giganetPrint.js) y este componente
 * a components/PrintServiceStatus.jsx
 */

import { useEffect, useState } from 'react';
import { checkPrintService, printPdf } from './giganetPrint';

export default function PrintServiceStatus() {
  const [state, setState] = useState({ loading: true, online: false });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await checkPrintService();
      if (!cancelled) {
        setState({ loading: false, ...result });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.loading) {
    return <p>Comprobando servicio de impresión…</p>;
  }

  if (!state.online) {
    return (
      <p>
        Servicio de impresión no instalado o desconectado.
        {state.error ? ` (${state.error})` : ''}
      </p>
    );
  }

  return (
    <p>
      Servicio de impresión conectado
      {state.version ? ` · v${state.version}` : ''}
    </p>
  );
}

/**
 * Ejemplo de impresión desde un Blob PDF generado en el cliente.
 */
export async function handlePrintPdfBlob(pdfBlob, printerName) {
  const { blobToBase64, printPdf: send } = await import('./giganetPrint');
  const data = await blobToBase64(pdfBlob);
  return send({ data, printer: printerName, copies: 1 });
}

// Re-export for convenience in demos
export { printPdf };
