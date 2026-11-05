import { CELULAR, expect, formulario, ingresar, primeraTabla, reiniciarDatos, sinDesborde, test } from './ayuda';

// Categorías nuevas desde el formulario, cambio de contraseña y salir desde cualquier pantalla.
test.beforeEach(reiniciarDatos);

test('la dueña crea una categoría desde el desplegable y la usa en el momento', async ({ page, nuevaPagina }) => {
  await ingresar(page, 'lucia', { local: 'Local Norte' });
  const select = formulario(page).locator('select').first();
  await expect(select.locator('option', { hasText: 'Nueva categoría' })).toHaveCount(1);

  await select.selectOption({ label: '+ Nueva categoría…' });
  const ventana = page.getByRole('dialog');
  await expect(ventana).toContainText('Nueva categoría de gasto');
  await ventana.getByRole('textbox').fill('Carnicería');
  await ventana.getByRole('button', { name: /Agregar/ }).click();
  await expect(ventana).toBeHidden();
  await expect(select.locator('option:checked')).toHaveText('Carnicería');

  const f = formulario(page);
  await f.getByPlaceholder('Por ejemplo: verdura').fill('Asado del sábado');
  await f.locator('input[inputmode=decimal]').fill('85.000');
  await f.getByRole('button', { name: /Guardar movimiento/ }).click();
  await expect(primeraTabla(page).locator('tr', { hasText: 'Asado del sábado' })).toContainText('Carnicería');

  // Con otras mayúsculas también es la misma: avisa en lugar de duplicarla.
  await select.selectOption({ label: '+ Nueva categoría…' });
  await ventana.getByRole('textbox').fill('carnicería');
  await ventana.getByRole('button', { name: /Agregar/ }).click();
  await expect(ventana).toContainText('Ya existe');
  await page.keyboard.press('Escape');
  await expect(ventana).toBeHidden();
  await expect(select).not.toHaveValue('__nueva__');

  // Quien carga no la puede crear, pero sí usar.
  const tomas = await nuevaPagina();
  await ingresar(tomas, 'tomas');
  const suyo = formulario(tomas).locator('select').first();
  await expect(suyo.locator('option', { hasText: 'Nueva categoría' })).toHaveCount(0);
  await expect(suyo.locator('option', { hasText: 'Carnicería' })).toHaveCount(1);
});

test('cambiar la contraseña deja este dispositivo adentro y cierra los demás', async ({ nuevaPagina }) => {
  const otro = await nuevaPagina();
  await ingresar(otro, 'ana');
  const cel = await nuevaPagina(CELULAR);
  await ingresar(cel, 'ana');
  expect(await sinDesborde(cel), 'la barra entra en el celular').toBeLessThanOrEqual(0);

  await cel.locator('.barra-usuario-boton').click();
  await cel.getByRole('menuitem', { name: 'Cambiar contraseña' }).click();
  const ventana = cel.getByRole('dialog');
  const [actual, nueva, repetida] = [0, 1, 2].map((i) => ventana.locator('input[type=password]').nth(i));
  const cambiar = ventana.getByRole('button', { name: 'Cambiar contraseña' });

  await actual.fill('no-es-esta');
  await nueva.fill('nueva-clave-de-ana-2026');
  await repetida.fill('nueva-clave-de-ana-2026');
  await cambiar.click();
  await expect(ventana).toContainText('La contraseña actual no es correcta');

  await actual.fill('clave-de-prueba-123');
  await repetida.fill('otra-cosa');
  await cambiar.click();
  await expect(ventana).toContainText('no coinciden');

  await nueva.fill('12345678');
  await repetida.fill('12345678');
  await cambiar.click();
  await expect(ventana.locator('.login-error')).toContainText(/común|numérica/);

  await nueva.fill('nueva-clave-de-ana-2026');
  await repetida.fill('nueva-clave-de-ana-2026');
  await cambiar.click();
  await expect(cel.getByText('Contraseña cambiada')).toBeVisible();
  await cel.getByRole('button', { name: 'Listo' }).click();

  await cel.reload();
  await expect(cel.getByText('Movimientos del').first()).toBeVisible();
  await otro.reload();
  await otro.waitForURL('**/ingresar');
  await ingresar(otro, 'ana', { clave: 'nueva-clave-de-ana-2026' });
});

test('se puede salir desde cualquier pantalla, también sin locales', async ({ nuevaPagina }) => {
  // El superusuario no tiene locales: antes quedaba trabado en el aviso.
  const admin = await nuevaPagina(CELULAR);
  await admin.goto('/ingresar');
  await admin.locator('input[autocomplete=username]').fill('admin');
  await admin.locator('input[type=password]').fill('clave-de-prueba-123');
  await admin.locator('button[type=submit]').click();
  await expect(admin.getByText('no tiene acceso a ningún local')).toBeVisible();
  await admin.getByRole('button', { name: 'Salir' }).click();
  await admin.waitForURL('**/ingresar');

  // Con dos locales, desde "¿En qué local trabajás?".
  const lucia = await nuevaPagina(CELULAR);
  await lucia.goto('/ingresar');
  await lucia.locator('input[autocomplete=username]').fill('lucia');
  await lucia.locator('input[type=password]').fill('clave-de-prueba-123');
  await lucia.locator('button[type=submit]').click();
  await expect(lucia.getByText('¿En qué local trabajás?')).toBeVisible();
  await lucia.getByRole('button', { name: 'Salir' }).click();
  await lucia.waitForURL('**/ingresar');

  // Adentro, desde el menú del nombre. Y la sesión queda cerrada de verdad.
  const tomas = await nuevaPagina();
  await ingresar(tomas, 'tomas');
  await tomas.locator('.barra-usuario-boton').click();
  await tomas.getByRole('menuitem', { name: 'Salir' }).click();
  await tomas.waitForURL('**/ingresar');
  await tomas.goto('/cuadernos');
  await tomas.waitForURL('**/ingresar');
});

test('si la sesión se cierra en otro lado, al guardar lleva al ingreso y explica por qué', async ({ page, nuevaPagina }) => {
  await ingresar(page, 'tomas');
  // Desde otro dispositivo cambia la contraseña: esta sesión deja de valer.
  const otro = await nuevaPagina();
  await ingresar(otro, 'tomas');
  await otro.locator('.barra-usuario-boton').click();
  await otro.getByRole('menuitem', { name: 'Cambiar contraseña' }).click();
  const ventana = otro.getByRole('dialog');
  await ventana.locator('input[type=password]').nth(0).fill('clave-de-prueba-123');
  await ventana.locator('input[type=password]').nth(1).fill('otra-clave-de-tomas-2026');
  await ventana.locator('input[type=password]').nth(2).fill('otra-clave-de-tomas-2026');
  await ventana.getByRole('button', { name: 'Cambiar contraseña' }).click();
  await expect(otro.getByText('Contraseña cambiada')).toBeVisible();

  const f = formulario(page);
  await f.locator('select').first().selectOption({ label: 'Proveedores' });
  await f.locator('input[inputmode=decimal]').fill('1.000');
  await f.getByRole('button', { name: /Guardar movimiento/ }).click();

  await page.waitForURL('**/ingresar');
  await expect(page.getByRole('status')).toContainText('Tu sesión se cerró');
  await ingresar(page, 'tomas', { clave: 'otra-clave-de-tomas-2026' });
  await expect(page.locator('.aviso-sesion')).toHaveCount(0);
});
