// Saca las capturas de las guías desde la app corriendo con el seed de demo recién cargado.
// Uso: GUIAS_URL=http://127.0.0.1:8000 node capturas.cjs   (ver README.md)
// Solo datos inventados: el seed no tiene nada real.
const path = require('node:path');
const moduloPlaywright = process.env.GUIAS_NODE_MODULES ? path.join(process.env.GUIAS_NODE_MODULES, 'playwright') : 'playwright';
const { chromium } = require(moduloPlaywright);

const BASE = process.env.GUIAS_URL || 'http://127.0.0.1:8000';
const IMG = path.join(__dirname, '..', 'img');
const CLAVE = 'clave-de-prueba-123';
const celular = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
// 1100 px de ancho: la letra queda legible cuando la captura entra en una hoja A4.
const compu = { viewport: { width: 1100, height: 860 }, deviceScaleFactor: 2 };

async function abrir(browser, opciones) {
  const ctx = await browser.newContext({ ...opciones, locale: 'es-AR', timezoneId: 'America/Argentina/Buenos_Aires' });
  return ctx.newPage();
}

async function ingresar(p, usuario, local) {
  await p.goto(`${BASE}/ingresar`);
  await p.fill('input[autocomplete=username]', usuario);
  await p.fill('input[type=password]', CLAVE);
  await p.click('button[type=submit]');
  if (local) {
    await p.waitForURL('**/elegir-local');
    await p.click(`text=${local}`);
  }
  await p.waitForSelector('text=Movimientos del');
  await p.waitForTimeout(500);
}

const foto = (loc, nombre) => loc.screenshot({ path: path.join(IMG, `${nombre}.png`) });
const tarjeta = (p, titulo) => p.locator(`.tarjeta:has(h2:text-is("${titulo}"))`).first();

(async () => {
  // El idioma del navegador decide el formato de los campos de fecha: dd/mm/aaaa.
  const browser = await chromium.launch({
    args: ['--lang=es-AR'],
    env: { ...process.env, LANG: 'es_AR.UTF-8', LANGUAGE: 'es_AR:es' },
  });

  // Ingreso y elegir local (Lucía tiene dos locales)
  let p = await abrir(browser, celular);
  await p.goto(`${BASE}/ingresar`);
  await p.fill('input[autocomplete=username]', 'lucia');
  await p.screenshot({ path: path.join(IMG, 'ingresar.png'), clip: { x: 0, y: 0, width: 390, height: 520 } });
  await p.fill('input[type=password]', CLAVE);
  await p.click('button[type=submit]');
  await p.waitForURL('**/elegir-local');
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(IMG, 'elegir-local.png'), clip: { x: 0, y: 0, width: 390, height: 400 } });
  await p.click('text=Local Norte');
  await p.waitForSelector('text=Movimientos del');
  await p.waitForTimeout(500);
  await foto(p.locator('.barra'), 'barra-local');

  // Haber inicial: Local Centro todavía no tiene
  p = await abrir(browser, compu);
  await ingresar(p, 'lucia', 'Local Centro');
  const caja = p.locator('.tarjeta:has(h2:text("Caja en efectivo"))');
  await caja.locator('input[type=date]').fill('2026-10-31');
  await caja.locator('.segmentado button:text-is("Noche")').click();
  await caja.locator('input[inputmode=decimal]').fill('850.000');
  await foto(caja, 'haber-inicial');

  // Cargar un movimiento (Tomás, rol carga): una venta con Mercado Pago, turno noche
  p = await abrir(browser, celular);
  await ingresar(p, 'tomas');
  const form = p.locator('form.formulario').first();
  await form.locator('.segmentado button:text-is("Noche")').click();
  await form.locator('.segmentado button:text-is("Ingreso")').click();
  await form.locator('select').first().selectOption({ label: 'Ventas' });
  await form.locator('input[placeholder="Por ejemplo: verdura"]').fill('Cobrado por Mercado Pago');
  await form.locator('input[inputmode=decimal]').fill('150.000');
  await form.locator('select').nth(1).selectOption({ label: 'QR / Mercado Pago' });
  await foto(p.locator('.ancla-carga'), 'cargar');
  await form.locator('button:has-text("Guardar movimiento")').click();
  await p.locator('table').first().locator('td:has-text("Cobrado por Mercado Pago")').first().waitFor();

  // Corregir y anular, para que el historial tenga algo
  await p.click('tr:has-text("Verdura") button:has-text("Corregir")');
  await form.locator('input[inputmode=decimal]').fill('48.000');
  await p.fill('input[placeholder="Por ejemplo: el monto era otro"]', 'El ticket decía 48.000');
  await form.locator('button:has-text("Guardar corrección")').click();
  await p.waitForSelector('text=Cargar movimiento');
  await p.click('tr:has-text("Adelanto") button:has-text("Anular")');
  await p.fill('input[placeholder="Por ejemplo: cargado dos veces"]', 'Cargado dos veces');
  await p.waitForTimeout(300);
  await foto(p.locator('[role=dialog]'), 'anular');
  await p.keyboard.press('Escape');
  await p.click('tr:has-text("Verdura") button:has-text("Historial")');
  await p.waitForFunction(() => document.querySelectorAll('[role=dialog] tbody tr').length >= 2);
  await foto(p.locator('[role=dialog]'), 'historial');
  await p.keyboard.press('Escape');

  // Pantallas de compu: totales, caja, filtros y resumen del año
  p = await abrir(browser, compu);
  await ingresar(p, 'tomas');
  await foto(p.locator('.indicadores-compactos'), 'totales');
  await foto(p.locator('.tarjeta:has(h2:text("Caja en efectivo"))'), 'caja');
  await p.selectOption('.filtros-panel select >> nth=0', 'egreso');
  await p.waitForTimeout(600);
  await p.evaluate(() => window.scrollTo(0, 0));
  const arriba = await p.evaluate(() => {
    const r = document.querySelector('.filtros-panel').getBoundingClientRect();
    return Math.round(r.bottom + 8);
  });
  await p.screenshot({ path: path.join(IMG, 'filtros-y-exportar.png'), clip: { x: 0, y: 56, width: 1100, height: arriba - 56 } });

  // En el celular, el resumen del año muestra solo los meses con movimientos
  p = await abrir(browser, celular);
  await ingresar(p, 'tomas');
  await foto(tarjeta(p, `Resumen del año ${new Date().getFullYear()}`), 'resumen-anual');

  await browser.close();
  console.log('Capturas listas en', IMG);
})();
