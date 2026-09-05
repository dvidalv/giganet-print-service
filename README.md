# Giganet Print Service

Servicio local de impresión para **macOS** (Apple Silicon e Intel). Expone una API HTTP en `127.0.0.1` para que tu aplicación web o PWA imprima PDF (y raw/ESC/POS) en impresoras CUPS **sin** el diálogo del navegador y **sin** QZ Tray.

## Requisitos

- macOS 12+
- Node.js 20 LTS o superior
- Impresoras instaladas en el sistema (CUPS / Preferencias del Sistema)

## Instalación rápida

```bash
cd giganet-print-service
npm install
npm run install-service
```

Esto:

1. Crea `~/Library/Application Support/GiganetPrintService/config.json`
2. Genera una **API Key** segura si no existe
3. Registra el LaunchAgent `com.giganet.printservice`
4. Arranca el servicio en el login del usuario

Abre la consola de configuración:

[http://127.0.0.1:9100/settings](http://127.0.0.1:9100/settings)

Arranque manual (sin LaunchAgent):

```bash
npm start
```

Desinstalación del autoarranque (no borra tu configuración):

```bash
npm run uninstall-service
```

## Endpoints

| Método | Ruta | API Key | Descripción |
|--------|------|---------|-------------|
| GET | `/status` | No | Health check / descubrimiento desde la PWA |
| GET | `/printers` | Sí | Lista impresoras CUPS |
| POST | `/print` | Sí | Imprime `pdf`, `raw` o `escpos` |
| GET | `/config` | Sí | Lee configuración (sin secretos en remoto) |
| POST | `/config` | Sí | Actualiza `defaultPrinter`, orígenes, etc. |
| POST | `/test-print` | Sí | Página de prueba |
| GET | `/settings` | No* | UI local (*solo loopback) |

### GET `/status`

```json
{
  "status": "online",
  "service": "Giganet Print Service",
  "version": "1.0.0"
}
```

### GET `/printers`

```json
{
  "printers": [
    { "name": "EPSON_TM_T20III", "default": true, "status": "idle", "enabled": true }
  ]
}
```

### POST `/print`

```json
{
  "printer": "EPSON_TM_T20III",
  "role": "ticket",
  "type": "pdf",
  "data": "BASE64_DEL_PDF",
  "copies": 1
}
```

Resolución de impresora:

1. `printer` explícito (si viene)
2. Si no, `printerRoles[role]` (si `role` está mapeado y no vacío)
3. Si no, `defaultPrinter`
4. Si no hay ninguna → `NO_DEFAULT_PRINTER`

Roles válidos: `factura`, `ticket`, `label`, `cotizacion`, `orden_compra`, `caja`.

Tipos:

- `pdf` — validación mágica `%PDF-` + `lp`
- `raw` — `lp -o raw` (tickets / binario)
- `escpos` — preparado para ESC/POS; hoy reenvía como raw (extensible en `src/printers/escposPrinter.js`)

### Errores

```json
{
  "success": false,
  "error": "PRINTER_NOT_FOUND",
  "message": "La impresora indicada no existe"
}
```

Códigos: `UNAUTHORIZED`, `CORS_ORIGIN_NOT_ALLOWED`, `PRINTER_NOT_FOUND`, `PRINTER_OFFLINE`, `INVALID_BASE64`, `INVALID_PDF`, `NO_DEFAULT_PRINTER`, `INVALID_PRINT_ROLE`, `PRINT_TIMEOUT`, `LP_ERROR`, `UNSUPPORTED_TYPE`.

## Seguridad

- Escucha **solo** en `127.0.0.1` (nunca `0.0.0.0`)
- Header obligatorio (excepto `/status` y la UI local):

  `X-Giganet-Print-Key: <clave>`

- CORS con lista explícita de orígenes (`allowedOrigins`). **No** se usa `*`
- Configuración en disco con permisos restringidos (`0600`)
- Logs **sin** contenido PDF ni payloads

Archivo de configuración:

`~/Library/Application Support/GiganetPrintService/config.json`

```json
{
  "defaultPrinter": "EPSON_TM_T20III",
  "port": 9100,
  "host": "127.0.0.1",
  "apiKey": "…",
  "allowedOrigins": [
    "https://pos.giganet-srl.com",
    "https://www.pos.giganet-srl.com",
    "http://localhost:3000",
    "http://localhost:3001"
  ],
  "printTimeoutMs": 30000,
  "printerRoles": {
    "factura": "",
    "ticket": "EPSON_TM_T20III",
    "label": "",
    "cotizacion": "",
    "orden_compra": "",
    "caja": ""
  }
}
```

`printerRoles` se configura en `/settings` (Impresoras por tipo). Vacío = usar `defaultPrinter`.

Logs:

`~/Library/Logs/GiganetPrintService/`

## Integración PWA / Next.js

1. Añade tu dominio de producción a `allowedOrigins` (UI `/settings` o `POST /config`)
2. Copia `examples/nextjs/giganetPrint.js` a tu app (p. ej. `lib/giganetPrint.js`)
3. Define la API Key (idealmente solo en clientes de confianza / POS internos):

```bash
NEXT_PUBLIC_GIGANET_PRINT_URL=http://127.0.0.1:9100
NEXT_PUBLIC_GIGANET_PRINT_KEY=tu_api_key
```

> La API Key en el frontend es inevitable en este modelo (como QZ Tray). Mitigación: orígenes CORS estrictos + bind a loopback + clave rotativa.

### Descubrimiento

```js
import { checkPrintService } from '@/lib/giganetPrint';

const { online } = await checkPrintService();
// online → "Servicio de impresión conectado"
// !online → "Servicio de impresión no instalado o desconectado"
```

### Imprimir PDF

```js
await fetch('http://127.0.0.1:9100/print', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Giganet-Print-Key': API_KEY,
  },
  targetAddressSpace: 'loopback', // Chrome Local Network Access
  body: JSON.stringify({
    printer: 'EPSON_TM_T20III',
    type: 'pdf',
    data: pdfBase64,
    copies: 1,
  }),
});
```

## HTTPS → `http://127.0.0.1` (mixed content / Local Network Access)

Tu PWA vive en **HTTPS**; el servicio local habla **HTTP** en loopback. Resumen práctico:

| Tema | Situación |
|------|-----------|
| Mixed content clásico | Historicamente, `https://` → `http://` se bloquea. **Excepción habitual**: destino `localhost` / `127.0.0.1` en varios navegadores. |
| Chrome Local Network Access (≈142+) | Pide permiso al usuario para acceder a loopback/red local. Si se concede, también **relaja** mixed content para esos destinos locales. |
| `targetAddressSpace: "loopback"` | Anotación en `fetch()` para que Chrome sepa *antes* del DNS que el destino es loopback y aplique la exención correctamente. |
| Safari / Firefox | Comportamiento distinto; loopback suele funcionar, pero conviene probar en cada navegador objetivo del POS. |
| Certificados autofirmados en `https://127.0.0.1` | **No recomendado**: el navegador no confía en ellos sin instalación manual de CA; es frágil y peor UX que HTTP loopback + LNA. |

### Arquitectura recomendada para producción

1. **Servicio en `http://127.0.0.1:9100`** (HTTP loopback, bind estricto)
2. **API Key** + **allowlist CORS** de tus dominios POS
3. En el cliente: `fetch(..., { targetAddressSpace: "loopback" })`
4. UX clara la primera vez: “Permitir acceso a la red local / impresora”
5. **No** montar HTTPS local con certificados inseguros o hacks de CA

Opciones avanzadas (solo si un navegador concreto bloquea HTTP loopback de forma permanente):

- Distribuir un **perfil MDM** / certificado de empresa (entornos corporativos)
- Usar un **helper nativo** (LaunchAgent + app firmada) que la PWA detecta vía el mismo HTTP loopback
- Túnel local con certificado **públicamente confiable** (complejo; normalmente innecesario para POS en Mac)

Este repositorio **no** implementa HTTPS local con certificados inseguros a propósito.

## Estructura

```
giganet-print-service/
├── config/default.json
├── public/settings.html
├── scripts/install-service.js
├── scripts/uninstall-service.js
├── examples/nextjs/
├── src/
│   ├── server.js
│   ├── config.js
│   ├── routes/
│   ├── services/
│   ├── printers/          # pdf | raw | escpos
│   ├── middleware/
│   └── utils/
└── package.json
```

## LaunchAgent

Plist: `~/Library/LaunchAgents/com.giganet.printservice.plist`

- `RunAtLoad` + `KeepAlive`
- Logs launchd: `~/Library/Logs/GiganetPrintService/launchd.*.log`

## Desarrollo

```bash
npm install
npm run dev    # node --watch
npm start
```

## Licencia

UNLICENSED — uso interno Giganet.
