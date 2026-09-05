# Instalación — Giganet Print Service (Mac del cliente)

Guía para instalar el servicio de impresión local en la **Mac de caja** del cliente.  
El POS en internet (Vercel) **no imprime solo**: necesita este servicio corriendo en la misma Mac donde está la impresora.

---

## Requisitos

- macOS (Apple Silicon o Intel)
- Cuenta de usuario con la que se usará el POS en esa Mac
- Impresora instalada en el sistema (Preferencias del Sistema → Impresoras)
- **Node.js 20 LTS o superior**  
  Descarga: https://nodejs.org  
  o con Homebrew: `brew install node`
- Acceso a la carpeta del proyecto `giganet-print-service` (USB, Drive, o clone de Git)

Comprobar Node:

```bash
node -v
npm -v
```

---

## 1. Copiar el proyecto a la Mac

Coloca la carpeta en un sitio estable, por ejemplo:

```text
~/Applications/giganet-print-service
```

o

```text
~/Projects/giganet-print-service
```

> No borres esta carpeta después de instalar: el LaunchAgent apunta a esos archivos.

---

## 2. Instalar dependencias y el servicio

Abre **Terminal**, entra a la carpeta e instala:

```bash
cd ~/Applications/giganet-print-service   # ajusta la ruta
npm install
npm run install-service
```

`install-service` hace esto:

1. Crea la configuración en  
   `~/Library/Application Support/GiganetPrintService/config.json`
2. Genera una **API Key** segura (si no existía)
3. Crea el LaunchAgent  
   `~/Library/LaunchAgents/com.giganet.printservice.plist`
4. Registra e inicia el servicio (arranca también al iniciar sesión)

---

## 3. Configurar en la pantalla local

Abre en el navegador de **esa misma Mac**:

[http://127.0.0.1:9100/settings](http://127.0.0.1:9100/settings)

1. Comprueba que el estado diga **En línea**
2. Selecciona la **impresora predeterminada** → Guardar
3. (Opcional) En **Impresoras por tipo de documento**, asigna p. ej. `ticket` → térmica, `label` → etiquetadora → Guardar roles  
   Vacío = usa la predeterminada.
4. Pulsa **Copiar** en la API Key (guárdala; la necesitarás en el POS)
5. En **Dominios permitidos (CORS)** deja al menos:

```text
https://giganet-pos.vercel.app
https://pos.giganet-srl.com
http://localhost:3000
http://127.0.0.1:3000
```

Si usan otro dominio, agrégalo también (**uno por línea**) y guarda.

6. Pulsa **Probar impresión** (o “Probar role”) y verifica que salga la hoja de prueba

| Role | Uso en el POS |
|------|----------------|
| `factura` | Imprimir factura (detalle) |
| `ticket` | Ticket post-cobro |
| `label` | Etiquetas (cuando usen impresión local) |
| `cotizacion` | Cotizaciones |
| `orden_compra` | Órdenes de compra |
| `caja` | Cierre de caja |

---

## 4. Conectar el POS (Vercel)

En el proyecto del POS en Vercel → **Settings → Environment Variables**:

| Variable | Valor |
|----------|--------|
| `NEXT_PUBLIC_GIGANET_PRINT_URL` | `http://127.0.0.1:9100` |
| `NEXT_PUBLIC_GIGANET_PRINT_KEY` | *(la API Key copiada en `/settings`)* |

Aplícalas a **Production** (y Preview si quieres).  
Después: **Redeploy** obligatorio — las variables `NEXT_PUBLIC_*` se embeben en el build.

### Error típico

> «Falta la API Key del servicio local. Se abrió el PDF en el navegador.»

Significa: el servicio en la Mac **sí responde**, pero el POS en Vercel **no tiene** `NEXT_PUBLIC_GIGANET_PRINT_KEY` (o no se redeployó tras añadirla).

---

## 5. Probar desde el POS

1. En la Mac de caja, abre el POS (`https://pos.giganet-srl.com` o la URL del cliente)
2. Cobra una venta → **Imprimir ticket**  
   o abre una factura → **Imprimir factura**
3. Debe imprimir **sin** el diálogo del navegador

Si el servicio no está corriendo, el POS abre el PDF en una pestaña (fallback).

Comprobar solo el servicio:

```bash
curl http://127.0.0.1:9100/status
```

Respuesta esperada:

```json
{ "status": "online", "service": "Giganet Print Service", "version": "1.0.0" }
```

---

## Comandos útiles

| Acción | Comando |
|--------|---------|
| Arranque manual (sin LaunchAgent) | `npm start` |
| Instalar / reinstalar autoarranque | `npm run install-service` |
| Quitar autoarranque | `npm run uninstall-service` |
| Ver settings | http://127.0.0.1:9100/settings |

`uninstall-service` **no** borra la configuración ni la API Key del usuario.

---

## Ubicaciones en macOS

| Qué | Ruta |
|-----|------|
| Configuración / API Key | `~/Library/Application Support/GiganetPrintService/config.json` |
| Logs del servicio | `~/Library/Logs/GiganetPrintService/` |
| LaunchAgent | `~/Library/LaunchAgents/com.giganet.printservice.plist` |

---

## Problemas frecuentes

### Falta la API Key / se abre el PDF

1. Copia la key desde http://127.0.0.1:9100/settings  
2. Ponla en Vercel como `NEXT_PUBLIC_GIGANET_PRINT_KEY`  
3. **Redeploy** Production  
4. Recarga el POS (hard refresh)

### El POS dice que el servicio no está conectado

- ¿Está el servicio corriendo? Abre http://127.0.0.1:9100/status  
- En Chrome, acepta el permiso de **acceso a red local** si aparece  
- Confirma que el origen del POS esté en la lista CORS de `/settings`

### Imprime en el navegador pero no en la impresora

- Revisa impresora predeterminada y **Probar impresión** en `/settings`  
- La impresora debe estar habilitada en CUPS

### El cliente cambió de Mac

Repite esta guía en la Mac nueva (nueva API Key) y actualiza la variable en Vercel.

---

## Checklist

- [ ] Node.js instalado  
- [ ] `npm install` + `npm run install-service`  
- [ ] Impresora predeterminada elegida en `/settings`  
- [ ] (Opcional) Roles ticket/label/etc. asignados  
- [ ] API Key copiada  
- [ ] Orígenes CORS con la URL del POS  
- [ ] `NEXT_PUBLIC_GIGANET_PRINT_URL` y `_KEY` en Vercel  
- [ ] Redeploy Production  
- [ ] Prueba: **Imprimir ticket** desde una venta  

---

Documentación técnica adicional: `README.md` en el mismo proyecto.
