import AxeBuilder from '@axe-core/playwright';
import { CELULAR, expect, ingresar, irACargar, irAReportes, reiniciarDatos, test } from './ayuda';
import type { Page } from '@playwright/test';

// Cómo se ve: celular y compu, menú de la cuenta con teclado, tema oscuro y contraste.
test.beforeAll(reiniciarDatos);

async function contraste(p: Page) {
  const r = await new AxeBuilder({ page: p }).withRules(['color-contrast']).analyze();
  return r.violations.flatMap((v) => v.nodes.map((n) => `${n.target.join(' ')}: ${n.failureSummary ?? ''}`));
}

const tema = (p: Page) => p.evaluate(() => document.documentElement.dataset.tema);

test('celular: solapas a lo ancho y selector de local legible', async ({ nuevaPagina }) => {
  const p = await nuevaPagina(CELULAR);
  await ingresar(p, 'lucia', { local: 'Local Norte' });
  const anchos = await p.getByRole('tab').evaluateAll((s) => s.map((e) => Math.round(e.getBoundingClientRect().width)));
  expect(anchos).toHaveLength(2);
  expect(Math.abs(anchos[0] - anchos[1])).toBeLessThanOrEqual(1);

  const colores = await p.locator('.barra-local').evaluate((e) => [getComputedStyle(e).color, getComputedStyle(e).backgroundColor]);
  expect(colores[0]).not.toBe(colores[1]);
  await p.locator('.barra-local').selectOption({ label: 'Local Centro' });
  await expect(p.getByText('Todavía no hay nada cargado en esta fecha')).toBeVisible();
});

test('compu: los cuatro totales en una fila y la letra de los campos sin agrandar', async ({ page }) => {
  await ingresar(page, 'tomas');
  await irAReportes(page);
  const alturas = await page.locator('.indicadores-compactos .kpi').evaluateAll((ks) => ks.map((k) => Math.round(k.getBoundingClientRect().top)));
  expect(alturas).toHaveLength(4);
  expect(new Set(alturas).size).toBe(1);
  await expect(page.locator('.filtros-panel input[type=search]')).toHaveCSS('font-size', '15px');
});

test('menú de la cuenta con teclado; el tema oscuro queda elegido y en papel sale claro', async ({ page }) => {
  await ingresar(page, 'tomas');
  await page.locator('.barra-usuario-boton').focus();
  await page.keyboard.press('Enter');
  const menu = page.getByRole('menu');
  await expect(menu.getByRole('menuitem').or(menu.getByRole('menuitemradio'))).toHaveText([
    'Cambiar contraseña',
    'Claro',
    'Oscuro',
    /Como el dispositivo/,
    'Salir',
  ]);
  await expect(menu.getByRole('menuitem', { name: 'Cambiar contraseña' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('menuitemradio', { name: 'Oscuro' })).toBeFocused();
  await page.keyboard.press('Enter');
  expect(await tema(page)).toBe('oscuro');

  await page.reload();
  await expect(page.getByText('Cargados el').first()).toBeVisible();
  expect(await tema(page)).toBe('oscuro');

  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await page.emulateMedia({ media: 'screen' });
});

test('sin elegir nada, un dispositivo en modo oscuro abre en oscuro', async ({ nuevaPagina }) => {
  const p = await nuevaPagina({ colorScheme: 'dark' });
  await ingresar(p, 'tomas');
  expect(await tema(p)).toBe('oscuro');
});

for (const [modo, pantalla] of [
  ['light', 'compu'],
  ['dark', 'compu'],
  ['light', 'celular'],
  ['dark', 'celular'],
] as const) {
  test(`contraste de texto suficiente en tema ${modo === 'light' ? 'claro' : 'oscuro'}, en ${pantalla}`, async ({ nuevaPagina }) => {
    const p = await nuevaPagina({ colorScheme: modo, ...(pantalla === 'celular' ? CELULAR : {}) });
    await ingresar(p, 'tomas');
    expect(await contraste(p), 'Cargar').toEqual([]);
    await irAReportes(p);
    expect(await contraste(p), 'Reportes').toEqual([]);
    await irACargar(p);
  });
}

// Las ventanas que abre la barra de arriba heredaban su letra blanca: el título no se veía.
// axe no lo marca (la ventana está sobre un fondo oscurecido), así que se mide el contraste a mano.
async function contrasteDeLaVentana(p: Page) {
  return p.evaluate(() => {
    const ventana = document.querySelector('[role=dialog]') as HTMLElement;
    const luz = (color: string) => {
      const [r, g, b] = color.match(/\d+(\.\d+)?/g)!.slice(0, 3).map((x) => Number(x) / 255);
      const canal = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
    };
    const fondo = luz(getComputedStyle(ventana).backgroundColor);
    const textos = Array.from(ventana.querySelectorAll('h2, legend, label, p')).filter((e) => e.textContent?.trim());
    return Math.min(
      ...textos.map((e) => {
        const [a, b] = [luz(getComputedStyle(e).color), fondo].sort((x, y) => y - x);
        return (a + 0.05) / (b + 0.05);
      }),
    );
  });
}

for (const modo of ['light', 'dark'] as const) {
  test(`las ventanas del menú de la cuenta se leen, en tema ${modo === 'light' ? 'claro' : 'oscuro'}`, async ({ nuevaPagina }) => {
    const p = await nuevaPagina({ colorScheme: modo });
    await ingresar(p, 'lucia', { local: 'Local Norte' });
    for (const item of ['Cambiar contraseña', 'Ajustes del local']) {
      await p.getByRole('button', { name: /opciones de tu cuenta/ }).click();
      await p.getByRole('menuitem', { name: item }).click();
      await expect(p.getByRole('dialog').locator('input').first()).toBeVisible();
      expect(await contrasteDeLaVentana(p), item).toBeGreaterThanOrEqual(4.5);
      await p.keyboard.press('Escape');
      await expect(p.getByRole('dialog')).toHaveCount(0);
    }
  });
}
