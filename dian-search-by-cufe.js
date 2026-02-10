/**
 * Script para consultar un documento en la DIAN por CUFE usando Playwright.
 * Obtiene automáticamente __RequestVerificationToken y cf-turnstile-response
 * al cargar la página en un navegador real.
 *
 * Uso:
 *   node dian-search-by-cufe.js <CUFE>
 *
 * Ejemplo:
 *   node dian-search-by-cufe.js 6667fe1f8018f00e0b631cc9e3d790508f24d474dd3a75d2bc941196e78c8c235990877c2207b82eb5407ff41cbcfc45
 *
 * Salida: JSON por stdout con { ok, html, eventos, error }
 *
 * Requiere: npm install playwright
 * Primera vez: npx playwright install chromium
 */

const { chromium } = require('playwright');

const BASE_URL = 'https://catalogo-vpfe.dian.gov.co';
const SEARCH_URL = `${BASE_URL}/User/SearchDocument`;

async function searchByCufe(cufe) {
  let browser;
  try {
    // Usar headless true (boolean) para compatibilidad con Playwright 1.40
    // Si en el futuro actualizas Playwright a una versión más nueva,
    // puedes cambiar a headless: 'new' si lo deseas.
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage'
      ]
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
      locale: 'es-CO',
      timezoneId: 'America/Bogota',
      viewport: { width: 1920, height: 1080 },
      // Propiedades adicionales para evitar detección
      permissions: [],
      geolocation: undefined,
      colorScheme: 'light'
    });

    const page = await context.newPage();

    // Ocultar webdriver property
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      window.navigator.chrome = { runtime: {} };
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['es-CO', 'es', 'en'] });
    });

    // 1) Ir a la página de búsqueda (genera token y Turnstile)
    await page.goto(SEARCH_URL, { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });

    // Esperar a que la página cargue completamente
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    // 2) Esperar a que exista el input del CUFE
    await page.waitForSelector('#DocumentKey', { timeout: 15000 });

    // Esperar más tiempo para que Turnstile se resuelva completamente
    // Turnstile puede tardar 5-10 segundos en resolverse automáticamente
    await new Promise(r => setTimeout(r, 10000));

    // Verificar si hay error antes de continuar
    const errorCheck = await page.evaluate(() => {
      const errorText = document.body?.textContent || '';
      if (errorText.includes('No se pudo procesar la solicitud') || 
          errorText.includes('The service was not able to process')) {
        const match = errorText.match(/Id:([a-f0-9-]+)/i);
        return { hasError: true, errorId: match ? match[1] : null };
      }
      return { hasError: false };
    });

    if (errorCheck.hasError) {
      await browser.close();
      return { 
        ok: false, 
        error: `DIAN rechazó la petición. Error ID: ${errorCheck.errorId || 'desconocido'}. Posible detección de automatización.`, 
        html: null, 
        eventos: [],
        errorId: errorCheck.errorId
      };
    }

    // 3) Rellenar CUFE con delay humano
    await page.fill('#DocumentKey', '', { timeout: 5000 });
    await new Promise(r => setTimeout(r, 500));
    await page.type('#DocumentKey', cufe, { delay: 100 });

    // 4) Esperar un momento antes de hacer clic
    await new Promise(r => setTimeout(r, 1000));

    // 5) Clic en Buscar y esperar navegación
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
      page.click('button.search-document', { delay: 200 })
    ]);

    // Esperar a que la respuesta cargue
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});

    // 6) Verificar si la respuesta contiene error
    const html = await page.content();
    const finalErrorCheck = await page.evaluate(() => {
      const errorText = document.body?.textContent || '';
      if (errorText.includes('No se pudo procesar la solicitud') || 
          errorText.includes('The service was not able to process')) {
        const match = errorText.match(/Id:([a-f0-9-]+)/i);
        return { hasError: true, errorId: match ? match[1] : null };
      }
      return { hasError: false };
    });

    if (finalErrorCheck.hasError) {
      await browser.close();
      return { 
        ok: false, 
        error: `DIAN rechazó la petición después del POST. Error ID: ${finalErrorCheck.errorId || 'desconocido'}.`, 
        html, 
        eventos: [],
        errorId: finalErrorCheck.errorId
      };
    }

    // 7) Intentar extraer tabla de eventos (código, descripción, fecha, etc.)
    const eventos = await page.evaluate(() => {
      const result = [];
      // Buscar tabla de eventos - puede estar en diferentes estructuras
      const tables = document.querySelectorAll('table');
      tables.forEach(table => {
        const rows = table.querySelectorAll('tbody tr, tr');
        rows.forEach(tr => {
          const cells = tr.querySelectorAll('td');
          if (cells.length >= 2) {
            const codigo = cells[0]?.textContent?.trim() || '';
            const descripcion = cells[1]?.textContent?.trim() || '';
            // Solo agregar si tiene código (evitar filas vacías)
            if (codigo) {
              result.push({
                codigo,
                descripcion,
                fecha: cells[2]?.textContent?.trim() || '',
                nitEmisor: cells[3]?.textContent?.trim() || '',
                emisor: cells[4]?.textContent?.trim() || '',
                nitReceptor: cells[5]?.textContent?.trim() || '',
                receptor: cells[6]?.textContent?.trim() || ''
              });
            }
          }
        });
      });
      return result;
    }).catch(() => []);

    await browser.close();

    return { ok: true, html, eventos };
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    return { ok: false, error: err.message, html: null, eventos: [] };
  }
}

// Exportar para usar como módulo: const { searchByCufe } = require('./dian-search-by-cufe.js');
module.exports = { searchByCufe };

// Ejecutar CLI solo si se invoca directamente (node dian-search-by-cufe.js <CUFE>)
if (require.main === module) {
  const cufeCli = process.argv[2];
  if (!cufeCli) {
    console.error('Uso: node dian-search-by-cufe.js <CUFE>');
    process.exit(1);
  }
  searchByCufe(cufeCli.trim()).then(result => {
    console.log(JSON.stringify(result, null, 0));
    process.exit(result.ok ? 0 : 1);
  });
}
