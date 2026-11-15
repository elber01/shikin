import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VIEW,
  VIEW_KEYS,
  isViewKey,
  parseViewKey,
  type ViewKey,
} from '@/lib/finzen/views';

/**
 * P1 — Contrato de vistas (convención 10-U2).
 *
 * `ViewKey` es la fuente de verdad ÚNICA: los mapas del shell son
 * `Record<ViewKey, …>` → `tsc` falla si falta una vista.
 */
describe('views', () => {
  it('expone exactamente las 7 vistas del shell', () => {
    expect(VIEW_KEYS).toHaveLength(7);
    expect([...VIEW_KEYS]).toEqual([
      'dashboard',
      'transactions',
      'accounts',
      'budgets',
      'reports',
      'import',
      'settings',
    ]);
  });

  it('parseViewKey: ausente, vacío o inválido → dashboard (parseo TOTAL)', () => {
    expect(parseViewKey(null)).toBe('dashboard');
    expect(parseViewKey(undefined)).toBe('dashboard');
    expect(parseViewKey('')).toBe('dashboard');
    expect(parseViewKey('foo')).toBe('dashboard');
    expect(parseViewKey('DASHBOARD')).toBe('dashboard');
    expect(DEFAULT_VIEW).toBe('dashboard');
  });

  it('parseViewKey: una clave válida se respeta', () => {
    expect(parseViewKey('reports')).toBe('reports');
    expect(parseViewKey('transactions')).toBe('transactions');
    expect(parseViewKey('settings')).toBe('settings');
  });

  it('isViewKey discrimina solo las claves del catálogo', () => {
    expect(isViewKey('reports')).toBe(true);
    expect(isViewKey('foo')).toBe(false);
    expect(isViewKey(null)).toBe(false);
    expect(isViewKey(undefined)).toBe(false);
    expect(isViewKey(7)).toBe(false);
    expect(isViewKey({})).toBe(false);
  });

  it('toda clave de VIEW_KEYS es una ViewKey válida (anti-drift en runtime)', () => {
    for (const key of VIEW_KEYS) {
      const typed: ViewKey = key;
      expect(isViewKey(typed)).toBe(true);
    }
  });
});
