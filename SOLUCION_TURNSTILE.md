# Solución: Problema con Turnstile (Captcha de Cloudflare)

## Problema
Turnstile no se resuelve automáticamente y aparece el error: "Falta Token de validación de captcha"

## Causa
Cloudflare Turnstile puede detectar automatización cuando se ejecuta en modo headless (sin navegador visible).

## Soluciones implementadas

### 1. Mejoras en el código actual (headless)
- ✅ Interacción con la página (scroll, hover, click)
- ✅ Escucha de eventos de Turnstile
- ✅ Tiempos de espera aumentados (30 segundos)
- ✅ Múltiples verificaciones del token

### 2. Si el problema persiste: Usar modo visible

Si después de las mejoras Turnstile sigue sin resolverse, usa la versión visible:

**Opción A: Modificar el servidor para usar modo visible**

Edita `server-dian-api.js` y cambia la importación:

```javascript
// Cambiar esta línea:
const { searchByCufe } = require('./dian-search-by-cufe.js');

// Por esta:
const { searchByCufe } = require('./dian-search-by-cufe-visible.js');
```

**Opción B: Usar directamente el script visible**

```bash
node dian-search-by-cufe-visible.js <CUFE>
```

### 3. Configuración del servidor para modo visible

Si usas modo visible en un servidor sin pantalla, necesitas:

**Linux:**
```bash
# Instalar Xvfb (X Virtual Framebuffer)
sudo apt-get install xvfb

# Ejecutar con Xvfb
xvfb-run -a node server-dian-api.js
```

**O usar xvfb en el código:**
```javascript
// En dian-search-by-cufe-visible.js, ya está configurado para funcionar
// pero en servidor sin pantalla necesitas Xvfb
```

### 4. Alternativa: Usar Stealth Plugin

Si quieres mantener modo headless, puedes intentar usar `playwright-extra` con stealth:

```bash
npm install playwright-extra playwright-extra-plugin-stealth
```

Y modificar el código para usar stealth (más difícil de detectar).

### 5. Verificar logs

Revisa los logs del servidor para ver qué está pasando:

```bash
# Ver logs en tiempo real
node server-dian-api.js

# Buscar mensajes como:
# [DIAN] Turnstile resuelto...
# [DIAN] ADVERTENCIA: Turnstile no resuelto...
# [DIAN] ERROR CRÍTICO: Turnstile no disponible...
```

## Prueba rápida

1. **Probar con curl:**
```bash
curl -X POST http://localhost:3456/search \
  -H "Content-Type: application/json" \
  -d "{\"cufe\": \"6667fe1f8018f00e0b631cc9e3d790508f24d474dd3a75d2bc941196e78c8c235990877c2207b82eb5407ff41cbcfc45\"}"
```

2. **Revisar respuesta:**
- Si `ok: true` → Funciona correctamente
- Si `ok: false` y error menciona "captcha" → Usar modo visible

## Recomendación final

**Para producción en servidor:**
1. Usa modo visible con Xvfb
2. O considera usar un servicio de resolución de captchas
3. O ejecuta en un servidor con pantalla/VNC

**Para desarrollo local:**
- Usa modo visible directamente (`dian-search-by-cufe-visible.js`)

## Notas importantes

- Turnstile puede tardar entre 5-30 segundos en resolverse
- En modo headless, Cloudflare puede ser más estricto
- Los tiempos de espera están configurados para ser generosos
- Si falla consistentemente, es mejor usar modo visible
