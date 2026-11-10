import { accion, cargarMovimiento, CELULAR, elegirPeriodo, expect, formulario, ingresar, irACargar, irAReportes, primeraTabla, reiniciarDatos, sinDesborde, test } from './ayuda';
import type { Page } from '@playwright/test';

// Caja en efectivo por turno (ADR-0008, ADR-0016). El seed arranca con haber inicial de $ 500.000.
test.beforeEach(reiniciarDatos);

const caja = (p: Page) => p.locator('.tarjeta', { has: p.getByRole('heading', { name: /Caja en efectivo/ }) });
const cajaAlCierre = (p: Page) => p.locator('.kpi', { hasText: 'Caja al cierre' }).locator('.kpi-valor');

/** Carga en la solapa Cargar y vuelve a Reportes, donde están la caja y los totales. */
async function cargarYVolver(p: Page, m: Parameters<typeof cargarMovimiento>[1]) {
  await irACargar(p);
  await cargarMovimiento(p, m);
  await irAReportes(p);
  await elegirPeriodo(p, 'Este mes');
  await expect(primeraTabla(p).locator('td', { hasText: m.descripcion }).first()).toBeVisible();
}

test('la caja suma efectivo, ignora lo cobrado sin efectivo, avisa si da negativa y no sigue los filtros', async ({ page }) => {
  await ingresar(page, 'tomas');
  await irAReportes(page);
  await elegirPeriodo(page, 'Este mes');
  await expect(caja(page)).toContainText('Arranca con $ 500.000,00');
  // 500.000 + 600.000 de ventas en efectivo - 105.000 de gastos en efectivo (la luz fue con débito).
  await expect(cajaAlCierre(page)).toHaveText('$ 995.000');

  // Una venta con Mercado Pago suma ventas pero no entra a la caja.
  await cargarYVolver(page, { tipo: 'Ingreso', categoria: 'Ventas', descripcion: 'Venta MP', monto: '200000', medio: 'QR / Mercado Pago', turno: 'Noche' });
  await expect(page.locator('.kpi', { hasText: 'Ingresos del período' }).locator('.kpi-valor')).toHaveText('$ 800.000');
  await expect(cajaAlCierre(page)).toHaveText('$ 995.000');
  const noche = caja(page).locator('tbody tr').first();
  await expect(noche).toContainText('520.000,00');
  await expect(noche).toContainText('-$ 200.000,00');
  await irACargar(page);
  await expect(
    formulario(page).getByRole('group', { name: 'Turno' }).getByRole('button', { name: 'Noche' }),
    'el formulario propone el turno usado hoy',
  ).toHaveAttribute('aria-pressed', 'true');
  await irAReportes(page);

  // Un gasto en efectivo enorme deja la caja negativa: avisa, no bloquea. Al anularlo vuelve.
  await cargarYVolver(page, { tipo: 'Gasto', categoria: 'Proveedores', descripcion: 'Error de tipeo', monto: '2000000', medio: 'Efectivo', turno: 'Noche' });
  await expect(cajaAlCierre(page)).toHaveText('-$ 1.005.000');
  await expect(caja(page).locator('.aviso-caja')).toBeVisible();
  await expect(caja(page).locator('.badge', { hasText: 'Revisar' })).toHaveCount(1);
  await accion(page, 'Error de tipeo', 'Anular');
  await page.getByPlaceholder('Por ejemplo: cargado dos veces').fill('eran 20.000');
  await page.getByRole('dialog').getByRole('button', { name: /Sí, anular/ }).click();
  await expect(cajaAlCierre(page)).toHaveText('$ 995.000');
  await expect(caja(page).locator('.aviso-caja')).toBeHidden();
  await expect(caja(page).getByRole('button', { name: 'Cambiar haber inicial' }), 'carga no cambia el haber inicial').toHaveCount(0);

  // "4.000" es cuatro mil, como se tipea en Argentina.
  await cargarYVolver(page, { tipo: 'Gasto', categoria: 'Proveedores', descripcion: 'Hielo', monto: '4.000', medio: 'Efectivo', turno: 'Noche' });
  await expect(primeraTabla(page).locator('tr', { hasText: 'Hielo' })).toContainText('-$ 4.000,00');
  await expect(cajaAlCierre(page)).toHaveText('$ 991.000');

  await page.locator('.filtros-panel select').nth(0).selectOption('egreso');
  await expect(primeraTabla(page).locator('tbody tr')).toHaveCount(4);
  await expect(cajaAlCierre(page), 'la caja no sigue los filtros').toHaveText('$ 991.000');
});

test('sin haber inicial, consulta lo ve dicho; la dueña lo carga y lo cambia con motivo', async ({ page, nuevaPagina }) => {
  const ana = await nuevaPagina(CELULAR);
  await ingresar(ana, 'ana');
  await expect(caja(ana)).toContainText('Lo carga el dueño');
  await expect(cajaAlCierre(ana)).toContainText('Sin dato');
  expect(await sinDesborde(ana)).toBeLessThanOrEqual(0);

  await ingresar(page, 'lucia', { local: 'Local Centro' });
  await irAReportes(page);
  const c = caja(page);
  await expect(c.locator('input[type=date]'), 'solo el monto: sin fecha ni turno').toHaveCount(0);
  await c.locator('input[inputmode=decimal]').fill('1.234.567,89');
  await c.getByRole('button', { name: /Guardar haber inicial/ }).click();
  await expect(c).toContainText('Arranca con $ 1.234.567,89');

  await c.getByRole('button', { name: 'Cambiar haber inicial' }).click();
  const ventana = page.getByRole('dialog');
  const guardar = ventana.getByRole('button', { name: /Guardar cambio/ });
  await expect(guardar).toBeDisabled();
  await ventana.locator('input[inputmode=decimal]').fill('1.300.000');
  await ventana.getByPlaceholder('Por ejemplo: lo había copiado mal').fill('lo había copiado mal');
  await guardar.click();
  await expect(c).toContainText('Arranca con $ 1.300.000,00');
});
