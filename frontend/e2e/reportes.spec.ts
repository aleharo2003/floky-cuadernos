import { accion, CELULAR, expect, ingresar, irAReportes, opciones, primeraTabla, reiniciarDatos, sinDesborde, test } from './ayuda';

// La solapa Reportes: período, filtros, totales, exportar, año y PDF. El seed tiene 5 movimientos en marzo.
test.beforeEach(reiniciarDatos);

const filas = (p: import('@playwright/test').Page) => primeraTabla(p).locator('tbody tr');
const kpi = (p: import('@playwright/test').Page, titulo: string) => p.locator('.kpi', { hasText: titulo }).locator('.kpi-valor');

test('filtros: tipo, medio, texto y anulados; los totales los siguen', async ({ page }) => {
  await ingresar(page, 'tomas');
  await irAReportes(page);
  await expect(filas(page)).toHaveCount(5);
  await expect(page.locator('details.filtros-panel')).toHaveJSProperty('open', true);

  await page.locator('.filtros-panel select').nth(0).selectOption('egreso');
  await expect(filas(page)).toHaveCount(3);
  await expect(kpi(page, 'Ingresos del período')).toHaveText('$ 0');
  await expect(page.locator('.filtros-panel summary')).toContainText('1 activo');

  await page.locator('.filtros-panel select').nth(2).selectOption('debit');
  await expect(filas(page)).toHaveCount(1);
  await expect(filas(page).first()).toContainText('Luz');

  await page.getByRole('button', { name: 'Quitar filtros' }).click();
  await expect(filas(page)).toHaveCount(5);
  await page.locator('.filtros-panel input[type=search]').fill('verdu');
  await expect(filas(page)).toHaveCount(1);
  await expect(filas(page).first()).toContainText('Verdura');
  await page.getByRole('button', { name: 'Quitar filtros' }).click();
  await expect(filas(page)).toHaveCount(5);

  // Un anulado sale de la lista; con "Ver anulados" vuelve marcado, sin sumar y sin acciones de cambio.
  await accion(page, 'Luz', 'Anular');
  await page.getByPlaceholder('Por ejemplo: cargado dos veces').fill('era de otro local');
  await page.getByRole('dialog').getByRole('button', { name: /Sí, anular/ }).click();
  await expect(filas(page)).toHaveCount(4);
  await expect(kpi(page, 'Gastos del período')).toHaveText('$ 105.000');
  await page.locator('.filtros-panel input[type=checkbox]').check();
  await expect(filas(page)).toHaveCount(5);
  const luz = filas(page).filter({ hasText: 'Luz' });
  await expect(luz).toContainText('Anulado');
  await expect(luz).toContainText('era de otro local');
  expect(await opciones(page, 'Luz')).toEqual(['Historial']);
  await expect(kpi(page, 'Gastos del período')).toHaveText('$ 105.000');

  const [descarga] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Bajar Excel' }).click()]);
  expect(descarga.suggestedFilename()).toBe('cuadernos-20260301-20260311.xlsx');
});

test('resumen del año: solo meses con movimientos; tocar uno muestra el mes entero', async ({ page }) => {
  await ingresar(page, 'tomas');
  await irAReportes(page);
  const anual = page.locator('.tarjeta', { hasText: 'Resumen del año 2026' });
  await expect(anual.locator('tbody tr')).toHaveCount(1);
  await expect(anual.locator('tbody tr').first()).toContainText('600.000,00');
  await expect(anual.locator('tbody tr').first()).toContainText('200.000,00');
  await anual.getByRole('button', { name: /Ver los 12 meses/ }).click();
  await expect(anual.locator('tbody tr')).toHaveCount(12);
  await anual.getByRole('button', { name: /Ver solo los meses/ }).click();
  await expect(anual.locator('tbody tr')).toHaveCount(1);

  // El nombre del botón incluye el año que se ve, para lectores de pantalla y control por voz.
  await anual.getByRole('button', { name: '2025, año anterior' }).click();
  await expect(page.getByText('Sin movimientos en 2025.')).toBeVisible();
  await page.getByRole('button', { name: '2026, año siguiente' }).click();
  await page.locator('.filtro-fechas').getByRole('button', { name: 'Hoy' }).click();
  await page.locator('.tarjeta', { hasText: 'Resumen del año 2026' }).getByRole('button', { name: 'Marzo' }).click();
  await expect(page.locator('.filtro-fechas input').nth(0)).toHaveValue('2026-03-01');
  await expect(page.locator('.filtro-fechas input').nth(1)).toHaveValue('2026-03-31');
});

test('el PDF lleva local, filtros y fecha, sin formulario ni botones', async ({ page }) => {
  await ingresar(page, 'tomas');
  await irAReportes(page);
  await page.locator('.filtros-panel select').nth(0).selectOption('egreso');
  await expect(filas(page)).toHaveCount(3);
  await expect(kpi(page, 'Ingresos del período')).toHaveText('$ 0');
  await page.emulateMedia({ media: 'print' });
  const cabecera = page.locator('.encabezado-impreso');
  await expect(cabecera).toBeVisible();
  await expect(cabecera).toContainText('Local Norte');
  await expect(cabecera).toContainText('solo gastos');
  await expect(cabecera).toContainText('Emitido el');
  await expect(page.locator('.boton:visible')).toHaveCount(0);
  await expect(page.locator('.solapas')).toBeHidden();
  await expect(page.locator('.tarjeta', { hasText: 'Resumen del año' })).toBeHidden();
});

test('la solapa queda en la dirección y el ⋯ de un renglón entra en la pantalla', async ({ page }) => {
  await ingresar(page, 'tomas');
  await page.getByRole('tab', { name: 'Cargar' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByText('Movimientos del').first()).toBeVisible();
  await expect(page).toHaveURL(/\?ver=reportes$/);
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Reportes' })).toHaveAttribute('aria-selected', 'true');

  await primeraTabla(page).locator('.boton-mas').last().click();
  const menu = (await page.getByRole('menu').boundingBox())!;
  expect(menu.y).toBeGreaterThanOrEqual(0);
  expect(menu.y + menu.height).toBeLessThanOrEqual(900);
  await page.keyboard.press('Escape');
  await expect(primeraTabla(page).locator('.boton-mas').last()).toBeFocused();
});

test('en el celular, consulta arranca con los filtros cerrados y puede exportar', async ({ nuevaPagina }) => {
  const ana = await nuevaPagina(CELULAR);
  await ingresar(ana, 'ana');
  await expect(ana.locator('details.filtros-panel')).toHaveJSProperty('open', false);
  await expect(ana.getByRole('link', { name: 'Bajar Excel' })).toBeVisible();
  await ana.locator('details.filtros-panel summary').click();
  await ana.locator('.filtros-panel select').nth(0).selectOption('ingreso');
  await expect(ana.getByText('Ingresos del período')).toBeVisible();
  expect(await sinDesborde(ana)).toBeLessThanOrEqual(0);
});

test('un período de más de un año avisa sin vaciar la pantalla, y se corrige desde ahí', async ({ page }) => {
  await ingresar(page, 'tomas');
  await irAReportes(page);
  await page.locator('.filtro-fechas input').nth(0).fill('2024-01-01');

  await expect(page.getByRole('alert')).toContainText('un año');
  await expect(page.locator('.filtros-panel'), 'los filtros siguen a la vista').toBeVisible();
  await expect(page.getByRole('link', { name: 'Bajar Excel' }), 'sin datos no se ofrece el Excel').toHaveCount(0);

  await page.locator('.filtro-fechas').getByRole('button', { name: 'Este mes' }).click();
  await expect(filas(page)).toHaveCount(5);
});
