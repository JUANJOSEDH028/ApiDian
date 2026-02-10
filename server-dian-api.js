/**
 * API mínima para consultar DIAN por CUFE.
 * Usa Playwright por dentro; desde n8n solo haces un HTTP Request a esta API.
 *
 * Uso:
 *   node server-dian-api.js
 *   Servidor en http://localhost:3456
 *
 * POST /search
 *   Body (JSON): { "cufe": "6667fe1f8018f00e0b631cc9e3d790508f24d474dd3a75d2bc941196e78c8c235990877c2207b82eb5407ff41cbcfc45" }
 *   Response (JSON): { "ok": true, "eventos": [...], "html": "..." } o { "ok": false, "error": "..." }
 *
 * En n8n: un solo nodo HTTP Request → POST http://localhost:3456/search, body { "cufe": "{{ $json.cufe }}" }
 */

const http = require('http');
// Usar versión visible si DIAN_MODE=visible (más confiable pero más lento)
// Por defecto usa headless (más rápido)
const USE_VISIBLE = process.env.DIAN_MODE === 'visible';
const { searchByCufe } = USE_VISIBLE 
  ? require('./dian-search-by-cufe-visible.js')
  : require('./dian-search-by-cufe.js');

if (USE_VISIBLE) {
  console.log('⚠️  Modo VISIBLE activado (más confiable pero más lento)');
}

const PORT = process.env.PORT || 3456;

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST' || req.url !== '/search') {
    res.writeHead(404);
    res.end(JSON.stringify({ ok: false, error: 'POST /search con body JSON { "cufe": "..." }' }));
    return;
  }

  let body = '';
  for await (const chunk of req) body += chunk;
  let json;
  try {
    json = JSON.parse(body);
  } catch (e) {
    res.writeHead(400);
    res.end(JSON.stringify({ ok: false, error: 'Body JSON inválido' }));
    return;
  }

  const cufe = json.cufe || json.CUFE || json.DocumentKey;
  if (!cufe || typeof cufe !== 'string') {
    res.writeHead(400);
    res.end(JSON.stringify({ ok: false, error: 'Falta "cufe" en el body' }));
    return;
  }

  const requestStartTime = Date.now();
  try {
    console.log(`[API] Procesando búsqueda para CUFE: ${cufe.substring(0, 20)}...`);
    const result = await searchByCufe(cufe.trim());
    const requestTime = Date.now() - requestStartTime;
    console.log(`[API] Respuesta enviada en ${requestTime}ms. OK: ${result.ok}`);
    res.writeHead(200);
    res.end(JSON.stringify(result));
  } catch (err) {
    const requestTime = Date.now() - requestStartTime;
    console.error(`[API] Error después de ${requestTime}ms:`, err.message);
    res.writeHead(500);
    res.end(JSON.stringify({ ok: false, error: err.message }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`DIAN API: http://0.0.0.0:${PORT}  →  POST /search con { "cufe": "..." }`);
  console.log(`DIAN API también disponible en: http://localhost:${PORT} y http://127.0.0.1:${PORT}`);
});
