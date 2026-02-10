/**
 * Versión con navegador VISIBLE (headless: false) para evitar detección.
 * Úsala si la versión headless está siendo rechazada por la DIAN.
 * Incluye todas las mejoras de la versión headless pero con navegador visible.
 *
 * Uso: igual que dian-search-by-cufe.js
 */

const { chromium } = require('playwright');

const BASE_URL = 'https://catalogo-vpfe.dian.gov.co';
const SEARCH_URL = `${BASE_URL}/User/SearchDocument`;

async function searchByCufe(cufe) {
  const startTime = Date.now();
  let browser;
  try {
    console.log(`[DIAN] Iniciando búsqueda para CUFE: ${cufe.substring(0, 20)}...`);
    
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
    console.log(`[DIAN] Navegador iniciado (VISIBLE) (${Date.now() - startTime}ms)`);

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
    
    // Esperar a que los scripts de Turnstile se carguen completamente
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));
    
    // Interactuar con la página para activar Turnstile
    console.log(`[DIAN] Interactuando con la página para activar Turnstile...`);
    try {
      // Hacer scroll para activar eventos
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight / 2);
      });
      await new Promise(r => setTimeout(r, 1000));
      
      // Mover el mouse sobre el input para simular interacción humana
      await page.hover('#DocumentKey');
      await new Promise(r => setTimeout(r, 500));
      
      // Hacer clic en el input para activar Turnstile
      await page.click('#DocumentKey', { delay: 100 });
      await new Promise(r => setTimeout(r, 1000));
    } catch (e) {
      console.log(`[DIAN] Error al interactuar con la página: ${e.message}`);
    }

    // Esperar a que Turnstile se resuelva (máximo 30 segundos)
    console.log(`[DIAN] Esperando resolución de Turnstile...`);
    let turnstileResolved = false;
    let turnstileValue = null;
    
    // Escuchar eventos de Turnstile usando Promise
    const turnstilePromise = page.evaluate(() => {
      return new Promise((resolve) => {
        // Verificar si ya está resuelto
        const checkTurnstile = () => {
          const input = document.querySelector('input[name="cf-turnstile-response"]');
          if (input && input.value && input.value.length > 50) {
            resolve(input.value);
            return true;
          }
          return false;
        };
        
        if (checkTurnstile()) return;
        
        // Escuchar cambios en el input
        const observer = new MutationObserver(() => {
          if (checkTurnstile()) {
            observer.disconnect();
          }
        });
        
        const input = document.querySelector('input[name="cf-turnstile-response"]');
        if (input) {
          observer.observe(input, { attributes: true, attributeFilter: ['value'] });
          
          // También escuchar eventos de input
          input.addEventListener('change', () => {
            if (checkTurnstile()) {
              observer.disconnect();
            }
          }, { once: true });
        }
        
        // Timeout después de 30 segundos
        setTimeout(() => {
          observer.disconnect();
          resolve(null);
        }, 30000);
      });
    });
    
    try {
      // Esperar con timeout de 30 segundos
      turnstileValue = await Promise.race([
        turnstilePromise,
        new Promise((resolve) => setTimeout(() => resolve(null), 30000))
      ]);
      
      if (turnstileValue) {
        turnstileResolved = true;
        console.log(`[DIAN] Turnstile resuelto (${Date.now() - startTime}ms), token: ${turnstileValue.substring(0, 20)}...`);
      } else {
        // Verificar una última vez manualmente
        turnstileValue = await page.evaluate(() => {
          const input = document.querySelector('input[name="cf-turnstile-response"]');
          return input && input.value && input.value.length > 50 ? input.value : null;
        });
        
        if (turnstileValue) {
          turnstileResolved = true;
          console.log(`[DIAN] Turnstile resuelto después de verificación manual (${Date.now() - startTime}ms)`);
        } else {
          console.log(`[DIAN] ADVERTENCIA: Turnstile no resuelto después de 30 segundos...`);
          // Esperar un poco más como último recurso
          await new Promise(r => setTimeout(r, 5000));
          
          turnstileValue = await page.evaluate(() => {
            const input = document.querySelector('input[name="cf-turnstile-response"]');
            return input && input.value && input.value.length > 50 ? input.value : null;
          });
          
          if (turnstileValue) {
            turnstileResolved = true;
            console.log(`[DIAN] Turnstile resuelto después de espera adicional (${Date.now() - startTime}ms)`);
          }
        }
      }
    } catch (e) {
      console.log(`[DIAN] Error esperando Turnstile: ${e.message}`);
      // Verificar una última vez
      turnstileValue = await page.evaluate(() => {
        const input = document.querySelector('input[name="cf-turnstile-response"]');
        return input && input.value && input.value.length > 50 ? input.value : null;
      });
      
      if (turnstileValue) {
        turnstileResolved = true;
        console.log(`[DIAN] Turnstile encontrado después del error (${Date.now() - startTime}ms)`);
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

    // 3) Rellenar CUFE (solo si no está ya rellenado)
    console.log(`[DIAN] Rellenando CUFE...`);
    const currentValue = await page.inputValue('#DocumentKey').catch(() => '');
    if (currentValue !== cufe) {
      await page.fill('#DocumentKey', '', { timeout: 5000 });
      await new Promise(r => setTimeout(r, 300));
      await page.type('#DocumentKey', cufe, { delay: 50 });
    } else {
      console.log(`[DIAN] CUFE ya está rellenado`);
    }

    // 4) Después de rellenar CUFE, interactuar nuevamente y verificar Turnstile
    await new Promise(r => setTimeout(r, 1000)); // Esperar un segundo después de escribir
    
    // Hacer scroll y mover mouse para mantener Turnstile activo
    try {
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await new Promise(r => setTimeout(r, 500));
      await page.hover('button.search-document');
      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      console.log(`[DIAN] Error al interactuar antes del clic: ${e.message}`);
    }
    
    const turnstileBeforeClick = await page.evaluate(() => {
      const input = document.querySelector('input[name="cf-turnstile-response"]');
      return input && input.value && input.value.length > 50 ? input.value : null;
    });
    
    if (!turnstileBeforeClick) {
      console.log(`[DIAN] ADVERTENCIA: Turnstile no está presente antes del clic, esperando más...`);
      // Esperar más tiempo para que Turnstile se reactive
      await new Promise(r => setTimeout(r, 5000));
      
      // Verificar una última vez
      const finalCheck = await page.evaluate(() => {
        const input = document.querySelector('input[name="cf-turnstile-response"]');
        return input && input.value && input.value.length > 50 ? input.value : null;
      });
      
      if (!finalCheck) {
        console.log(`[DIAN] ERROR CRÍTICO: Turnstile no disponible. El formulario fallará.`);
      } else {
        console.log(`[DIAN] Turnstile verificado antes del clic después de espera adicional`);
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

// Exportar para usar como módulo: const { searchByCufe } = require('./dian-search-by-cufe-visible.js');
module.exports = { searchByCufe };

// Ejecutar CLI solo si se invoca directamente (node dian-search-by-cufe-visible.js <CUFE>)
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
