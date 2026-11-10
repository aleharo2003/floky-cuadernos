import { cargarMovimiento, expect, formulario, ingresar, reiniciarDatos, test } from './ayuda';

// En Cargar se ve cuánto efectivo debería haber al cerrar el turno que se carga (ADR-0008).
// Datos de ejemplo de Local Norte: haber inicial $ 500.000 y, el 11/3, gasto de $ 45.000 a la mañana
// y ventas de $ 320.000 a la noche, todo en efectivo.
test.beforeEach(reiniciarDatos);

const elegirTurno = async (page: import('@playwright/test').Page, turno: 'Mañana' | 'Noche') => {
  const f = formulario(page);
  await f.getByRole('group', { name: 'Turno' }).getByRole('button', { name: turno }).click();
};

test('la caja del turno se ve al cargar y se actualiza al guardar', async ({ page }) => {
  await ingresar(page, 'tomas');
  const caja = page.locator('.caja-turno');

  await elegirTurno(page, 'Noche');
  await expect(caja).toContainText('Caja al cerrar la noche');
  await expect(caja).toContainText('$ 995.000,00');

  await cargarMovimiento(page, { tipo: 'Gasto', categoria: 'Proveedores', descripcion: 'Hielo', monto: '5.000', medio: 'Efectivo', turno: 'Noche' });
  await expect(caja, 'un gasto en efectivo baja la caja').toContainText('$ 990.000,00');

  await cargarMovimiento(page, { tipo: 'Gasto', categoria: 'Proveedores', descripcion: 'Carne', monto: '80.000', medio: 'Transferencia', turno: 'Noche' });
  await expect(caja, 'por transferencia no la mueve').toContainText('$ 990.000,00');

  await elegirTurno(page, 'Mañana');
  await expect(caja).toContainText('Caja al cerrar la mañana');
  await expect(caja).toContainText('$ 675.000,00');
});

test('si queda en negativo, avisa', async ({ page }) => {
  await ingresar(page, 'tomas');
  await cargarMovimiento(page, { tipo: 'Gasto', categoria: 'Proveedores', descripcion: 'Error', monto: '2.000.000', medio: 'Efectivo', turno: 'Noche' });

  const caja = page.locator('.caja-turno');
  await expect(caja).toContainText('-$ 1.005.000,00');
  await expect(caja).toContainText('No puede quedar en negativo');
});
