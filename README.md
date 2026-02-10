# API DIAN por CUFE (Playwright + n8n)

API mínima en Node.js que usa **Playwright** para consultar la DIAN por **CUFE** y exponer un endpoint HTTP para que otros sistemas (como **n8n**) hagan la consulta con un solo HTTP Request.

## 🚀 Características

- ✅ Resuelve automáticamente Cloudflare Turnstile
- ✅ Extrae tokens de verificación automáticamente
- ✅ Parsea eventos de la respuesta HTML
- ✅ API REST simple (`POST /search`)
- ✅ Listo para integrar con n8n

## 📋 Requisitos

- Node.js 18+
- Acceso a internet hacia `https://catalogo-vpfe.dian.gov.co`

## 🔧 Instalación

```bash
# Clonar el repositorio
git clone https://github.com/JUANJOSEDH028/ApiDian.git
cd ApiDian

# Instalar dependencias
npm install

# Instalar navegador Chromium para Playwright
npx playwright install chromium
```

## 🏃 Ejecutar la API

### Modo simple

```bash
npm start
# o
node server-dian-api.js
```

### Con PM2 (recomendado para producción)

```bash
npm install -g pm2
pm2 start server-dian-api.js --name dian-api
pm2 save
pm2 startup  # para que inicie automáticamente al reiniciar
```

La API escuchará en `http://localhost:3456` (o el puerto configurado en `PORT`).

## 📡 Endpoint

### POST /search

Consulta un documento por CUFE.

**Request:**
```json
{
  "cufe": "6667fe1f8018f00e0b631cc9e3d790508f24d474dd3a75d2bc941196e78c8c235990877c2207b82eb5407ff41cbcfc45"
}
```

**Response (éxito):**
```json
{
  "ok": true,
  "eventos": [
    {
      "codigo": "030",
      "descripcion": "Recibido",
      "fecha": "2024-01-15",
      "nitEmisor": "123456789",
      "emisor": "Empresa XYZ",
      "nitReceptor": "987654321",
      "receptor": "Cliente ABC"
    }
  ],
  "html": "<html>...respuesta completa...</html>"
}
```

**Response (error):**
```json
{
  "ok": false,
  "error": "DIAN rechazó la petición. Error ID: xxx-xxx-xxx",
  "errorId": "xxx-xxx-xxx",
  "html": null,
  "eventos": []
}
```

## 🔌 Integración con n8n

### 1. Importar el flujo

Importa `n8n_DIAN_con_Turnstile.json` en tu n8n.

### 2. Configurar URL de la API

El flujo usa la variable de entorno `DIAN_API_URL` para la URL de la API. Si no está definida, usa `http://localhost:3456` por defecto.

**Opciones:**

- **Misma máquina:** Configura `DIAN_API_URL=http://localhost:3456` en las variables de entorno de n8n
- **Servidor diferente:** Configura `DIAN_API_URL=http://IP_SERVIDOR:3456` (ej: `http://192.168.1.100:3456`)

### 3. Ejecutar el flujo

El flujo incluye:
- ✅ Validación del CUFE antes de enviar
- ✅ Manejo de errores HTTP
- ✅ Procesamiento de eventos (especialmente código 030)
- ✅ División de flujo según éxito/error

**Entrada esperada:**
- Campo `cufe` con el CUFE a consultar

**Salida:**
- `ok`: boolean indicando si la búsqueda fue exitosa
- `eventos`: array de eventos del documento
- `tieneCodigo030`: boolean indicando si hay eventos con código 030 (Recibido)
- `eventos030`: array filtrado solo con eventos código 030
- `error`: mensaje de error si `ok` es false

## 🛠️ Scripts disponibles

```bash
# Iniciar API servidor
npm start

# Buscar CUFE desde CLI
npm run search <CUFE>

# Buscar CUFE con navegador visible (menos detectable)
npm run search:visible <CUFE>

# Extraer solo token de Turnstile (debugging)
npm run extract-token
```

## 🔍 Solución de problemas

### Error: "DIAN rechazó la petición"

La DIAN detectó automatización. Soluciones:

1. **Usar modo visible:** Cambia en `server-dian-api.js`:
   ```javascript
   const { searchByCufe } = require('./dian-search-by-cufe-visible.js');
   ```

2. **Aumentar tiempo de espera:** Edita `dian-search-by-cufe.js` línea 72, aumenta el timeout:
   ```javascript
   await new Promise(r => setTimeout(r, 15000)); // de 10000 a 15000
   ```

3. **Reducir frecuencia:** No hagas más de 1-2 consultas por minuto

### Error: "Cannot find module 'playwright'"

```bash
npm install
npx playwright install chromium
```

### La API no responde

1. Verifica que esté corriendo: `ps aux | grep server-dian-api`
2. Verifica el puerto: `netstat -tuln | grep 3456`
3. Revisa logs si usas PM2: `pm2 logs dian-api`

## 📁 Estructura del proyecto

```
ApiDian/
├── server-dian-api.js          # Servidor HTTP API
├── dian-search-by-cufe.js      # Script Playwright (headless)
├── dian-search-by-cufe-visible.js  # Script Playwright (visible)
├── extraer-turnstile-token.js  # Utilidad para extraer token
├── package.json
├── README.md
└── dian/
    ├── n8n_DIAN_con_Turnstile.json      # Flujo n8n (recomendado)
    ├── n8n_DIAN_HTTP_a_API_local.json   # Flujo n8n alternativo
    ├── n8n_DIAN_solo_HTTP_Request.json  # Flujo solo HTTP (limitado)
    └── COMO_OBTENER_TURNSTILE_EN_N8N.md # Guía detallada
```

## 📝 Variables de entorno

- `PORT`: Puerto donde escucha la API (default: `3456`)
- `DIAN_API_URL`: URL completa de la API (usado en n8n, default: `http://localhost:3456`)

## 📄 Licencia

ISC

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor, abre un issue o pull request.
