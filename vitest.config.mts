import path from 'path';
import { defineConfig } from 'vitest/config';

/**
 * Configuración de Vitest para Shikin (10-U4).
 *
 * - `environment: 'node'` → los tests corren sobre Node (no Bun, no jsdom).
 *   No hay tests de componentes todavía; cuando los haya, jsdom entra como
 *   dependencia explícita (y no antes).
 * - `globals: false` → `describe`/`it`/`expect` se importan de `vitest`
 *   explícitamente (nada implícito).
 * - Alias `@` → `src/` (el mismo alias que usa `tsconfig.json`).
 * - El DDL y la BD de test se montan en `tests/global-setup.ts` (P3, opcional).
 *
 * El alias usa `process.cwd()` (NO `import.meta.url`) a propósito: `vitest.config.mts`
 * se carga con transformadores ESM/TS y `import.meta.url` no es fiable en todas
 * las versiones de Node que ejecuta el runner en CI.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
    },
  },
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**', '**/*.tsx'],
    setupFiles: ['tests/setup.ts'],
    globalSetup: ['tests/global-setup.ts'],
    testTimeout: 10_000,
    hookTimeout: 30_000,
    passWithNoTests: false,
  },
});
