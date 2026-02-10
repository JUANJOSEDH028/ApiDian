# Cómo obtener el token de Cloudflare Turnstile en n8n

## ⚠️ Problema

Cloudflare Turnstile **NO se puede obtener solo con HTTP Request** porque requiere ejecutar JavaScript en un navegador real. El token `cf-turnstile-response` se genera dinámicamente cuando el widget de Turnstile se carga y resuelve en la página.

## ✅ Soluciones disponibles

Tienes **3 opciones** para obtener el token de Turnstile desde n8n:

---

## Opción 1: API Local con Playwright (RECOMENDADA) ⭐

**La más simple y confiable.** Usas un solo nodo HTTP Request en n8n que llama a tu propia API local.

### Pasos:

1. **Inicia el servidor API local:**
   ```bash
   node server-dian-api.js
   ```
   El servidor quedará escuchando en `http://localhost:3456`

2. **En n8n, usa el flujo:** `n8n_DIAN_con_Turnstile.json`
   - Un solo nodo **HTTP Request** → POST `http://localhost:3456/search`
   - Body: `{ "cufe": "{{ $json.cufe }}" }`
   - Respuesta: `{ "ok": true, "eventos": [...], "html": "..." }`

### Ventajas:
- ✅ Solo necesitas un nodo HTTP Request en n8n
- ✅ El servidor API maneja automáticamente Turnstile con Playwright
- ✅ Respuesta ya parseada (eventos extraídos)
- ✅ Fácil de mantener y actualizar

### Desventajas:
- ❌ Requiere tener Node.js y Playwright instalados en el servidor
- ❌ El servidor debe estar corriendo siempre

---

## Opción 2: Execute Command en n8n

Ejecutas directamente el script de Playwright desde n8n usando el nodo **Execute Command**.

### Pasos:

1. **Asegúrate de tener instalado:**
   - Node.js en el servidor donde corre n8n
   - Playwright: `npm install playwright` y `npx playwright install chromium`

2. **En n8n, crea un nodo Execute Command:**
   - **Command:** `node`
   - **Arguments:** 
     ```
     "C:\ruta\completa\dian-search-by-cufe.js" {{ $json.cufe }}
     ```
     O en Linux/Mac:
     ```
     /ruta/completa/dian-search-by-cufe.js {{ $json.cufe }}
     ```

3. **Procesa la salida:**
   - El script devuelve JSON por stdout: `{ "ok": true, "eventos": [...], "html": "..." }`
   - Usa un nodo **Code** siguiente para parsear el stdout:
   ```javascript
   const item = $input.first();
   const stdout = item.json.stdout || item.json.output || '';
   const result = JSON.parse(stdout);
   return [{ json: result }];
   ```

### Ventajas:
- ✅ No necesitas un servidor API separado
- ✅ Todo queda en n8n

### Desventajas:
- ❌ Requiere acceso al sistema de archivos desde n8n
- ❌ Más complejo de configurar
- ❌ Depende de la configuración del entorno de n8n

---

## Opción 3: Extraer token manualmente (NO RECOMENDADA)

Si necesitas el token `cf-turnstile-response` para usarlo en una petición HTTP directa:

### Pasos:

1. **Abre la página en tu navegador:**
   - Ve a `https://catalogo-vpfe.dian.gov.co/User/SearchDocument`
   - Abre DevTools (F12) → pestaña **Network**

2. **Realiza una búsqueda manual:**
   - Ingresa un CUFE y haz clic en Buscar
   - En Network, busca la petición POST a `SearchDocument`

3. **Copia el token:**
   - Click en la petición → pestaña **Payload** → busca `cf-turnstile-response`
   - Copia el valor completo

4. **En n8n, agrega un nodo Set antes del POST:**
   - Crea un campo `cfTurnstileResponse` con el token copiado
   - El token expira rápido (minutos), así que tendrás que actualizarlo frecuentemente

### Ventajas:
- ✅ No requiere Playwright ni servidor adicional

### Desventajas:
- ❌ El token expira rápido (5-15 minutos)
- ❌ No es automatizable
- ❌ Solo sirve para pruebas puntuales

---

## Comparación de opciones

| Opción | Automatización | Complejidad | Confiabilidad | Recomendación |
|--------|----------------|-------------|--------------|---------------|
| **API Local** | ✅ Completa | ⭐⭐ Baja | ⭐⭐⭐ Alta | ⭐⭐⭐ **RECOMENDADA** |
| **Execute Command** | ✅ Completa | ⭐⭐⭐ Media | ⭐⭐⭐ Alta | ⭐⭐ Buena alternativa |
| **Manual** | ❌ No | ⭐ Muy baja | ⭐ Baja | ⭐ Solo pruebas |

---

## Configuración detallada: Opción 1 (API Local)

### 1. Instalar dependencias

```bash
cd C:\Users\desarrollos5\Documents\contabilidad
npm install playwright
npx playwright install chromium
```

### 2. Iniciar el servidor API

```bash
node server-dian-api.js
```

Deberías ver:
```
DIAN API: http://localhost:3456  →  POST /search con { "cufe": "..." }
```

### 3. Probar la API manualmente

```bash
curl -X POST http://localhost:3456/search \
  -H "Content-Type: application/json" \
  -d "{\"cufe\": \"6667fe1f8018f00e0b631cc9e3d790508f24d474dd3a75d2bc941196e78c8c235990877c2207b82eb5407ff41cbcfc45\"}"
```

O desde Postman:
- POST `http://localhost:3456/search`
- Body (JSON): `{ "cufe": "TU_CUFE_AQUI" }`

### 4. Importar flujo en n8n

1. Abre n8n
2. Importa el archivo `n8n_DIAN_con_Turnstile.json`
3. Ajusta la URL del servidor si no es `localhost:3456`
4. Ejecuta el flujo

---

## Solución a problemas comunes

### Error: "Cannot find module 'playwright'"

**Solución:** Instala Playwright en la carpeta del proyecto:
```bash
npm install playwright
npx playwright install chromium
```

### Error: "DIAN rechazó la petición"

**Solución:** La DIAN detectó automatización. Prueba:
1. Usar `dian-search-by-cufe-visible.js` (modo visible) en lugar de `dian-search-by-cufe.js`
2. Aumentar el tiempo de espera para Turnstile (línea 72 del script)
3. Reducir la frecuencia de consultas (máximo 1-2 por minuto)

### El servidor API no responde

**Solución:** Verifica que:
1. El servidor esté corriendo: `node server-dian-api.js`
2. El puerto 3456 esté disponible
3. No haya firewall bloqueando el puerto
4. Si n8n está en otro servidor, cambia `localhost` por la IP del servidor

---

## Archivos relacionados

- `server-dian-api.js` - Servidor API que usa Playwright
- `dian-search-by-cufe.js` - Script Playwright (headless)
- `dian-search-by-cufe-visible.js` - Script Playwright (modo visible, menos detectable)
- `n8n_DIAN_con_Turnstile.json` - Flujo n8n usando API local
- `n8n_DIAN_solo_HTTP_Request.json` - Flujo solo HTTP (sin Turnstile, limitado)

---

## Próximos pasos

1. **Elige la opción que mejor se adapte a tu entorno**
2. **Configura el servidor API o Execute Command según tu elección**
3. **Prueba con un CUFE de ejemplo**
4. **Integra el resultado en tu flujo de trabajo**

Si tienes problemas, revisa los logs del servidor API o del script Playwright para ver errores específicos.
