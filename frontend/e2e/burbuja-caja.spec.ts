import AxeBuilder from '@axe-core/playwright';
import { cargarMovimiento, expect, formulario, ingresar, reiniciarDatos, test } from './ayuda';

// Arriba de Reportes: la caja de hoy, sin período ni filtros, con un ojito para taparla.
// Datos de ejemplo de Local Norte: la caja termina hoy (11/3) en $ 995.000.
test.beforeEach(reiniciarDatos);

const irAReportes = async (page: import('@playwright/test').Page) => {
  await page.getByRole('tab', { name: 'Reportes' }).click();
  await expect(page.locator('.burbuja-caja')).toBeVisible();
};

test('muestra la caja de hoy y no cambia con el período ni los filtros', async ({ page }) => {
  await ingresar(page, 'tomas');
  await irAReportes(page);
  const burbuja = page.locator('.burbuja-caja');
  await expect(burbuja).toContainText('Caja hoy');
  await expect(burbuja).toContainText('$ 995.000,00');

  await page.locator('.filtros-panel select').nth(0).selectOption('egreso');
  await page.locator('.filtro-fechas').getByRole('button', { name: 'Hoy' }).click();
  await expect(page.locator('.filtros-panel summary')).toContainText('1 activo');
  await expect(burbuja, 'el período y los filtros no la tocan').toContainText('$ 995.000,00');
});

test('se actualiza con lo que se carga hoy, y lo de mañana todavía no cuenta', async ({ page }) => {
  await ingresar(page, 'tomas');
  await cargarMovimiento(page, { tipo: 'Gasto', categoria: 'Proveedores', descripcion: 'Hielo', monto: '5.000', medio: 'Efectivo' });
  // Un gasto con fecha de mañana (se puede cargar por adelantado, P-13).
  const f = formulario(page);
  await f.locator('input[type=date]').fill('2026-03-12');
  await cargarMovimiento(page, { tipo: 'Gasto', categoria: 'Proveedores', descripcion: 'Para mañana', monto: '100.000', medio: 'Efectivo' });
  await irAReportes(page);
  await expect(page.locator('.burbuja-caja')).toContainText('$ 990.000,00');
});

test('el ojito la tapa y se acuerda al volver', async ({ page }) => {
  await ingresar(page, 'tomas');
  await irAReportes(page);
  const burbuja = page.locator('.burbuja-caja');

  await burbuja.getByRole('button', { name: 'Ocultar la caja' }).click();
  await expect(burbuja).toContainText('$ •••••');
  await expect(burbuja).not.toContainText('995');

  await page.reload();
  await irAReportes(page);
  await expect(burbuja, 'quedó tapada en este dispositivo').toContainText('$ •••••');
  await burbuja.getByRole('button', { name: 'Mostrar la caja' }).click();
  await expect(burbuja).toContainText('$ 995.000,00');
});

test('queda a la vista al bajar por la lista', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await ingresar(page, 'tomas');
  await irAReportes(page);
  await page.mouse.wheel(0, 3000);
  await expect(page.locator('.burbuja-caja')).toBeInViewport();
});

for (const modo of ['light', 'dark'] as const) {
  test(`se lee bien, también en rojo, en tema ${modo === 'light' ? 'claro' : 'oscuro'}`, async ({ nuevaPagina }) => {
    const p = await nuevaPagina({ colorScheme: modo });
    await ingresar(p, 'tomas');
    await cargarMovimiento(p, { tipo: 'Gasto', categoria: 'Proveedores', descripcion: 'Error', monto: '2.000.000', medio: 'Efectivo' });
    await irAReportes(p);
    await expect(p.locator('.burbuja-caja-negativa')).toBeVisible();
    for (const oculta of [false, true]) {
      if (oculta) await p.getByRole('button', { name: 'Ocultar la caja' }).click();
      const r = await new AxeBuilder({ page: p }).include('.burbuja-caja').withRules(['color-contrast']).analyze();
      expect(r.violations.flatMap((v) => v.nodes.map((n) => n.failureSummary))).toEqual([]);
    }
  });
}
