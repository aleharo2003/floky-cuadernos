import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// En producción Django sirve el build bajo /static/ (ADR-0006).
// En desarrollo, Vite pasa /api y /admin a Django, así la sesión y el CSRF funcionan igual que en producción.
const api = process.env.VITE_API_TARGET ?? 'http://localhost:8000';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/static/' : '/',
  build: { outDir: 'dist', emptyOutDir: true },
  server: {
    proxy: {
      '/api': api,
      '/admin': api,
    },
  },
}));
