/**
 * Versión con navegador VISIBLE (headless: false) para evitar detección.
 * Úsala si la versión headless está siendo rechazada por la DIAN.
 *
 * Uso: igual que dian-search-by-cufe.js
 */

const { chromium } = require('playwright');

const BASE_URL = 'https://catalogo-vpfe.dian.gov.co';
const SEARCH_URL = `${BASE_URL}/User/SearchDocument`;

async function searchByCufe(cufe) {
  let browser;
  try {
    // MODO VISIBLE - menos detectable pero más lento
    browser = await chromium.launch({
      headless: false, // Navegador visible
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--start-maximized'
      ]
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
      locale: 'es-CO',
      timezoneId: 'America/Bogota',
      viewport: null, // Usar tamaño completo de ventana
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

    await page.goto(SEARCH_URL, { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });

    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForSelector('#DocumentKey', { timeout: 15000 });

    // Esperar más tiempo para Turnstile
    await new Promise(r => setTimeout(r, 12000));

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
        error: `DIAN rechazó la petición. Error ID: ${errorCheck.errorId || 'desconocido'}.`, 
        html: null, 
        eventos: [],
        errorId: errorCheck.errorId
      };
    }

    await page.fill('#DocumentKey', '', { timeout: 5000 });
    await new Promise(r => setTimeout(r, 500));
    await page.type('#DocumentKey', cufe, { delay: 150 });

    await new Promise(r => setTimeout(r, 1500));

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
      page.click('button.search-document', { delay: 300 })
    ]);

    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});

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

    const eventos = await page.evaluate(() => {
      const result = [];
      const tables = document.querySelectorAll('table');
      tables.forEach(table => {
        const rows = table.querySelectorAll('tbody tr, tr');
        rows.forEach(tr => {
          const cells = tr.querySelectorAll('td');
          if (cells.length >= 2) {
            const codigo = cells[0]?.textContent?.trim() || '';
            const descripcion = cells[1]?.textContent?.trim() || '';
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

module.exports = { searchByCufe };

if (require.main === module) {
  const cufeCli = process.argv[2];
  if (!cufeCli) {
    console.error('Uso: node dian-search-by-cufe-visible.js <CUFE>');
    process.exit(1);
  }
  searchByCufe(cufeCli.trim()).then(result => {
    console.log(JSON.stringify(result, null, 0));
    process.exit(result.ok ? 0 : 1);
  });
}
