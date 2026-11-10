import { execSync } from 'node:child_process';
import { test as base, expect, type Browser, type BrowserContextOptions, type Locator, type Page } from '@playwright/test';

/**
 * "Hoy" para todas las pruebas: el seed se carga con esta fecha y el reloj del navegador queda fijo
 * en ese mediodía. Así los números no dependen del día del mes en que corra el CI, y el turno
 * sugerido es siempre "mañana".
 */
export const HOY = '2026-03-11';
const MEDIODIA = new Date(`${HOY}T12:00:00-03:00`);
export const CLAVE = 'clave-de-prueba-123';
export const CELULAR = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } satisfies BrowserContextOptions;

/** Base vacía y seed de demo de cero. Cada archivo de pruebas lo llama una vez al empezar. */
export function reiniciarDatos() {
  const python = process.env.E2E_PYTHON ?? 'python';
  execSync(`${python} manage.py flush --no-input && ${python} manage.py seed_demo --today ${HOY}`, {
    cwd: new URL('../../backend', import.meta.url).pathname,
    stdio: 'pipe',
  });
}

/** Un local "Local Volumen" con muchos movimientos inventados, de la dueña Lucía (seed_volume). */
export function cargarVolumen(dias: number, porDia: number) {
  const python = process.env.E2E_PYTHON ?? 'python';
  execSync(`${python} manage.py seed_volume --days ${dias} --per-day ${porDia} --today ${HOY}`, {
    cwd: new URL('../../backend', import.meta.url).pathname,
    stdio: 'pipe',
    env: { ...process.env, DJANGO_DEBUG: '1' },
  });
}

/** Errores de JavaScript de todas las páginas de una prueba: al final tiene que estar vacío. */
export const test = base.extend<{ errores: string[]; nuevaPagina: (opciones?: BrowserContextOptions) => Promise<Page> }>({
  // Playwright lee de este argumento qué fixtures usa: vacío quiere decir ninguno.
  // eslint-disable-next-line no-empty-pattern
  errores: async ({}, use) => {
    const errores: string[] = [];
    await use(errores);
    expect(errores, 'sin errores de JavaScript').toEqual([]);
  },
  page: async ({ page, errores }, use) => {
    await page.clock.setFixedTime(MEDIODIA);
    page.on('pageerror', (e) => errores.push(e.message));
    await use(page);
  },
  /** Otra persona, otro navegador (otra sesión), con el mismo reloj fijo. */
  nuevaPagina: async ({ browser, errores }, use) => {
    const abiertas: Awaited<ReturnType<Browser['newContext']>>[] = [];
    await use(async (opciones = {}) => {
      const ctx = await browser.newContext({ locale: 'es-AR', timezoneId: 'America/Argentina/Buenos_Aires', viewport: { width: 1366, height: 900 }, ...opciones });
      abiertas.push(ctx);
      const p = await ctx.newPage();
      await p.clock.setFixedTime(MEDIODIA);
      p.on('pageerror', (e) => errores.push(e.message));
      return p;
    });
    for (const c of abiertas) await c.close();
  },
});
export { expect };

export async function ingresar(p: Page, usuario: string, { clave = CLAVE, local }: { clave?: string; local?: string } = {}) {
  await p.goto('/ingresar');
  await p.locator('input[autocomplete=username]').fill(usuario);
  await p.locator('input[type=password]').fill(clave);
  await p.locator('button[type=submit]').click();
  if (local) {
    await p.waitForURL('**/elegir-local');
    await p.getByRole('button', { name: local }).click();
  }
  await expect(p.getByText(/Cargados el|Movimientos del/).first()).toBeVisible();
}

export async function irAReportes(p: Page) {
  await p.getByRole('tab', { name: 'Reportes' }).click();
  await expect(p.getByText('Movimientos del').first()).toBeVisible();
}

export async function irACargar(p: Page) {
  await p.getByRole('tab', { name: 'Cargar' }).click();
  await expect(p.getByText('Cargados el').first()).toBeVisible();
}

export const primeraTabla = (p: Page) => p.locator('table').first();
export const formulario = (p: Page) => p.locator('form.formulario').first();

/** Abre el ⋯ del renglón que tiene ese texto y elige una opción. */
export async function accion(p: Page, texto: string, opcion: string, tabla: Locator = primeraTabla(p)) {
  await tabla.locator('tr', { hasText: texto }).locator('.boton-mas').first().click();
  await p.getByRole('menuitem', { name: opcion }).click();
}

/** Las opciones que ofrece el ⋯ de un renglón. Cierra el menú al terminar. */
export async function opciones(p: Page, texto: string, tabla: Locator = primeraTabla(p)) {
  await tabla.locator('tr', { hasText: texto }).locator('.boton-mas').first().click();
  const items = await p.getByRole('menuitem').allInnerTexts();
  await p.keyboard.press('Escape');
  return items;
}

/** Carga un movimiento desde la solapa Cargar. Espera la confirmación "Guardado". */
export async function cargarMovimiento(
  p: Page,
  m: { tipo: 'Gasto' | 'Ingreso'; categoria: string; descripcion: string; monto: string; medio?: string; turno?: 'Mañana' | 'Noche' },
) {
  const f = formulario(p);
  if (m.turno) {
    await f.getByRole('group', { name: 'Turno' }).getByRole('button', { name: m.turno }).click();
  }
  await f.getByRole('group', { name: 'Tipo' }).getByRole('button', { name: m.tipo }).click();
  await f.locator('select').first().selectOption({ label: m.categoria });
  await f.getByPlaceholder('Por ejemplo: verdura').fill(m.descripcion);
  await f.locator('input[inputmode=decimal]').fill(m.monto);
  if (m.medio) await f.locator('select').nth(1).selectOption({ label: m.medio });
  await f.getByRole('button', { name: /Guardar movimiento/ }).click();
  await expect(f.locator('.aviso-ok')).toContainText('Guardado');
}

export const sinDesborde = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
