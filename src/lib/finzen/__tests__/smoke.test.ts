import { describe, expect, it } from 'vitest';
import { VIEW_KEYS, parseViewKey } from '@/lib/finzen/views';

/**
 * Smoke test de la infraestructura de Vitest (10-U4).
 *
 * Comprueba que el runner está operativo (alias `@`, `environment: 'node'`,
 * imports explícitos) con una función pura del repo.
 */
describe('infraestructura Vitest (10-U4)', () => {
  it('ejecuta los tests con el alias @ y el environment node', () => {
    expect(typeof process.versions.node).toBe('string');
    expect(parseViewKey(null)).toBe('dashboard');
    expect(VIEW_KEYS.length).toBeGreaterThan(0);
  });
});
