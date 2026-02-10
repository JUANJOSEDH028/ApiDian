/**
 * Servidor HTTP para la API DIAN que usa Playwright.
 * Expone un endpoint POST /search que consulta documentos por CUFE.
 * 
 * Uso:
 *   node server-dian-api.js
 * 
 * Variables de entorno:
 *   PORT: Puerto donde escuchar (default: 3456)
 *   HOST: Host donde escuchar (default: '0.0.0.0' para aceptar conexiones de cualquier IP)
 * 
 * Endpoint:
 *   POST /search
 *   Body: { "cufe": "..." }
 *   Response: { "ok": true/false, "eventos": [...], "html": "...", "error": "..." }
 */

const http = require('http');
const { searchByCufe } = require('./dian-search-by-cufe.js');

const PORT = process.env.PORT || 3456;
// IMPORTANTE: Escuchar en 0.0.0.0 para aceptar conexiones desde Docker y otras interfaces
const HOST = process.env.HOST || '0.0.0.0';

const server = http.createServer(async (req, res) => {
  // Configurar CORS para permitir peticiones desde n8n
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  // Manejar OPTIONS para CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Solo aceptar POST en /search
  if (req.method === 'POST' && req.url === '/search') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const cufe = data.cufe;

        if (!cufe || typeof cufe !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            ok: false, 
            error: 'CUFE es requerido y debe ser una cadena de texto',
            eventos: []
          }));
          return;
        }

        console.log(`[API] Recibida petición para CUFE: ${cufe.substring(0, 20)}...`);
        const result = await searchByCufe(cufe.trim());
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        
        console.log(`[API] Respuesta enviada: ok=${result.ok}, eventos=${result.eventos?.length || 0}`);
      } catch (err) {
        console.error('[API] Error procesando petición:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          ok: false, 
          error: err.message || 'Error interno del servidor',
          eventos: []
        }));
      }
    });
  } else if (req.method === 'GET' && req.url === '/health') {
    // Endpoint de health check
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[API] Servidor DIAN API escuchando en http://${HOST}:${PORT}`);
  console.log(`[API] Endpoint: POST http://${HOST}:${PORT}/search`);
  console.log(`[API] Health check: GET http://${HOST}:${PORT}/health`);
  console.log(`[API] Aceptando conexiones desde cualquier IP (0.0.0.0)`);
});

// Manejar errores del servidor
server.on('error', (err) => {
  console.error('[API] Error del servidor:', err);
  process.exit(1);
});

// Manejar cierre graceful
process.on('SIGTERM', () => {
  console.log('[API] Recibido SIGTERM, cerrando servidor...');
  server.close(() => {
    console.log('[API] Servidor cerrado');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[API] Recibido SIGINT, cerrando servidor...');
  server.close(() => {
    console.log('[API] Servidor cerrado');
    process.exit(0);
  });
});
