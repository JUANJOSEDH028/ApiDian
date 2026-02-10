/**
 * Script para extraer SOLO el token de Cloudflare Turnstile de la página DIAN.
 * Útil para debugging o para obtener el token manualmente.
 * 
 * Uso:
 *   node extraer-turnstile-token.js
 * 
 * El script abre la página, espera a que Turnstile se resuelva,
 * y muestra el token cf-turnstile-response en la consola.
 */

const { chromium } = require('playwright');

const BASE_URL = 'https://catalogo-vpfe.dian.gov.co';
const SEARCH_URL = `${BASE_URL}/User/SearchDocument`;

async function extractTurnstileToken() {
  let browser;
  try {
    browser = await chromium.launch({
      headless: 'new',
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
      viewport: { width: 1920, height: 1080 }
    });

    const page = await context.newPage();

    // Ocultar webdriver property
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      window.navigator.chrome = { runtime: {} };
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['es-CO', 'es', 'en'] });
    });

    console.log('Cargando página de búsqueda DIAN...');
    await page.goto(SEARCH_URL, { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });

    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForSelector('#DocumentKey', { timeout: 15000 });

    console.log('Esperando a que Turnstile se resuelva (puede tardar 10-15 segundos)...');
    
    // Esperar a que Turnstile se resuelva
    await new Promise(r => setTimeout(r, 12000));

    // Extraer el token de Turnstile del formulario
    const turnstileToken = await page.evaluate(() => {
      // Buscar el input hidden con name="cf-turnstile-response"
      const input = document.querySelector('input[name="cf-turnstile-response"]');
      return input ? input.value : null;
    });

    // También extraer el _RequestVerificationToken
    const verificationToken = await page.evaluate(() => {
      const input = document.querySelector('input[name="_RequestVerificationToken"]') || 
                    document.querySelector('input[name="__RequestVerificationToken"]');
      return input ? input.value : null;
    });

    // Extraer cookies
    const cookies = await context.cookies();
    const cookieToken = cookies.find(c => c.name === '_RequestVerificationToken')?.value || null;
    const arraffinity = cookies.find(c => c.name === 'ARRAffinity')?.value || null;
    const arraffinitySameSite = cookies.find(c => c.name === 'ARRAffinitySameSite')?.value || null;

    await browser.close();

    if (!turnstileToken) {
      console.error('❌ No se pudo obtener el token de Turnstile. Puede que aún no se haya resuelto.');
      console.log('💡 Intenta aumentar el tiempo de espera o ejecutar en modo visible (headless: false)');
      process.exit(1);
    }

    console.log('\n✅ Token de Turnstile obtenido exitosamente!\n');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('TOKEN DE TURNSTILE (cf-turnstile-response):');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(turnstileToken);
    console.log('═══════════════════════════════════════════════════════════════\n');

    if (verificationToken) {
      console.log('_RequestVerificationToken (del formulario):');
      console.log(verificationToken);
      console.log('');
    }

    if (cookieToken) {
      console.log('_RequestVerificationToken (de la cookie):');
      console.log(cookieToken);
      console.log('');
    }

    if (arraffinity) {
      console.log('ARRAffinity:', arraffinity);
      console.log('ARRAffinitySameSite:', arraffinitySameSite || arraffinity);
      console.log('');
    }

    console.log('⚠️  IMPORTANTE: Este token expira en 5-15 minutos.');
    console.log('⚠️  Para uso en producción, usa el flujo completo con Playwright.\n');

    // Devolver JSON para uso programático
    return {
      ok: true,
      cfTurnstileResponse: turnstileToken,
      requestVerificationToken: verificationToken,
      cookieToken: cookieToken,
      arraffinity: arraffinity,
      arraffinitySameSite: arraffinitySameSite
    };

  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

// Ejecutar si se invoca directamente
if (require.main === module) {
  extractTurnstileToken().then(result => {
    // Si se ejecuta con --json, devolver JSON
    if (process.argv.includes('--json')) {
      console.log(JSON.stringify(result, null, 2));
    }
  });
}

module.exports = { extractTurnstileToken };
