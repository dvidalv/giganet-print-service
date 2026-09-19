# Manual de instalación — Giganet Print Service (Windows)

Servicio **local de Windows** para que LPCR imprima en silencio (Zebra 2×1, Epson 80 mm, HP carta) sin el diálogo del navegador.

Es el mismo servicio y la **misma API** que en Mac (`http://127.0.0.1:9100`). LPCR no cambia: en **cada PC** que vaya a imprimir debe correr este proceso, usando las impresoras **de esa** computadora.

- Windows 10 o 11 (64 bits).
- No copies `node_modules` ni la tarea programada de otra PC.
- Cerrar Chrome o la PWA **no** apaga el servicio.

La API Key es **la misma** que en las Mac del laboratorio (`NEXT_PUBLIC_GIGANET_PRINT_KEY` en Vercel).

Versión actual del paquete: **1.3.0**. El encabezado de `/settings` debe coincidir con el `git pull`.

---

## Cómo encaja todo

```text
Chrome en este PC
    → https://app.contrerasrobledo.com  (LPCR en Vercel)
    → http://127.0.0.1:9100             (este servicio, solo en este PC)
    → Spooler de Windows                (impresoras de este PC)
```

Vercel lleva embebidas la URL y la API Key. El servicio local debe usar **la misma** key. Las impresoras se eligen en cada PC.

---

## Una sola API Key para todo el laboratorio

`NEXT_PUBLIC_GIGANET_PRINT_KEY` en Vercel es la clave que LPCR envía a `127.0.0.1:9100`.

| Situación | Qué hacer |
|-----------|-----------|
| **Primera computadora** (Vercel aún no tiene key) | `npm run install-service` genera una. Cópiala a Vercel y haz **redeploy**. |
| **PC o Mac siguientes** | El instalador puede generar *otra* key. **No la uses.** Pasa la de Vercel con `GIGANET_PRINT_KEY` o pégala en `/settings` → **Guardar clave**. |

Si las keys no coinciden, producción no autentica contra esa PC. **No pulses Regenerar** en una máquina extra: invalidarías la key de Vercel hasta un redeploy.

---

## Requisitos

- Windows 10 o 11
- La misma cuenta de usuario con la que se abre Chrome y LPCR
- **Node.js 20 LTS o superior** — [nodejs.org](https://nodejs.org) (instalador Windows, 64-bit). Marca **Add to PATH**.
- **Git** — [git-scm.com](https://git-scm.com) (opciones por defecto)
- Impresoras en **Configuración → Bluetooth y dispositivos → Impresoras y escáneres**

Comprobar Node (PowerShell o “Símbolo del sistema”):

```bat
node -v
npm -v
```

---

## 1. Copiar el proyecto

Usa una carpeta fija. La tarea programada apunta a esa ruta; no la borres ni la muevas después.

```text
%USERPROFILE%\giganet-print-service
```

El repo es **público**. En cada PC, PowerShell:

```powershell
cd $env:USERPROFILE
git clone https://github.com/dvidalv/giganet-print-service.git
cd giganet-print-service
```

Usa **HTTPS**, no `git@github.com:...`.

No hace falta usuario, token ni “Ejecutar como administrador”.

---

## 2. Instalar e iniciar el servicio

```powershell
cd $env:USERPROFILE\giganet-print-service
npm install
```

### PC adicional (ya hay key en Vercel)

```powershell
$env:GIGANET_PRINT_KEY='PEGA_AQUI_LA_KEY_DE_VERCEL'
npm run install-service
```

### Primera computadora (aún no hay key en Vercel)

```powershell
npm run install-service
```

**No uses “Ejecutar como administrador”.** La tarea es del usuario.

`install-service` hace esto:

1. Crea o reutiliza `%APPDATA%\GiganetPrintService\config.json`
2. Deja una API Key (nueva, o la de `GIGANET_PRINT_KEY`)
3. Descarga **SumatraPDF** portable (impresión PDF silenciosa) a `%LOCALAPPDATA%\GiganetPrintService\tools\`
4. Registra la tarea programada `GiganetPrintService` (arranca al iniciar sesión)
5. Libera el puerto 9100 si lo ocupaba un `npm start` viejo
6. Espera a que `/status` responda

Comprobar a mano:

```powershell
Invoke-RestMethod http://127.0.0.1:9100/status
```

Esperado (la versión debe ser la del repo, hoy 1.3.0):

```json
{
  "status": "online",
  "paused": false,
  "service": "Giganet Print Service",
  "version": "1.3.0",
  "os": "Windows"
}
```

Mientras tanto, si la tarea no arranca: `npm start` (queda en esa ventana; no es autoarranque).

---

## 3. Impresoras en este PC

El servicio **solo lista impresoras de Windows de esta computadora**. Los nombres no tienen que coincidir con otra máquina: se mapean en roles.

1. **Configuración → Bluetooth y dispositivos → Impresoras y escáneres → Agregar**.
2. En PowerShell:

```powershell
Get-Printer | Format-Table Name, PrinterStatus
```

Debe listar las colas. Si no hay destinos, agrégalas en Configuración y vuelve a `Get-Printer`.

---

## 4. Configurar en /settings

En **ese** PC abre:

[http://127.0.0.1:9100/settings](http://127.0.0.1:9100/settings)

El badge debe decir **En línea**. El encabezado debe incluir **Windows**.

### API Key

1. Si instalaste **sin** `GIGANET_PRINT_KEY`, pega la de Vercel (o de la Mac/PC que ya imprime).
2. **Guardar clave**.
3. En una PC extra, **no pulses Regenerar**.

### Dominios permitidos (CORS)

Uno por línea → **Guardar orígenes**. El valor por defecto ya incluye producción:

```text
https://app.contrerasrobledo.com
https://lpcr.vercel.app
https://www.contrerasrobledo.com
https://contrerasrobledo.com
http://localhost:3000
http://localhost:3001
http://127.0.0.1:3000
```

### Impresoras y roles

1. Elige **impresora predeterminada** en la lista → **Guardar impresora**.
2. En **Impresoras por tipo de documento**, asigna una cola a cada tipo → **Guardar roles**.

| Role | Documento en LPCR | Impresora típica |
|------|-------------------|------------------|
| `label` | Etiqueta 2×1 | Zebra |
| `ticket` | Recibo 80 mm | Epson POS |
| `factura` | Factura carta 8.5×11 | HP / láser |
| `estudio` | Informe de estudio 8.5×11 | HP / láser |

Vacío = usa la predeterminada.

3. **Probar impresión** y **Probar role**.
4. En **Tamaño de papel y orientación**, elige papel y retrato/paisaje por cola → **Guardar papel y orientación**.

En Windows el PDF silencioso usa SumatraPDF. Si no se descargó, el servicio cae al visor PDF de Windows (`PrintTo`); puede abrir una ventana un instante.

### Iniciar / Detener

- **Detener servicio** pausa la impresión. LPCR no imprime. El proceso **sigue** en `127.0.0.1:9100`.
- **Iniciar servicio** reanuda.
- Cerrar la ventana de `/settings` no pausa ni apaga nada.

Si el proceso está muerto de verdad (nada en el puerto 9100): `npm start` o `npm run install-service`.

### Instalar la consola como app (PWA)

1. Abre [http://127.0.0.1:9100/settings](http://127.0.0.1:9100/settings) en Chrome o Edge.
2. Instálala: icono de instalar en la barra de direcciones, o menú → **Instalar Giganet Print**.

En Windows el icono suele quedar en el menú Inicio. También: `chrome://apps`.

---

## 5. Primera vez: variables en Vercel (proyecto LPCR)

Solo hace falta **una vez** para todo el laboratorio. No se cambia al añadir un PC.

| Variable | Valor |
|----------|--------|
| `NEXT_PUBLIC_GIGANET_PRINT_URL` | `http://127.0.0.1:9100` |
| `NEXT_PUBLIC_GIGANET_PRINT_KEY` | la API Key de `/settings` (la que van a compartir Mac y PC) |

Production (y Preview si aplica) → **Redeploy**.

---

## 6. Imprimir desde LPCR

1. En ese PC abre https://app.contrerasrobledo.com
2. Estudio, factura o recibo → **Imprimir**.
3. Chrome 142+ pide permiso de **red local** para hablar con `127.0.0.1`. Pulsa **Permitir**.

Si lo bloqueaste: candado de la barra → configuración del sitio → **Red local** → **Permitir** → recarga e imprime de nuevo.

---

## 7. Actualizar el servicio

```powershell
cd $env:USERPROFILE\giganet-print-service
git pull
npm install
npm run install-service
```

---

## Día a día

| Acción | Dónde |
|--------|--------|
| Pausar / reanudar impresión | `/settings` → **Detener** / **Iniciar** |
| Arranque manual (sin tarea) | `npm start` |
| Instalar o reiniciar autoarranque | `npm run install-service` |
| Instalar con la key de Vercel | `$env:GIGANET_PRINT_KEY='…'; npm run install-service` |
| Quitar autoarranque | `npm run uninstall-service` |
| Health check | `Invoke-RestMethod http://127.0.0.1:9100/status` |
| Listar impresoras | `Get-Printer` |

`uninstall-service` **no** borra `config.json` ni la API Key.

---

## Dónde queda todo

| Qué | Ruta |
|-----|------|
| Proyecto | `%USERPROFILE%\giganet-print-service` |
| Configuración / API Key | `%APPDATA%\GiganetPrintService\config.json` |
| Logs | `%LOCALAPPDATA%\GiganetPrintService\logs\` |
| SumatraPDF | `%LOCALAPPDATA%\GiganetPrintService\tools\SumatraPDF.exe` |
| Tarea programada | Programador de tareas → `GiganetPrintService` |
| App PWA (Chrome) | Menú Inicio → Giganet Print Service |

---

## Problemas frecuentes

### `install-service` no registra la tarea

Abre PowerShell **sin** administrador, en la carpeta del proyecto, y vuelve a `npm run install-service`. Comprueba en el Programador de tareas que existe `GiganetPrintService`.

Mientras tanto: `npm start`.

### Verificación de `/status` falló al instalar, pero luego sí responde

El proceso tardó un segundo en abrir el puerto. `Invoke-RestMethod http://127.0.0.1:9100/status` ahora.

### Impresoras disponibles vacío

Windows no tiene colas en **este** PC. `Get-Printer`, agregar en Configuración, **Actualizar** en `/settings`.

### El PC nuevo no imprime desde producción

La API Key local no es la de Vercel. Pégala en `/settings` → **Guardar clave**. No regeneres.

### PDF abre el visor o no sale en silencio

Falta SumatraPDF. Vuelve a `npm run install-service` con internet, o instala [SumatraPDF](https://www.sumatrapdfreader.org/) y reinicia el servicio. También puedes poner `GIGANET_SUMATRA_PATH` con la ruta al `.exe`.

### Tickets / ESC-POS no salen

Las impresoras térmicas deben estar instaladas como impresora de Windows (USB o red). El tipo `raw` / `escpos` usa el spooler RAW, no un visor PDF.

### Chrome bloqueó 127.0.0.1

Permiso de **red local** para `app.contrerasrobledo.com`. En `/settings`, CORS debe incluir ese origen.

### El servicio no está en línea

```powershell
Invoke-RestMethod http://127.0.0.1:9100/status
npm run install-service
```

`paused: true` significa que alguien pulsó **Detener**. Pulsa **Iniciar servicio**.

### Cambió de PC

Repite este manual. **Misma** API Key de Vercel. Impresoras nuevas en Windows de esa máquina.

---

## Checklist por PC

- [ ] Node.js 20+
- [ ] Repo en `%USERPROFILE%\giganet-print-service` (`git clone` por HTTPS)
- [ ] Impresoras en Configuración (`Get-Printer` las lista)
- [ ] `npm install` + `npm run install-service` (con `GIGANET_PRINT_KEY` si ya existe Vercel)
- [ ] `/status` → `online` (no `paused`), `os: Windows`
- [ ] `/settings`: API Key **igual** a Vercel → Guardar clave
- [ ] CORS con `https://app.contrerasrobledo.com`
- [ ] Predeterminada + roles → Guardar → prueba de impresión
- [ ] En Chrome, **Permitir** red local al imprimir desde LPCR

**Solo en el primer setup del laboratorio**

- [ ] Variables `NEXT_PUBLIC_GIGANET_PRINT_URL` y `NEXT_PUBLIC_GIGANET_PRINT_KEY` en Vercel
- [ ] Redeploy Production

---

Manual de Mac: `INSTALACION.md`. API y contratos HTTP: `README.md`.
