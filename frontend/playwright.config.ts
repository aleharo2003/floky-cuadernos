import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas en navegador contra la app entera: Django sirve la API y el build de React (ADR-0006).
 * Antes de correrlas: base de datos vacía en DATABASE_URL y `npm run build`. Ver e2e/README.md.
 */
const PUERTO = Number(process.env.E2E_PUERTO ?? 8000);
const PYTHON = process.env.E2E_PYTHON ?? 'python';

export default defineConfig({
  testDir: 'e2e',
  // Todas las pruebas comparten una base: van de a una, y cada archivo arranca con el seed de cero.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PUERTO}`,
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires',
    // Si algo falla, queda la captura y el paso a paso para ver qué pasó.
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 900 } } }],
  webServer: {
    command: `${PYTHON} manage.py runserver 127.0.0.1:${PUERTO} --noreload`,
    cwd: '../backend',
    url: `http://127.0.0.1:${PUERTO}/api/auth/session/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: { ...(process.env as Record<string, string>), DJANGO_DEBUG: '1', DJANGO_SECURE_SSL_REDIRECT: '0' },
  },
});
