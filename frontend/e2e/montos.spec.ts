import { expect, formulario, ingresar, primeraTabla, reiniciarDatos, test } from './ayuda';

// Los montos se escriben y se ven como en Argentina: punto para los miles, coma para los decimales.
test.beforeEach(reiniciarDatos);

test('los puntos de miles se ponen solos y el punto del teclado escribe la coma', async ({ page }) => {
  await ingresar(page, 'tomas');
  const f = formulario(page);
  const monto = f.locator('input[inputmode=decimal]');

  await monto.click();
  await monto.pressSequentially('1234567');
  await expect(monto).toHaveValue('1.234.567');
  await monto.press('.');
  await monto.pressSequentially('5');
  await expect(monto).toHaveValue('1.234.567,5');
  await monto.press('.');
  await expect(monto, 'una sola coma').toHaveValue('1.234.567,5');

  // Corregir en el medio no tira el cursor al final: se borra el 4 y se escribe un 9 en su lugar.
  await monto.press('Home');
  for (let i = 0; i < 5; i++) await monto.press('ArrowRight'); // "1.234|"
  await monto.press('Backspace');
  await monto.pressSequentially('9');
  await expect(monto).toHaveValue('1.239.567,5');

  await f.getByRole('group', { name: 'Tipo' }).getByRole('button', { name: 'Ingreso' }).click();
  await f.locator('select').first().selectOption({ label: 'Ventas' });
  await f.getByRole('button', { name: /Guardar movimiento/ }).click();
  await expect(f.locator('.aviso-ok')).toContainText('$ 1.239.567,50');
  await expect(primeraTabla(page).locator('td', { hasText: '$ 1.239.567,50' })).toBeVisible();
});

test('un monto pegado de otro lado se acomoda al formato', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await ingresar(page, 'tomas');
  const monto = formulario(page).locator('input[inputmode=decimal]');

  await page.evaluate(() => navigator.clipboard.writeText('12345.67'));
  await monto.click();
  await monto.press('ControlOrMeta+v');
  await expect(monto).toHaveValue('12.345,67');
});
