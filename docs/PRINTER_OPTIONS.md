# Configuración de Opciones por Impresora

Esta funcionalidad permite configurar tamaño de papel y orientación específicos para cada impresora.

## Endpoints

### GET `/printer-options`
Obtiene todas las opciones configuradas.

**Respuesta:**
```json
{
  "success": true,
  "printerOptions": {
    "EPSON_TM_T20III": {
      "media": "Custom.3x5in",
      "orientation": "4"
    },
    "Zebra_ZD220": {
      "media": "Custom.2x1in",
      "orientation": "3"
    }
  }
}
```

### GET `/printer-options/:printerName`
Obtiene las opciones de una impresora específica.

**Respuesta:**
```json
{
  "success": true,
  "printer": "EPSON_TM_T20III",
  "options": {
    "media": "Custom.3x5in",
    "orientation": "4"
  }
}
```

### PUT `/printer-options/:printerName`
Configura o actualiza las opciones de una impresora.

**Body:**
```json
{
  "media": "Custom.3x5in",
  "orientation": "portrait"
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Opciones de impresora actualizadas correctamente",
  "printer": "EPSON_TM_T20III",
  "options": {
    "media": "Custom.3x5in",
    "orientation": "4"
  }
}
```

### DELETE `/printer-options/:printerName`
Elimina las opciones configuradas de una impresora.

**Respuesta:**
```json
{
  "success": true,
  "message": "Opciones de impresora eliminadas correctamente",
  "printer": "EPSON_TM_T20III"
}
```

## Configuración

### Tamaño de Papel (`media`)

**Tamaños estándar:**
- `Letter` - 8.5 x 11 pulgadas
- `Legal` - 8.5 x 14 pulgadas
- `A4` - 210 x 297 mm
- `A5` - 148 x 210 mm
- `A3` - 297 x 420 mm

**Tamaños personalizados:**
- Formato en pulgadas: `Custom.WIDTHxHEIGHTin`
  - Ejemplo: `Custom.2x1in` (2x1 pulgadas)
  - Ejemplo: `Custom.4x6in` (4x6 pulgadas)
  
- Formato en milímetros: `Custom.WIDTHxHEIGHTmm`
  - Ejemplo: `Custom.80x200mm` (tickets térmicos 80mm)
  - Ejemplo: `Custom.100x50mm` (etiquetas 100x50mm)

- Formato en puntos: `Custom.WIDTHxHEIGHT` (72 puntos = 1 pulgada)
  - Ejemplo: `Custom.144x72` (2x1 pulgadas en puntos)

### Orientación (`orientation`)

- `portrait` o `4` - Vertical
- `landscape` o `3` - Horizontal

## Ejemplos

### Configurar impresora de tickets 80mm

```javascript
await fetch('http://127.0.0.1:9100/printer-options/EPSON_TM_T20III', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'X-Giganet-Print-Key': 'TU_API_KEY',
  },
  body: JSON.stringify({
    media: 'Custom.80x200mm',
    orientation: 'portrait',
  }),
});
```

### Configurar impresora de etiquetas Zebra 2x1"

```javascript
await fetch('http://127.0.0.1:9100/printer-options/Zebra_ZD220', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'X-Giganet-Print-Key': 'TU_API_KEY',
  },
  body: JSON.stringify({
    media: 'Custom.2x1in',
    orientation: 'landscape',
  }),
});
```

### Configurar impresora de facturas tamaño carta

```javascript
await fetch('http://127.0.0.1:9100/printer-options/HP_LaserJet', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'X-Giganet-Print-Key': 'TU_API_KEY',
  },
  body: JSON.stringify({
    media: 'Letter',
    orientation: 'portrait',
  }),
});
```

## Comportamiento

### Aplicación Automática

Una vez configuradas las opciones para una impresora, se aplican automáticamente a todas las impresiones enviadas a esa impresora:

```javascript
// Después de configurar la impresora, simplemente imprime
await fetch('http://127.0.0.1:9100/print', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Giganet-Print-Key': 'TU_API_KEY',
  },
  body: JSON.stringify({
    printer: 'EPSON_TM_T20III',  // Usa las opciones configuradas
    type: 'pdf',
    data: pdfBase64,
    copies: 1,
  }),
});
```

### Prioridad de Opciones

Las opciones se combinan en este orden (mayor prioridad al final):

1. **Opciones del role** (si se especifica `role: 'label'`, `'ticket'`, etc.)
2. **Opciones de la impresora** (configuradas con `/printer-options`)

Las opciones de impresora tienen mayor prioridad y sobrescriben las del role.

### Persistencia

Las opciones se guardan en el archivo de configuración:
```
~/Library/Application Support/GiganetPrintService/config.json
```

Ejemplo de estructura en el archivo:
```json
{
  "printerOptions": {
    "EPSON_TM_T20III": {
      "media": "Custom.80x200mm",
      "orientation": "4"
    },
    "Zebra_ZD220": {
      "media": "Custom.2x1in",
      "orientation": "3"
    }
  }
}
```

## Casos de Uso Comunes

### Tickets térmicos 80mm
```json
{
  "media": "Custom.80x200mm",
  "orientation": "portrait"
}
```

### Tickets térmicos 58mm
```json
{
  "media": "Custom.58x200mm",
  "orientation": "portrait"
}
```

### Etiquetas Zebra 2x1 pulgadas
```json
{
  "media": "Custom.2x1in",
  "orientation": "landscape"
}
```

### Etiquetas de envío 4x6 pulgadas
```json
{
  "media": "Custom.4x6in",
  "orientation": "portrait"
}
```

### Facturas tamaño carta
```json
{
  "media": "Letter",
  "orientation": "portrait"
}
```

## Ver también

- [Ejemplo completo de código](./examples/printer-options-example.js)
- Documentación de opciones CUPS: https://www.cups.org/doc/options.html
