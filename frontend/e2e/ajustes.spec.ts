import { cargarMovimiento, expect, formulario, ingresar, primeraTabla, reiniciarDatos, test } from './ayuda';

// Todo gasto que no sea en efectivo puede sumar su venta. Débito y transferencia vienen marcados; el
// dueño elige cuáles en los ajustes (ADR-0013, ADR-0014).
test.beforeEach(reiniciarDatos);

test('un gasto por transferencia suma su venta por transferencia', async ({ page }) => {
  await ingresar(page, 'tomas');
  await cargarMovimiento(page, { tipo: 'Gasto', categoria: 'Proveedores', descripcion: 'Carnicería', monto: '64.000', medio: 'Transferencia' });

  await expect(formulario(page).locator('.aviso-ok')).toHaveText('Guardado: gasto de Proveedores, $ 64.000,00, y su venta por transferencia.');
  const venta = primeraTabla(page).locator('tr', { hasText: 'Gasto por transferencia: Proveedores (Carnicería)' });
  await expect(venta).toContainText('Ingreso');
  await expect(venta).toContainText('Transferencia');
  await venta.locator('.boton-mas').click();
  await expect(page.getByRole('menu')).toContainText('Sale de un gasto por transferencia');
});

test('el dueño elige qué medios vienen marcados, y el formulario lo sigue en el momento', async ({ page }) => {
  await ingresar(page, 'lucia', { local: 'Local Norte' });
  const f = formulario(page);
  await f.getByRole('group', { name: 'Tipo' }).getByRole('button', { name: 'Gasto' }).click();
  const tilde = f.getByRole('checkbox', { name: /Sumarlo también a la venta/ });
  const medio = f.locator('select').nth(1);

  await medio.selectOption({ label: 'Transferencia' });
  await expect(tilde).toBeChecked();
  await expect(f).toContainText('Sumarlo también a la venta, por transferencia');
  await medio.selectOption({ label: 'Crédito' });
  await expect(tilde, 'crédito también puede sumar venta, pero sin marcar').not.toBeChecked();
  await medio.selectOption({ label: 'Efectivo' });
  await expect(tilde, 'efectivo nunca').toHaveCount(0);
  await medio.selectOption({ label: 'Crédito' });

  await page.getByRole('button', { name: /opciones de tu cuenta/ }).click();
  await page.getByRole('menuitem', { name: 'Ajustes del local' }).click();
  const ventana = page.getByRole('dialog');
  await expect(ventana).toContainText('Ajustes de Local Norte');
  await expect(ventana.getByRole('checkbox', { name: 'Débito' })).toBeChecked();
  await expect(ventana.getByRole('checkbox', { name: 'Transferencia' })).toBeChecked();
  await expect(ventana.getByRole('checkbox', { name: 'Efectivo' }), 'efectivo nunca suma venta').toHaveCount(0);
  await ventana.getByRole('checkbox', { name: 'Transferencia' }).uncheck();
  await ventana.getByRole('checkbox', { name: 'Crédito' }).check();
  await ventana.getByRole('button', { name: /Guardar/ }).click();
  await expect(ventana).toBeHidden();

  // Sin recargar la página: el formulario sigue los ajustes cuando se elige el medio.
  await medio.selectOption({ label: 'Débito' });
  await medio.selectOption({ label: 'Crédito' });
  await expect(tilde).toBeChecked();
  await expect(f).toContainText('Sumarlo también a la venta, con crédito');
  await medio.selectOption({ label: 'Transferencia' });
  await expect(tilde).not.toBeChecked();

  // Quedó guardado.
  await page.reload();
  await page.getByRole('button', { name: /opciones de tu cuenta/ }).click();
  await page.getByRole('menuitem', { name: 'Ajustes del local' }).click();
  await expect(ventana.getByRole('checkbox', { name: 'Transferencia' })).not.toBeChecked();
  await expect(ventana.getByRole('checkbox', { name: 'Crédito' })).toBeChecked();
});

test('quien carga no ve los ajustes del local', async ({ page }) => {
  await ingresar(page, 'tomas');
  await page.getByRole('button', { name: /opciones de tu cuenta/ }).click();
  await expect(page.getByRole('menuitem')).not.toContainText(['Ajustes del local']);
  await expect(page.getByRole('menuitem', { name: 'Cambiar contraseña' })).toBeVisible();
});

test('un gasto con crédito tildado a mano suma su venta con crédito', async ({ page }) => {
  await ingresar(page, 'tomas');
  const f = formulario(page);
  await f.getByRole('group', { name: 'Tipo' }).getByRole('button', { name: 'Gasto' }).click();
  await f.locator('select').first().selectOption({ label: 'Proveedores' });
  await f.getByPlaceholder('Por ejemplo: verdura').fill('Bebidas');
  await f.locator('input[inputmode=decimal]').fill('30.000');
  await f.locator('select').nth(1).selectOption({ label: 'Crédito' });
  await f.getByRole('checkbox', { name: /Sumarlo también a la venta/ }).check();
  await f.getByRole('button', { name: /Guardar movimiento/ }).click();

  await expect(f.locator('.aviso-ok')).toHaveText('Guardado: gasto de Proveedores, $ 30.000,00, y su venta con crédito.');
  await expect(f.getByRole('checkbox', { name: /Sumarlo también a la venta/ }), 'el próximo renglón vuelve a venir sin marcar').not.toBeChecked();
});
