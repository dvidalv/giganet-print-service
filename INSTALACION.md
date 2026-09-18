# Manual de instalación — Giganet Print Service (LPCR)

Servicio **local de macOS**. LPCR en internet (`https://app.contrerasrobledo.com`) no imprime solo: en **cada Mac** que vaya a imprimir debe correr este servicio en `http://127.0.0.1:9100`, con las impresoras de **esa** computadora.

No se instala en Windows. No se copia `node_modules` ni el LaunchAgent de otra Mac.

---

## Idea clave: una sola API Key

LPCR en Vercel lleva embebida `NEXT_PUBLIC_GIGANET_PRINT_KEY`.

- **Primera Mac (o primer setup de Vercel):** se genera una key, se copia a Vercel y se hace **redeploy**.
- **Mac siguientes:** el instalador genera *otra* key. **No la uses.** Pega la **misma** de Vercel / de la Mac que ya imprime.

Si las keys no coinciden, producción no autentica contra esa Mac.

---

## Requisitos

- macOS 12+ (Apple Silicon o Intel)
- Usuario con el que se abrirá Chrome y LPCR
- **Node.js 20 LTS o superior** — https://nodejs.org o `brew install node`
- Impresoras agregadas en **Ajustes del Sistema → Impresoras y escáneres** (CUPS)

Comprobar Node:

```bash
node -v
npm -v
```

---

## 1. Copiar el proyecto

Carpeta fija (el autoarranque apunta a esta ruta; no la borres):

```text
~/Applications/giganet-print-service
```

**Git (recomendado):**

```bash
mkdir -p ~/Applications
cd ~/Applications
git clone https://github.com/dvidalv/giganet-print-service.git
cd giganet-print-service
```

**USB / AirDrop:** copia la carpeta del repo **sin** `node_modules`.

---

## 2. Instalar e iniciar el servicio

```bash
cd ~/Applications/giganet-print-service
npm install
```

### Mac adicional (ya hay key en Vercel)

Pega la key de producción en el comando:

```bash
GIGANET_PRINT_KEY='PEGA_AQUI_LA_KEY_DE_VERCEL' npm run install-service
```

### Primera Mac (aún no hay key en Vercel)

```bash
npm run install-service
```

`install-service` crea:

1. `~/Library/Application Support/GiganetPrintService/config.json`
2. API Key (nueva, o la de `GIGANET_PRINT_KEY`)
3. LaunchAgent `com.giganet.printservice` (arranca al iniciar sesión)

Comprobar:

```bash
curl http://127.0.0.1:9100/status
```

Esperado:

```json
{ "status": "online", "service": "Giganet Print Service", "version": "1.2.1" }
```

---

## 3. Impresoras en esta Mac

El servicio **solo lista colas CUPS de esta computadora**. No hereda las de otra Mac.

1. **Ajustes del Sistema → Impresoras y escáneres → Agregar** (USB, red o IP).
2. En Terminal:

```bash
lpstat -p
lpstat -d
```

Debe aparecer `printer NOMBRE is idle` (o equivalente). Si no hay destinos, agrégalas en Ajustes y vuelve a `lpstat -p`.

---

## 4. Configurar en /settings

En **esa** Mac abre:

[http://127.0.0.1:9100/settings](http://127.0.0.1:9100/settings)

Estado: **En línea**.

### API Key

1. Si instalaste **sin** `GIGANET_PRINT_KEY`, pega la de Vercel (o de la Mac que ya imprime).
2. **Guardar clave**.
3. **No pulses Regenerar** en una Mac extra (rompería el POS hasta un redeploy).

### Dominios permitidos (CORS)

Uno por línea → **Guardar orígenes**:

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

1. Elige **impresora predeterminada** → **Guardar impresora**.
2. En **Impresoras por tipo de documento**, pulsa la cola de cada tipo (lista visible, no el menú nativo de macOS) → **Guardar roles**.

| Role | Documento en LPCR | Impresora típica |
|------|-------------------|------------------|
| `label` | Etiqueta 2×1 | Zebra |
| `ticket` | Recibo 80 mm | Epson POS |
| `factura` | Factura carta 8.5×11 | HP / láser |
| `estudio` | Informe de estudio 8.5×11 | HP / láser |

Vacío = usa la predeterminada.

3. **Probar impresión** y **Probar role**.

Opcional — consola como app: Chrome/Edge **Instalar app**; Safari **Archivo → Añadir al Dock**.

---

## 5. Primera vez: variables en Vercel (proyecto LPCR)

Solo hace falta **una vez** para todo el laboratorio. No se cambia al añadir otra Mac.

| Variable | Valor |
|----------|--------|
| `NEXT_PUBLIC_GIGANET_PRINT_URL` | `http://127.0.0.1:9100` |
| `NEXT_PUBLIC_GIGANET_PRINT_KEY` | la API Key de `/settings` (la que van a compartir todas las Mac) |

Production (y Preview si aplica) → **Redeploy**. Las `NEXT_PUBLIC_*` se embeben en el build.

---

## 6. Imprimir desde LPCR

1. En esa Mac abre https://app.contrerasrobledo.com
2. Estudio, factura o recibo → **Imprimir**.
3. Chrome 142+ pide permiso de **red local** para hablar con `127.0.0.1`. Pulsa **Permitir**.

Si lo bloqueaste: candado de la barra → configuración del sitio → **Red local** → **Permitir** → recarga e imprime de nuevo.

La impresión sale en silencio a CUPS, sin el diálogo del navegador.

---

## 7. Actualizar el servicio

```bash
cd ~/Applications/giganet-print-service
git pull
npm install
npm run install-service
```

Recarga http://127.0.0.1:9100/settings (si es PWA, cierra la ventana y ábrela otra vez). Comprueba la versión en el encabezado.

---

## Comandos útiles

| Acción | Comando |
|--------|---------|
| Arranque manual (sin LaunchAgent) | `npm start` |
| Instalar / reiniciar autoarranque | `npm run install-service` |
| Instalar con la key de Vercel | `GIGANET_PRINT_KEY='…' npm run install-service` |
| Detener desde la UI | `/settings` → **Detener servicio** (no basta con cerrar la PWA) |
| Quitar autoarranque | `npm run uninstall-service` |
| Health check | `curl http://127.0.0.1:9100/status` |
| Listar colas CUPS | `lpstat -p` |

`uninstall-service` **no** borra `config.json` ni la API Key.

---

## Dónde queda todo

| Qué | Ruta |
|-----|------|
| Proyecto | `~/Applications/giganet-print-service` (o la que usaste) |
| Configuración / API Key | `~/Library/Application Support/GiganetPrintService/config.json` |
| Logs | `~/Library/Logs/GiganetPrintService/` |
| LaunchAgent | `~/Library/LaunchAgents/com.giganet.printservice.plist` |

---

## Problemas frecuentes

### Detener servicio dice que el proceso es anterior a v1.2.4

Hay un `npm start` viejo ocupando el puerto 9100. El HTML se actualizó, el Node no.

```bash
lsof -ti tcp:9100 | xargs kill
cd ~/Applications/giganet-print-service
git pull
npm run install-service
```

Recarga `/settings`. El encabezado debe coincidir con la versión del `git pull`. `install-service` ahora libera el puerto 9100 solo.

### Chrome bloqueó 127.0.0.1

Permiso de **red local** para `app.contrerasrobledo.com` (paso 6). CORS de `/settings` debe incluir ese origen.

### Settings dice Desconectado / `lpstat: Bad file descriptor`

El HTTP del servicio está bien; falló CUPS. En esa Mac:

```bash
cd ~/Applications/giganet-print-service
git pull
npm run install-service
```

Si Terminal `lpstat -p` también falla, CUPS no está activo: agrega una impresora en Ajustes del Sistema o `sudo launchctl kickstart -k system/org.cups.cupsd`.

### Impresoras disponibles vacío / solo «Usar predeterminada»

CUPS no tiene colas en **esta** Mac. `lpstat -p`, agregar en Ajustes, **Actualizar** en `/settings`. Los nombres no tienen que coincidir con otra Mac: se mapean en roles.

### La Mac nueva no imprime desde producción

La API Key local no es la de Vercel. Pégala en `/settings` → **Guardar clave**. No regeneres. No hace falta redeploy si reutilizas la key existente.

### «Falta la API Key del servicio local»

Vercel no tiene `NEXT_PUBLIC_GIGANET_PRINT_KEY` o no hubo redeploy tras ponerla. Es el setup **inicial**, no cada Mac nueva.

### El servicio no está en línea

```bash
curl http://127.0.0.1:9100/status
npm run install-service
```

### Cambió de Mac

Repite este manual. **Misma** API Key de Vercel. Impresoras nuevas en CUPS de esa máquina.

---

## Checklist por Mac

- [ ] Node.js 20+
- [ ] Repo en carpeta estable (`git clone` o copia sin `node_modules`)
- [ ] Impresoras en Ajustes del Sistema (`lpstat -p` las lista)
- [ ] `npm install` + `npm run install-service` (con `GIGANET_PRINT_KEY` si ya existe Vercel)
- [ ] http://127.0.0.1:9100/status → `online`
- [ ] `/settings`: API Key **igual** a Vercel → Guardar clave
- [ ] CORS con `https://app.contrerasrobledo.com`
- [ ] Predeterminada + roles → Guardar → prueba de impresión
- [ ] En Chrome, **Permitir** red local al imprimir desde LPCR

**Solo en el primer setup del laboratorio**

- [ ] Variables `NEXT_PUBLIC_GIGANET_PRINT_URL` y `_KEY` en Vercel
- [ ] Redeploy Production

---

Detalle técnico del API: `README.md`.
