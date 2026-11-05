import { accion, cargarMovimiento, CELULAR, expect, formulario, ingresar, irAReportes, primeraTabla, reiniciarDatos, sinDesborde, test } from './ayuda';

// La solapa Cargar: lo de todos los días. Hoy es el miércoles 11/3 (ver ayuda.ts).
test.beforeEach(reiniciarDatos);

test('se entra en Cargar, con lo cargado hoy al lado', async ({ page }) => {
  await ingresar(page, 'tomas');
  await expect(page.getByRole('tab', { name: 'Cargar' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.carga-contexto')).toContainText('Miércoles 11/3, turno mañana');
  await expect(page.getByRole('heading', { name: 'Cargados el miércoles 11/3' })).toBeVisible();
  await expect(primeraTabla(page).locator('tbody tr')).toHaveCount(2);
  await expect(page.locator('.carga-dia .nota')).toContainText('Ingresos $ 320.000,00, gastos $ 45.000,00');
  // El formulario arranca arriba, no abajo de los reportes.
  expect((await formulario(page).boundingBox())!.y).toBeLessThan(250);
});

test('doble clic en guardar guarda uno solo', async ({ page }) => {
  await ingresar(page, 'tomas');
  const f = formulario(page);
  await f.locator('select').first().selectOption({ label: 'Proveedores' });
  await f.getByPlaceholder('Por ejemplo: verdura').fill('Hielo');
  await f.locator('input[inputmode=decimal]').fill('4000');
  await f.getByRole('button', { name: /Guardar movimiento/ }).dblclick();
  await expect(f.locator('.aviso-ok')).toContainText('Guardado');
  await page.waitForTimeout(500);
  await expect(primeraTabla(page).locator('td', { hasText: 'Hielo' })).toHaveCount(1);
});

test('carga en serie: quedan fecha, turno, tipo y medio; el cursor vuelve a Categoría', async ({ page }) => {
  await ingresar(page, 'tomas');
  const f = formulario(page);
  await f.getByRole('group', { name: 'Tipo' }).getByRole('button', { name: 'Ingreso' }).click();
  await f.locator('select').first().selectOption({ label: 'Ventas' });
  await f.getByPlaceholder('Por ejemplo: verdura').fill('Ventas de la tarde');
  await f.locator('input[inputmode=decimal]').fill('150.000');
  await f.locator('select').nth(1).selectOption({ label: 'Débito' });
  await page.keyboard.press('Enter');

  await expect(f.locator('.aviso-ok')).toHaveText('Guardado: ingreso de Ventas, $ 150.000,00.');
  await expect(f.getByRole('group', { name: 'Tipo' }).getByRole('button', { name: 'Ingreso' })).toHaveAttribute('aria-pressed', 'true');
  await expect(f.locator('select').nth(1)).toHaveValue('debit');
  await expect(f.locator('select').first()).toHaveValue('');
  await expect(f.locator('input[inputmode=decimal]')).toHaveValue('');
  await expect(f.locator('select').first()).toBeFocused();
  await expect(page.locator('table tr.fila-seleccionada')).toContainText('Ventas de la tarde');
  await expect(page.locator('.carga-dia .nota')).toContainText('Ingresos $ 470.000,00');
});

test('para pasar un día atrasado, la fecha queda y avisa que no es hoy', async ({ page }) => {
  await ingresar(page, 'tomas');
  const f = formulario(page);
  await f.getByRole('button', { name: 'Cambiar fecha o turno' }).click();
  await f.locator('input[type=date]').fill('2026-03-10');
  await f.getByRole('button', { name: /Listo/ }).click();
  await expect(f.locator('.badge', { hasText: 'No es hoy' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cargados el martes 10/3' })).toBeVisible();
  await expect(primeraTabla(page).locator('tbody tr')).toHaveCount(2);

  await cargarMovimiento(page, { tipo: 'Gasto', categoria: 'Varios', descripcion: 'Bolsas', monto: '3.500' });
  await expect(f.locator('.badge', { hasText: 'No es hoy' })).toBeVisible();
  await expect(primeraTabla(page).locator('tbody tr')).toHaveCount(3);
});

test('corregir pide motivo, anular pide motivo y el historial lo cuenta', async ({ page }) => {
  await ingresar(page, 'tomas');
  await cargarMovimiento(page, { tipo: 'Gasto', categoria: 'Proveedores', descripcion: 'Hielo para anular', monto: '4000' });

  await accion(page, 'Verdura', 'Corregir');
  const ventana = page.getByRole('dialog');
  await expect(ventana).toContainText('Corregir movimiento');
  await expect(ventana.locator('input[type=date]'), 'al corregir, fecha y turno están a la vista').toBeVisible();
  await ventana.locator('input[inputmode=decimal]').fill('50000');
  await ventana.getByRole('button', { name: /Guardar corrección/ }).click();
  await expect(ventana, 'sin motivo no se guarda').toBeVisible();
  await ventana.getByPlaceholder('Por ejemplo: el monto era otro').fill('era 50000');
  await ventana.getByRole('button', { name: /Guardar corrección/ }).click();
  await expect(ventana).toBeHidden();
  await expect(primeraTabla(page).locator('tr', { hasText: 'Verdura' })).toContainText('50.000');

  await accion(page, 'Hielo para anular', 'Anular');
  const anular = ventana.getByRole('button', { name: /Sí, anular/ });
  await expect(anular).toBeDisabled();
  await ventana.getByPlaceholder('Por ejemplo: cargado dos veces').fill('cargado de más');
  await anular.click();
  await expect(primeraTabla(page).locator('td', { hasText: 'Hielo para anular' })).toHaveCount(0);

  await accion(page, 'Verdura', 'Historial');
  await expect(ventana.locator('tbody tr')).toHaveCount(2);
  await expect(ventana.locator('tbody')).toContainText('Alta');
  await expect(ventana.locator('tbody')).toContainText('era 50000');
  await page.keyboard.press('Escape');

  await irAReportes(page);
  await expect(page.locator('.tarjeta', { hasText: 'Últimos cambios' })).toContainText('cargado de más');
});

test('cancelar una corrección no borra lo que se estaba cargando', async ({ nuevaPagina }) => {
  const p = await nuevaPagina(CELULAR);
  await ingresar(p, 'tomas');
  const boton = (await p.getByRole('button', { name: /Guardar movimiento/ }).boundingBox())!;
  expect(boton.y + boton.height, 'en el celular, "Guardar movimiento" se ve sin bajar').toBeLessThanOrEqual(844);

  await formulario(p).getByPlaceholder('Por ejemplo: verdura').fill('a medio cargar');
  await accion(p, 'Ventas de la noche', 'Corregir');
  await expect(p.getByRole('dialog')).toContainText('Corregir movimiento');
  await p.keyboard.press('Escape');
  await expect(formulario(p).getByPlaceholder('Por ejemplo: verdura')).toHaveValue('a medio cargar');
  expect(await sinDesborde(p)).toBeLessThanOrEqual(0);
});

test('quien solo consulta no ve solapas ni formulario, y el ⋯ solo ofrece Historial', async ({ nuevaPagina }) => {
  const p = await nuevaPagina(CELULAR);
  await ingresar(p, 'lucia', { local: 'Local Norte' });
  // Lucía es dueña; Ana es consulta en Centro, que no tiene movimientos. Para ver el ⋯ de consulta
  // hace falta un movimiento en Centro: lo carga la dueña.
  await p.locator('.barra-local').selectOption({ label: 'Local Centro' });
  await expect(p.getByText('Todavía no hay nada cargado en esta fecha')).toBeVisible();
  await cargarMovimiento(p, { tipo: 'Gasto', categoria: 'Varios', descripcion: 'Escoba', monto: '9.000' });

  const ana = await nuevaPagina(CELULAR);
  await ingresar(ana, 'ana');
  await expect(ana.getByRole('tablist')).toHaveCount(0);
  await expect(ana.locator('form.formulario')).toHaveCount(0);
  await primeraTabla(ana).locator('tr', { hasText: 'Escoba' }).locator('.boton-mas').click();
  await expect(ana.getByRole('menuitem')).toHaveText(['Historial']);
  await ana.keyboard.press('Escape');
  await expect(ana.locator('body')).not.toContainText('Verdura');
  expect(await sinDesborde(ana)).toBeLessThanOrEqual(0);
});

test('un gasto con débito suma también su venta; se corrige y se anula junto con el gasto', async ({ page }) => {
  await ingresar(page, 'lucia', { local: 'Local Norte' });
  const f = formulario(page);
  await f.getByRole('group', { name: 'Tipo' }).getByRole('button', { name: 'Gasto' }).click();
  const tilde = f.getByRole('checkbox', { name: /Sumarlo también a la venta/ });
  await expect(tilde, 'con efectivo no aparece').toHaveCount(0);
  await f.locator('select').nth(1).selectOption({ label: 'Débito' });
  await expect(tilde).toBeChecked();

  await f.locator('select').first().selectOption({ label: 'Proveedores' });
  await f.getByPlaceholder('Por ejemplo: verdura').fill('don José');
  await f.locator('input[inputmode=decimal]').fill('100.000');
  await f.getByRole('button', { name: /Guardar movimiento/ }).click();
  await expect(f.locator('.aviso-ok')).toHaveText('Guardado: gasto de Proveedores, $ 100.000,00, y su venta con débito.');
  await expect(tilde, 'para el próximo renglón sigue marcado').toBeChecked();

  const venta = primeraTabla(page).locator('tr', { hasText: 'Gasto con débito: Proveedores (don José)' });
  await expect(venta).toContainText('Ingreso');
  await expect(venta).toContainText('Débito');
  await expect(venta).toContainText('$ 100.000,00');
  await expect(page.locator('.carga-dia .nota')).toContainText('Ingresos $ 420.000,00, gastos $ 145.000,00');

  // La venta no se toca sola: solo Historial.
  await venta.locator('.boton-mas').click();
  await expect(page.getByRole('menu')).toContainText('Sale de un gasto con débito');
  await expect(page.getByRole('menuitem')).toHaveText(['Historial']);
  await page.keyboard.press('Escape');

  // Corregir el gasto arrastra la venta.
  const gasto = primeraTabla(page).locator('tr', { hasText: 'don José' }).filter({ hasNotText: 'Gasto con débito' });
  await gasto.locator('.boton-mas').click();
  await page.getByRole('menuitem', { name: 'Corregir' }).click();
  const ventana = page.getByRole('dialog');
  await expect(ventana).toContainText('se corrige sola');
  await ventana.locator('input[inputmode=decimal]').fill('120.000');
  await ventana.getByPlaceholder('Por ejemplo: el monto era otro').fill('el ticket decía 120.000');
  await ventana.getByRole('button', { name: /Guardar corrección/ }).click();
  await expect(ventana).toBeHidden();
  await expect(venta).toContainText('$ 120.000,00');

  // Anular el gasto se lleva la venta.
  await gasto.locator('.boton-mas').click();
  await page.getByRole('menuitem', { name: 'Anular' }).click();
  await expect(ventana).toContainText('También se anula su venta con débito');
  await ventana.getByPlaceholder('Por ejemplo: cargado dos veces').fill('era otro local');
  await ventana.getByRole('button', { name: /Sí, anular/ }).click();
  await expect(primeraTabla(page).locator('tr', { hasText: 'don José' })).toHaveCount(0);

  // Destildado, es solo el gasto.
  await f.locator('select').first().selectOption({ label: 'Proveedores' });
  await f.locator('input[inputmode=decimal]').fill('5.000');
  await tilde.uncheck();
  await f.getByRole('button', { name: /Guardar movimiento/ }).click();
  await expect(f.locator('.aviso-ok')).toHaveText('Guardado: gasto de Proveedores, $ 5.000,00.');
});

test('un monto con más de 2 decimales avisa en lugar de redondear', async ({ page }) => {
  await ingresar(page, 'tomas');
  const f = formulario(page);
  await f.locator('select').first().selectOption({ label: 'Proveedores' });
  await f.locator('input[inputmode=decimal]').fill('10,999');
  await f.getByRole('button', { name: /Guardar movimiento/ }).click();
  await expect(f.getByRole('alert')).toHaveText('El monto puede tener hasta 2 decimales.');
  await expect(primeraTabla(page).locator('tbody tr')).toHaveCount(2);
});
