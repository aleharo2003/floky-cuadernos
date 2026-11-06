import { expect, formulario, ingresar, primeraTabla, reiniciarDatos, test } from './ayuda';

// Al escribir la descripción aparecen las que ya se usaron en el local, del mismo tipo (HU-030).
test.beforeEach(reiniciarDatos);

test('sugiere descripciones ya usadas y se elige con el teclado', async ({ page }) => {
  await ingresar(page, 'tomas');
  const f = formulario(page);
  await f.getByRole('group', { name: 'Tipo' }).getByRole('button', { name: 'Gasto' }).click();
  const campo = f.getByRole('combobox', { name: 'Descripción' });

  await campo.fill('VER');
  const lista = f.getByRole('listbox', { name: 'Descripciones ya usadas' });
  await expect(lista.getByRole('option')).toHaveText(['Verdura']);

  await campo.press('ArrowDown');
  await expect(lista.getByRole('option', { name: 'Verdura' })).toHaveAttribute('aria-selected', 'true');
  await campo.press('Enter');
  await expect(campo).toHaveValue('Verdura');
  await expect(lista, 'elegir no guarda: la lista se cierra y el formulario sigue').toBeHidden();
  await expect(f.locator('.aviso-ok')).toBeEmpty();
  await expect(f.locator('.login-error'), 'tampoco intentó guardar sin monto').toBeEmpty();

  // Con la lista abierta y nada marcado, Enter guarda lo escrito, como siempre.
  await f.locator('select').first().selectOption({ label: 'Proveedores' });
  await f.locator('input[inputmode=decimal]').fill('12.000');
  await campo.fill('Verdu');
  await expect(lista).toBeVisible();
  await campo.press('Enter');
  await expect(f.locator('.aviso-ok')).toContainText('Guardado');
  await expect(primeraTabla(page).locator('td', { hasText: /^Verdu$/ })).toBeVisible();
});

test('busca el principio de cualquier palabra, sin tildes, y solo del mismo tipo', async ({ page }) => {
  await ingresar(page, 'tomas');
  const f = formulario(page);
  const campo = f.getByRole('combobox', { name: 'Descripción' });
  const opciones = f.getByRole('listbox').getByRole('option');

  await f.getByRole('group', { name: 'Tipo' }).getByRole('button', { name: 'Ingreso' }).click();
  await campo.fill('noche');
  await expect(opciones).toHaveText(['Ventas de la noche']);
  await campo.fill('verd');
  await expect(f.getByRole('listbox'), 'Verdura es un gasto').toBeHidden();

  // Con el mouse también.
  await f.getByRole('group', { name: 'Tipo' }).getByRole('button', { name: 'Gasto' }).click();
  await campo.fill('adelánto');
  await opciones.filter({ hasText: 'Adelanto' }).click();
  await expect(campo).toHaveValue('Adelanto');
});

test('en la corrección, Esc cierra la lista y no la ventana', async ({ page }) => {
  await ingresar(page, 'tomas');
  await primeraTabla(page).locator('tr', { hasText: 'Verdura' }).locator('.boton-mas').click();
  await page.getByRole('menuitem', { name: 'Corregir' }).click();
  const ventana = page.getByRole('dialog');
  const campo = ventana.getByRole('combobox', { name: 'Descripción' });
  await expect(ventana.getByRole('listbox'), 'al abrir no sugiere: el texto ya estaba').toBeHidden();

  await campo.fill('Lu');
  await expect(ventana.getByRole('listbox').getByRole('option')).toHaveText(['Luz']);
  await campo.press('Escape');
  await expect(ventana.getByRole('listbox')).toBeHidden();
  await expect(ventana).toBeVisible();
  await campo.press('Escape');
  await expect(ventana).toBeHidden();
});
