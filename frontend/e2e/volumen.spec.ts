import { cargarVolumen, expect, ingresar, irAReportes, primeraTabla, reiniciarDatos, test } from './ayuda';

// Muchos datos (revisión del 05/11/2026): la lista de Reportes y la caja vienen de a partes.
test.beforeEach(() => {
  reiniciarDatos();
  cargarVolumen(70, 6); // del 1/1 al 11/3: 420 movimientos y 140 turnos
});

test('Reportes trae la lista de a partes y la caja muestra los últimos turnos', async ({ page }) => {
  await ingresar(page, 'lucia', { local: 'Local Volumen' });
  await irAReportes(page);
  await page.locator('.filtro-fechas input').nth(0).fill('2026-01-01');

  const lista = page.locator('.tarjeta', { has: page.getByRole('heading', { name: /^Movimientos del/ }) });
  await expect(lista).toContainText('Se muestran 200 de 420. Los totales y el Excel incluyen todos.');
  await expect(primeraTabla(page).locator('tbody tr')).toHaveCount(200);
  await lista.getByRole('button', { name: 'Ver 200 más' }).click();
  await expect(primeraTabla(page).locator('tbody tr')).toHaveCount(400);
  await lista.getByRole('button', { name: 'Ver 20 más' }).click();
  await expect(primeraTabla(page).locator('tbody tr')).toHaveCount(420);
  await expect(lista.getByRole('button', { name: /más$/ })).toHaveCount(0);

  // Otro filtro vuelve a la primera parte.
  await page.locator('.filtros-panel select').nth(0).selectOption('ingreso');
  await expect(lista).not.toContainText('Se muestran');
  await expect(primeraTabla(page).locator('tbody tr')).toHaveCount(140);

  const caja = page.locator('.tarjeta', { has: page.getByRole('heading', { name: /Caja en efectivo/ }) });
  await expect(caja.locator('tbody tr')).toHaveCount(62);
  await caja.getByRole('button', { name: 'Ver 62 turnos más (quedan 78)' }).click();
  await expect(caja.locator('tbody tr')).toHaveCount(124);
});
