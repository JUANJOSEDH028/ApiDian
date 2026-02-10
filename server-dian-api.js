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
// Cambiar a dian-search-by-cufe-visible.js si la versión headless es detectada
const { searchByCufe } = require('./dian-search-by-cufe.js');
// const { searchByCufe } = require('./dian-search-by-cufe-visible.js');

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

  try {
    const result = await searchByCufe(cufe.trim());
    res.writeHead(200);
    res.end(JSON.stringify(result));
  } catch (err) {
    res.writeHead(500);
    res.end(JSON.stringify({ ok: false, error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`DIAN API: http://localhost:${PORT}  →  POST /search con { "cufe": "..." }`);
});
