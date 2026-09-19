# Manual de instalación — Giganet Print Service

Servicio **local de macOS** para que LPCR imprima en silencio (Zebra 2×1, Epson 80 mm, HP carta) sin el diálogo del navegador.

LPCR en internet (`https://app.contrerasrobledo.com`) **no imprime solo**. En **cada Mac** que vaya a imprimir debe correr este servicio en `http://127.0.0.1:9100`, usando las impresoras CUPS **de esa** computadora.

- Solo macOS (Apple Silicon o Intel). No hay instalador de Windows.
- No copies `node_modules` ni el LaunchAgent de otra Mac.
- Cerrar la PWA o Chrome **no** apaga el servicio.

Versión actual del paquete: **1.2.6**. El encabezado de `/settings` debe coincidir con el `git pull`.

---

## Cómo encaja todo

```text
Chrome en esta Mac
    → https://app.contrerasrobledo.com  (LPCR en Vercel)
    → http://127.0.0.1:9100             (este servicio, solo en esta Mac)
    → CUPS                              (impresoras de esta Mac)
```

Vercel lleva embebidas la URL y la API Key. El servicio local debe usar **la misma** key. Las impresoras se eligen en cada Mac.

---

## Una sola API Key para todo el laboratorio

`NEXT_PUBLIC_GIGANET_PRINT_KEY` en Vercel es la clave que LPCR envía a `127.0.0.1:9100`.

| Situación | Qué hacer |
|-----------|-----------|
| **Primera Mac** (Vercel aún no tiene key) | `npm run install-service` genera una. Cópiala a Vercel y haz **redeploy**. |
| **Mac siguientes** | El instalador puede generar *otra* key. **No la uses.** Pasa la de Vercel con `GIGANET_PRINT_KEY` o pégala en `/settings` → **Guardar clave**. |

Si las keys no coinciden, producción no autentica contra esa Mac. **No pulses Regenerar** en una Mac extra: invalidarías la key de Vercel hasta un redeploy.

---

## Requisitos

- macOS 12 o superior
- La misma cuenta de usuario con la que se abre Chrome y LPCR
- **Node.js 20 LTS o superior** — [nodejs.org](https://nodejs.org) o `brew install node`
- Impresoras en **Ajustes del Sistema → Impresoras y escáneres** (CUPS)

Comprobar Node:

```bash
node -v
npm -v
```

---

## 1. Copiar el proyecto

Usa una carpeta fija. El LaunchAgent apunta a esa ruta; no la borres ni la muevas después.

```text
~/Applications/giganet-print-service
```

El repo es **público**. En cada Mac:

```bash
mkdir -p ~/Applications
cd ~/Applications
git clone https://github.com/dvidalv/giganet-print-service.git
cd giganet-print-service
```

Usa **HTTPS**, no `git@github.com:...`. SSH pide una llave aunque el repo sea público; en una Mac de secretaría eso termina en `Permission denied (publickey)`.

Si GitHub pregunta *Are you sure you want to continue connecting* (solo con SSH), escribe **`yes`** completo, no solo `y`.

No hace falta usuario, token ni `sudo`.

---

## 2. Instalar e iniciar el servicio

```bash
cd ~/Applications/giganet-print-service
npm install
```

### Mac adicional (ya hay key en Vercel)

```bash
GIGANET_PRINT_KEY='PEGA_AQUI_LA_KEY_DE_VERCEL' npm run install-service
```

### Primera Mac (aún no hay key en Vercel)

```bash
npm run install-service
```

**No uses `sudo`.** El LaunchAgent es del usuario.

`install-service` hace esto:

1. Crea o reutiliza `~/Library/Application Support/GiganetPrintService/config.json`
2. Deja una API Key (nueva, o la de `GIGANET_PRINT_KEY`)
3. Registra el LaunchAgent `com.giganet.printservice` (arranca al iniciar sesión)
4. Libera el puerto 9100 si lo ocupaba un `npm start` viejo
5. Espera a que `/status` responda

Es normal ver avisos de `Boot-out` / `Unload` con *Input/output error* al quitar un agente anterior. El comando termina bien si al final imprime **Listo** y una línea **Verificación** con `"status":"online"`.

Comprobar a mano:

```bash
curl http://127.0.0.1:9100/status
```

Esperado (la versión debe ser la del repo, hoy 1.2.6):

```json
{
  "status": "online",
  "paused": false,
  "service": "Giganet Print Service",
  "version": "1.2.6"
}
```

Si `install-service` no puede registrar launchd:

```bash
launchctl enable gui/$(id -u)/com.giganet.printservice
npm run install-service
```

Mientras tanto: `npm start` (queda en esa Terminal; no es autoarranque).

---

## 3. Impresoras en esta Mac

El servicio **solo lista colas CUPS de esta computadora**. Los nombres no tienen que coincidir con otra Mac: se mapean en roles.

1. **Ajustes del Sistema → Impresoras y escáneres → Agregar** (USB, red o IP).
2. En Terminal:

```bash
lpstat -p
lpstat -d
```

Debe listar las colas (`printer NOMBRE is idle`, o el equivalente en español). Si no hay destinos, agrégalas en Ajustes y vuelve a `lpstat -p`.

---

## 4. Configurar en /settings

En **esa** Mac abre:

[http://127.0.0.1:9100/settings](http://127.0.0.1:9100/settings)

El badge debe decir **En línea**.

### API Key

1. Si instalaste **sin** `GIGANET_PRINT_KEY`, pega la de Vercel (o de la Mac que ya imprime).
2. **Guardar clave**.
3. En una Mac extra, **no pulses Regenerar**.

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

1. Elige **impresora predeterminada** en la lista visible (no el menú nativo de macOS, que en modo oscuro a veces no se lee) → **Guardar impresora**.
2. En **Impresoras por tipo de documento**, asigna una cola a cada tipo → **Guardar roles**.

| Role | Documento en LPCR | Impresora típica |
|------|-------------------|------------------|
| `label` | Etiqueta 2×1 | Zebra |
| `ticket` | Recibo 80 mm | Epson POS |
| `factura` | Factura carta 8.5×11 | HP / láser |
| `estudio` | Informe de estudio 8.5×11 | HP / láser |

Vacío = usa la predeterminada.

3. **Probar impresión** y **Probar role**.
4. En **Tamaño de papel y orientación**, elige papel y retrato/paisaje por cola (o déjalo vacío para usar el del role) → **Guardar papel y orientación**.

### Iniciar / Detener

- **Detener servicio** pausa la impresión. LPCR no imprime. El proceso **sigue** en `127.0.0.1:9100`.
- **Iniciar servicio** reanuda.
- Cerrar la ventana de `/settings` no pausa ni apaga nada.

Si el proceso está muerto de verdad (nada en el puerto 9100), la PWA no puede ejecutarlo: `npm start` o `npm run install-service`.

### Instalar la consola como app (PWA)

1. Abre [http://127.0.0.1:9100/settings](http://127.0.0.1:9100/settings) en Chrome o Edge.
2. Instálala: icono de instalar en la barra de direcciones, o menú → **Instalar Giganet Print**.
3. En Safari: **Archivo → Añadir al Dock** (el icono sí queda en el Dock).

#### Dónde buscar el icono en el Mac

Chrome **no** lo pone en el Dock ni en `/Aplicaciones` (la carpeta Aplicaciones de todo el sistema). Queda en la carpeta de apps de **tu usuario**:

```text
~/Applications/Chrome Apps.localized/Giganet Print Service.app
```

En Finder:

1. **Ir → Ir a la carpeta…** (Mayús+Cmd+G)
2. Pega exactamente: `~/Applications/Chrome Apps.localized`
3. Ahí está **Giganet Print Service**
4. Arrástrala al **Dock** o al escritorio si quieres abrirla sin pasar por Chrome

Otros sitios:

| Dónde | Qué buscar |
|-------|------------|
| Spotlight (Cmd+Espacio) | `Giganet Print Service` |
| Chrome | `chrome://apps` |
| Edge | `~/Applications/Edge Apps.localized/` (o `Microsoft Edge Apps.localized`) |
| Safari | El Dock, después de **Añadir al Dock** |

Launchpad a menudo **no** muestra las apps de `Chrome Apps.localized`. Si no la ves ahí, usa Finder o Spotlight.

La PWA comprueba actualizaciones cada 30 s y al enfocar la ventana. Si cambió `/settings` o la versión del servicio, recarga sola. Un cambio en el código del servidor (`src/`) sigue pidiendo `git pull` + `npm run install-service`.

---

## 5. Primera vez: variables en Vercel (proyecto LPCR)

Solo hace falta **una vez** para todo el laboratorio. No se cambia al añadir otra Mac.

| Variable | Valor |
|----------|--------|
| `NEXT_PUBLIC_GIGANET_PRINT_URL` | `http://127.0.0.1:9100` |
| `NEXT_PUBLIC_GIGANET_PRINT_KEY` | la API Key de `/settings` (la que van a compartir todas las Mac) |

Production (y Preview si aplica) → **Redeploy**. Las `NEXT_PUBLIC_*` se embeben en el build; guardar la variable sin redeploy no basta.

---

## 6. Imprimir desde LPCR

1. En esa Mac abre https://app.contrerasrobledo.com
2. Estudio, factura o recibo → **Imprimir**.
3. Chrome 142+ pide permiso de **red local** para hablar con `127.0.0.1`. Pulsa **Permitir**.

Si lo bloqueaste: candado de la barra → configuración del sitio → **Red local** → **Permitir** → recarga e imprime de nuevo.

La impresión sale en silencio a CUPS.

---

## 7. Actualizar el servicio

```bash
cd ~/Applications/giganet-print-service
git pull
npm install
npm run install-service
```

Abre o espera a que la PWA recargue `/settings`. El encabezado debe mostrar la versión nueva.

---

## Día a día

| Acción | Dónde |
|--------|--------|
| Pausar / reanudar impresión | `/settings` → **Detener** / **Iniciar** |
| Arranque manual (sin LaunchAgent) | `npm start` |
| Instalar o reiniciar autoarranque | `npm run install-service` |
| Instalar con la key de Vercel | `GIGANET_PRINT_KEY='…' npm run install-service` |
| Quitar autoarranque | `npm run uninstall-service` |
| Health check | `curl http://127.0.0.1:9100/status` |
| Listar colas CUPS | `lpstat -p` |

`uninstall-service` **no** borra `config.json` ni la API Key.

---

## Dónde queda todo

| Qué | Ruta |
|-----|------|
| Proyecto | `~/Applications/giganet-print-service` (o la carpeta que usaste al clonar) |
| Configuración / API Key | `~/Library/Application Support/GiganetPrintService/config.json` |
| Logs | `~/Library/Logs/GiganetPrintService/` |
| LaunchAgent | `~/Library/LaunchAgents/com.giganet.printservice.plist` |
| App PWA (Chrome) | `~/Applications/Chrome Apps.localized/Giganet Print Service.app` |

---

## Problemas frecuentes

### No encuentro el icono de la app PWA

No está en `/Aplicaciones` ni suele estar en Launchpad. En Finder: **Ir → Ir a la carpeta…** y pega `~/Applications/Chrome Apps.localized`. La app se llama **Giganet Print Service**. Arrástrala al Dock.

### `Permission denied (publickey)` al clonar

Clonaste por SSH (`git@github.com:...`). El repo es público; esa Mac no necesita llave. Cancela y usa HTTPS:

```bash
cd ~/Applications
git clone https://github.com/dvidalv/giganet-print-service.git
```

### `install-service` termina con *Bootstrap failed: 5*

Suele ser un agente **deshabilitado** o un `bootout` ruidoso. El instalador actual hace `enable` y, si hace falta, `launchctl load -w`. Vuelve a ejecutar `npm run install-service` (sin sudo). Si `/status` no responde:

```bash
launchctl enable gui/$(id -u)/com.giganet.printservice
launchctl print gui/$(id -u)/com.giganet.printservice
npm run install-service
```

### Verificación de `/status` falló al instalar, pero luego sí responde

El proceso tardó un segundo en abrir el puerto. `curl http://127.0.0.1:9100/status` ahora. El instalador reintenta solo; si ves un aviso viejo, ignóralo si el curl actual es `online`.

### Encabezado de `/settings` más viejo que el repo

Hay un Node antiguo en el 9100. `install-service` mata ese proceso y arranca el nuevo. Recarga `/settings` (Cmd+Shift+R si hace falta).

### Chrome bloqueó 127.0.0.1

Permiso de **red local** para `app.contrerasrobledo.com` (paso 6). En `/settings`, CORS debe incluir ese origen.

### Settings dice Desconectado / `lpstat: Bad file descriptor`

El HTTP del servicio puede estar bien y fallar solo el listado CUPS. Prueba `lpstat -p` en Terminal. Si Terminal también falla, CUPS no está activo: agrega una impresora en Ajustes o:

```bash
sudo launchctl kickstart -k system/org.cups.cupsd
```

Luego **Actualizar** en `/settings`.

### Impresoras disponibles vacío / solo «Usar predeterminada»

CUPS no tiene colas en **esta** Mac. `lpstat -p`, agregar en Ajustes, **Actualizar**. Elige la cola en la lista grande de `/settings`, no en el triángulo nativo.

### La Mac nueva no imprime desde producción

La API Key local no es la de Vercel. Pégala en `/settings` → **Guardar clave**. No regeneres. No hace falta redeploy si reutilizas la key existente.

### «Falta la API Key del servicio local»

Vercel no tiene `NEXT_PUBLIC_GIGANET_PRINT_KEY` o no hubo redeploy tras ponerla. Es el setup **inicial**, no cada Mac nueva.

### El servicio no está en línea

```bash
curl http://127.0.0.1:9100/status
npm run install-service
```

`paused: true` significa que alguien pulsó **Detener**. Pulsa **Iniciar servicio**.

### Cambió de Mac

Repite este manual. **Misma** API Key de Vercel. Impresoras nuevas en CUPS de esa máquina.

---

## Checklist por Mac

- [ ] Node.js 20+
- [ ] Repo en `~/Applications/giganet-print-service` (`git clone` por HTTPS)
- [ ] Impresoras en Ajustes del Sistema (`lpstat -p` las lista)
- [ ] `npm install` + `npm run install-service` (con `GIGANET_PRINT_KEY` si ya existe Vercel)
- [ ] `curl http://127.0.0.1:9100/status` → `online` (no `paused`)
- [ ] `/settings`: API Key **igual** a Vercel → Guardar clave
- [ ] CORS con `https://app.contrerasrobledo.com`
- [ ] Predeterminada + roles → Guardar → prueba de impresión
- [ ] En Chrome, **Permitir** red local al imprimir desde LPCR

**Solo en el primer setup del laboratorio**

- [ ] Variables `NEXT_PUBLIC_GIGANET_PRINT_URL` y `NEXT_PUBLIC_GIGANET_PRINT_KEY` en Vercel
- [ ] Redeploy Production

---

API y contratos HTTP: `README.md`.
