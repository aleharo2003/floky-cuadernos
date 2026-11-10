import { cargarMovimiento, expect, formulario, ingresar, reiniciarDatos, test } from './ayuda';

// La caja arranca del haber inicial y cada movimiento en efectivo la actualiza, también los que
// cargan otras personas (ADR-0016). Local Norte: $ 500.000 de haber inicial; hoy termina en $ 995.000.
test.beforeEach(reiniciarDatos);

const reportes = async (page: import('@playwright/test').Page) => {
  await page.getByRole('tab', { name: 'Reportes' }).click();
  await expect(page.locator('.burbuja-caja')).toBeVisible();
};

test('lo cargado el mismo día que el haber inicial también mueve la caja', async ({ page }) => {
  // Lo que le pasó a Ema el 09/11: cargó el haber inicial, después su día, y la caja no se movía.
  await ingresar(page, 'lucia', { local: 'Local Centro' });
  await reportes(page);
  await page.locator('.tarjeta:has(h2:text("Caja en efectivo")) input[inputmode=decimal]').fill('1.000.000');
  await page.getByRole('button', { name: /Guardar haber inicial/ }).click();
  await expect(page.locator('.burbuja-caja')).toContainText('$ 1.000.000,00');

  await page.getByRole('tab', { name: 'Cargar' }).click();
  await cargarMovimiento(page, { tipo: 'Gasto', categoria: 'Proveedores', descripcion: 'Verdura', monto: '60.000', medio: 'Efectivo', turno: 'Mañana' });
  await cargarMovimiento(page, { tipo: 'Ingreso', categoria: 'Ventas', descripcion: 'Mostrador', monto: '200.000', medio: 'Efectivo', turno: 'Noche' });
  await cargarMovimiento(page, { tipo: 'Gasto', categoria: 'Proveedores', descripcion: 'Carne', monto: '80.000', medio: 'Transferencia', turno: 'Noche' });
  // Un gasto de ayer, cargado tarde: también cuenta.
  const f = formulario(page);
  await f.locator('input[type=date]').fill('2026-03-10');
  await cargarMovimiento(page, { tipo: 'Gasto', categoria: 'Proveedores', descripcion: 'Hielo', monto: '10.000', medio: 'Efectivo', turno: 'Noche' });

  await reportes(page);
  // 1.000.000 - 60.000 + 200.000 - 10.000; la transferencia no sale de la caja.
  await expect(page.locator('.burbuja-caja')).toContainText('$ 1.130.000,00');
});

test('si otra persona carga, la caja se actualiza sola, sin recargar', async ({ page, nuevaPagina }) => {
  await ingresar(page, 'lucia', { local: 'Local Norte' });
  await reportes(page);
  const burbuja = page.locator('.burbuja-caja');
  await expect(burbuja).toContainText('$ 995.000,00');

  const tomas = await nuevaPagina();
  await ingresar(tomas, 'tomas');
  await cargarMovimiento(tomas, { tipo: 'Gasto', categoria: 'Proveedores', descripcion: 'Hielo', monto: '5.000', medio: 'Efectivo' });

  // Se vuelve a pedir cada 15 segundos.
  await expect(burbuja).toContainText('$ 990.000,00', { timeout: 20_000 });
});
