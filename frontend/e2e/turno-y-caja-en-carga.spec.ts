import { accion, cargarMovimiento, CELULAR, expect, formulario, ingresar, irACargar, irAReportes, reiniciarDatos, sinDesborde, test } from './ayuda';

// Emanuel carga en el momento, de cualquier turno: el turno se elige como Gasto o Ingreso, sin
// abrir nada, y la caja de hoy se ve mientras carga. Hoy es el miércoles 11/3 al mediodía (ver ayuda.ts).
// Local Norte arranca hoy con $ 995.000 en la caja (datos de ejemplo).
test.beforeEach(reiniciarDatos);

const turno = (page: import('@playwright/test').Page, nombre: 'Mañana' | 'Noche') =>
  formulario(page).getByRole('group', { name: 'Turno' }).getByRole('button', { name: nombre });

test('el turno tocado queda aunque no se haya guardado nada', async ({ page }) => {
  await ingresar(page, 'tomas');
  await expect(turno(page, 'Mañana'), 'al mediodía propone la mañana').toHaveAttribute('aria-pressed', 'true');

  await turno(page, 'Noche').click();
  await page.reload();
  await expect(turno(page, 'Noche'), 'sigue en Noche al volver').toHaveAttribute('aria-pressed', 'true');

  // Guardar no lo cambia: queda el último tocado.
  await cargarMovimiento(page, { tipo: 'Gasto', categoria: 'Proveedores', descripcion: 'Hielo', monto: '5.000' });
  await expect(turno(page, 'Noche')).toHaveAttribute('aria-pressed', 'true');
});

test('el turno recordado vence al día siguiente', async ({ page }) => {
  await ingresar(page, 'tomas');
  await turno(page, 'Noche').click();

  await page.clock.setFixedTime(new Date('2026-03-12T10:00:00-03:00'));
  await page.reload();
  await expect(turno(page, 'Mañana'), 'a la mañana siguiente no propone la noche de ayer').toHaveAttribute('aria-pressed', 'true');
});

test.describe('en el celular', () => {
  test.use(CELULAR);

  test('la caja de hoy está arriba de la carga y se mueve al guardar', async ({ page }) => {
    await ingresar(page, 'tomas');
    const burbuja = page.locator('.burbuja-caja');
    await expect(burbuja).toContainText('$ 995.000,00');
    // Arriba del formulario, a la vista sin bajar.
    const arriba = (await burbuja.boundingBox())!;
    expect(arriba.y + arriba.height).toBeLessThan((await formulario(page).boundingBox())!.y + 1);
    expect(arriba.y + arriba.height).toBeLessThan(844);

    await cargarMovimiento(page, { tipo: 'Gasto', categoria: 'Proveedores', descripcion: 'Hielo', monto: '5.000', medio: 'Efectivo' });
    await expect(burbuja, 'el gasto en efectivo baja la caja enseguida').toContainText('$ 990.000,00');

    // Sigue a la vista al bajar hasta el botón de guardar.
    await formulario(page).getByRole('button', { name: /Guardar movimiento/ }).scrollIntoViewIfNeeded();
    await expect(burbuja).toBeInViewport();
    await sinDesborde(page);
  });

  test('si se oculta en Cargar, queda oculta en Reportes', async ({ page }) => {
    await ingresar(page, 'tomas');
    await page.locator('.burbuja-caja').getByRole('button').click();
    await expect(page.locator('.burbuja-caja')).toContainText('$ •••••');

    await irAReportes(page);
    await expect(page.locator('.burbuja-caja')).toContainText('$ •••••');
    await irACargar(page);
    await expect(page.locator('.burbuja-caja')).toContainText('$ •••••');
  });

  test('una ventana abierta queda por encima de la burbuja', async ({ page }) => {
    await ingresar(page, 'tomas');
    for (const solapa of ['Cargar', 'Reportes']) {
      if (solapa === 'Reportes') await irAReportes(page);
      await accion(page, 'Verdura', 'Corregir');
      const ventana = page.getByRole('dialog');
      await expect(ventana).toBeVisible();
      // Lo que se ve en cada punto del borde de arriba de la ventana es la ventana, no la burbuja.
      const tapada = await ventana.evaluate((v) => {
        const r = v.getBoundingClientRect();
        return [0.1, 0.3, 0.5, 0.7, 0.9].some((x) => {
          const arriba = document.elementFromPoint(r.left + r.width * x, r.top + 12);
          return !arriba || !v.contains(arriba);
        });
      });
      expect(tapada, `en ${solapa}`).toBe(false);
      await page.keyboard.press('Escape');
      await expect(ventana).toBeHidden();
    }
  });
});
