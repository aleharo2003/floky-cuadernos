import { defineConfig } from 'vitest/config';

// Las pruebas unitarias viven en src/. Las de navegador (e2e/) las corre Playwright, no vitest.
export default defineConfig({
  test: { include: ['src/**/*.test.ts'] },
});
