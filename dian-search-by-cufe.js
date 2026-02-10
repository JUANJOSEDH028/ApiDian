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
  const startTime = Date.now();
  let browser;
  try {
    console.log(`[DIAN] Iniciando búsqueda para CUFE: ${cufe.substring(0, 20)}...`);
    
    // Usar headless true (boolean) para compatibilidad con Playwright 1.40
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer'
      ]
    });
    console.log(`[DIAN] Navegador iniciado (${Date.now() - startTime}ms)`);

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
    console.log(`[DIAN] Cargando página de búsqueda...`);
    await page.goto(SEARCH_URL, { 
      waitUntil: 'domcontentloaded', 
      timeout: 25000 
    });
    console.log(`[DIAN] Página cargada (${Date.now() - startTime}ms)`);

    // Esperar a que exista el input del CUFE y que la página esté completamente cargada
    await page.waitForSelector('#DocumentKey', { timeout: 15000 });
    console.log(`[DIAN] Input CUFE encontrado (${Date.now() - startTime}ms)`);
    
    // Esperar a que Turnstile se cargue (el widget debe estar presente)
    await page.waitForSelector('.cf-turnstile', { timeout: 10000 }).catch(() => {
      console.log(`[DIAN] Widget Turnstile no encontrado, continuando...`);
    });
    
    // Esperar un poco más para que la página termine de cargar scripts
    await new Promise(r => setTimeout(r, 2000));

    // Esperar a que Turnstile se resuelva (máximo 20 segundos)
    console.log(`[DIAN] Esperando resolución de Turnstile...`);
    let turnstileResolved = false;
    let turnstileValue = null;
    
    try {
      await page.waitForFunction(
        () => {
          const input = document.querySelector('input[name="cf-turnstile-response"]');
          if (input && input.value && input.value.length > 50) {
            return input.value;
          }
          // También buscar por ID dinámico
          const inputs = document.querySelectorAll('input[type="hidden"]');
          for (const inp of inputs) {
            if (inp.name === 'cf-turnstile-response' && inp.value && inp.value.length > 50) {
              return inp.value;
            }
          }
          return null;
        },
        { timeout: 20000, polling: 500 } // Verifica cada 500ms, máximo 20 segundos
      );
      
      // Obtener el valor del token
      turnstileValue = await page.evaluate(() => {
        const input = document.querySelector('input[name="cf-turnstile-response"]');
        return input ? input.value : null;
      });
      
      turnstileResolved = true;
      console.log(`[DIAN] Turnstile resuelto (${Date.now() - startTime}ms), token: ${turnstileValue ? turnstileValue.substring(0, 20) + '...' : 'null'}`);
    } catch (e) {
      console.log(`[DIAN] Turnstile no resuelto automáticamente, esperando más tiempo...`);
      // Esperar más tiempo - a veces Turnstile tarda más
      await new Promise(r => setTimeout(r, 5000));
      
      // Verificar nuevamente
      turnstileValue = await page.evaluate(() => {
        const input = document.querySelector('input[name="cf-turnstile-response"]');
        return input && input.value && input.value.length > 50 ? input.value : null;
      });
      
      if (turnstileValue) {
        turnstileResolved = true;
        console.log(`[DIAN] Turnstile resuelto después de espera adicional (${Date.now() - startTime}ms)`);
      } else {
        console.log(`[DIAN] ADVERTENCIA: Turnstile no resuelto, continuando de todas formas...`);
      }
    }

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

    // 3) Rellenar CUFE
    console.log(`[DIAN] Rellenando CUFE...`);
    await page.fill('#DocumentKey', '', { timeout: 5000 });
    await new Promise(r => setTimeout(r, 300));
    await page.type('#DocumentKey', cufe, { delay: 50 });

    // 4) Después de rellenar CUFE, verificar nuevamente que Turnstile sigue activo
    await new Promise(r => setTimeout(r, 1000)); // Esperar un segundo después de escribir
    
    const turnstileBeforeClick = await page.evaluate(() => {
      const input = document.querySelector('input[name="cf-turnstile-response"]');
      return input && input.value && input.value.length > 50 ? input.value : null;
    });
    
    if (!turnstileBeforeClick) {
      console.log(`[DIAN] ADVERTENCIA: Turnstile no está presente antes del clic, esperando más...`);
      // Esperar más tiempo para que Turnstile se reactive
      await new Promise(r => setTimeout(r, 3000));
      
      // Verificar una última vez
      const finalCheck = await page.evaluate(() => {
        const input = document.querySelector('input[name="cf-turnstile-response"]');
        return input && input.value && input.value.length > 50 ? input.value : null;
      });
      
      if (!finalCheck) {
        console.log(`[DIAN] ERROR: Turnstile no disponible. El formulario puede fallar.`);
      } else {
        console.log(`[DIAN] Turnstile verificado antes del clic`);
      }
    } else {
      console.log(`[DIAN] Turnstile verificado antes del clic (${Date.now() - startTime}ms)`);
    }

    // 5) Hacer clic en Buscar y esperar navegación
    console.log(`[DIAN] Haciendo clic en Buscar (${Date.now() - startTime}ms)`);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
      page.click('button.search-document', { delay: 200 })
    ]);

    // Esperar a que la respuesta cargue
    console.log(`[DIAN] Esperando respuesta de DIAN...`);
    await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 1500)); // Espera mínima para renderizado
    console.log(`[DIAN] Respuesta recibida (${Date.now() - startTime}ms)`);

    // 6) Verificar si la respuesta contiene error (incluyendo error de captcha)
    const html = await page.content();
    const finalErrorCheck = await page.evaluate(() => {
      const errorText = document.body?.textContent || '';
      const htmlContent = document.body?.innerHTML || '';
      
      // Verificar errores de DIAN
      if (errorText.includes('No se pudo procesar la solicitud') || 
          errorText.includes('The service was not able to process')) {
        const match = errorText.match(/Id:([a-f0-9-]+)/i);
        return { hasError: true, errorId: match ? match[1] : null, errorType: 'dian_error' };
      }
      
      // Verificar error de captcha/Turnstile
      if (errorText.includes('Falta Token de validación de captcha') ||
          htmlContent.includes('Falta Token de validación de captcha') ||
          errorText.includes('Token de validación de captcha') ||
          htmlContent.includes('field-validation-error')) {
        return { hasError: true, errorId: null, errorType: 'captcha_error' };
      }
      
      return { hasError: false };
    });

    if (finalErrorCheck.hasError) {
      await browser.close();
      let errorMessage = '';
      if (finalErrorCheck.errorType === 'captcha_error') {
        errorMessage = 'DIAN rechazó la petición: Falta Token de validación de captcha (Turnstile). El captcha no se resolvió correctamente.';
      } else {
        errorMessage = `DIAN rechazó la petición después del POST. Error ID: ${finalErrorCheck.errorId || 'desconocido'}.`;
      }
      return { 
        ok: false, 
        error: errorMessage, 
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
    const totalTime = Date.now() - startTime;
    console.log(`[DIAN] Búsqueda completada exitosamente en ${totalTime}ms. Eventos encontrados: ${eventos.length}`);

    return { ok: true, html, eventos };
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    const totalTime = Date.now() - startTime;
    console.error(`[DIAN] Error después de ${totalTime}ms:`, err.message);
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
