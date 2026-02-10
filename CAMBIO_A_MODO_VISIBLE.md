# Cómo cambiar a modo visible

## Opción 1: Usar variable de entorno (RECOMENDADO)

El servidor ahora soporta elegir entre modo headless y visible mediante variable de entorno.

### Modo visible (navegador se abre):
```bash
HEADLESS_MODE=false node server-dian-api.js
```

### Modo headless (sin navegador visible):
```bash
HEADLESS_MODE=true node server-dian-api.js
# O simplemente:
node server-dian-api.js
```

## Opción 2: Modificar el código directamente

Si prefieres cambiar permanentemente, edita `server-dian-api.js` línea 22:

```javascript
// Cambiar de:
const HEADLESS_MODE = process.env.HEADLESS_MODE !== 'false';

// A:
const HEADLESS_MODE = false; // Siempre usar modo visible
```

## Opción 3: Usar directamente el script visible

```bash
node dian-search-by-cufe-visible.js <CUFE>
```

## Notas importantes

### Para servidores sin pantalla (Linux)

Si estás en un servidor Linux sin pantalla y quieres usar modo visible, necesitas Xvfb:

```bash
# Instalar Xvfb
sudo apt-get update
sudo apt-get install xvfb

# Ejecutar con Xvfb
xvfb-run -a HEADLESS_MODE=false node server-dian-api.js
```

### Para Windows

Modo visible funciona directamente, el navegador se abrirá automáticamente.

### Ventajas del modo visible

- ✅ Menos detectable por Cloudflare Turnstile
- ✅ Mejor tasa de éxito con captchas
- ✅ Puedes ver qué está pasando en tiempo real

### Desventajas

- ❌ Más lento (el navegador debe renderizar)
- ❌ Requiere pantalla o Xvfb en servidores
- ❌ Consume más recursos

## Verificar qué modo está usando

Cuando inicies el servidor, verás en los logs:

```
[API] Modo: VISIBLE (configurar HEADLESS_MODE=false para modo visible)
```

O:

```
[API] Modo: HEADLESS (configurar HEADLESS_MODE=false para modo visible)
```

## Prueba rápida

1. **Iniciar servidor en modo visible:**
```bash
HEADLESS_MODE=false node server-dian-api.js
```

2. **Probar con curl:**
```bash
curl -X POST http://localhost:3456/search \
  -H "Content-Type: application/json" \
  -d "{\"cufe\": \"6667fe1f8018f00e0b631cc9e3d790508f24d474dd3a75d2bc941196e78c8c235990877c2207b82eb5407ff41cbcfc45\"}"
```

3. **Deberías ver el navegador abrirse** y realizar la búsqueda automáticamente.

## Recomendación

- **Desarrollo local:** Usa modo visible (`HEADLESS_MODE=false`)
- **Producción con pantalla:** Usa modo visible si Turnstile falla en headless
- **Producción sin pantalla:** Usa Xvfb + modo visible, o intenta primero con headless
