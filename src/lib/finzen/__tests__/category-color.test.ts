import { describe, expect, it } from 'vitest';
import {
  CATEGORY_COLOR_HEX,
  CATEGORY_COLOR_KEYS,
  LEGACY_CATEGORY_COLOR_ALIASES,
  categoryColorSoft,
  categoryColorVar,
  isCategoryColorKey,
  nearestCategoryColorKey,
  normalizeCategoryColor,
} from '@/lib/finzen/category-color';

/**
 * P1 — Color de categoría como TOKEN (convención 10-U1).
 *
 * `Category.color` guarda una clave (`cat-1`..`cat-12`); el render NUNCA
 * emite un HEX crudo (rompe el dark mode). Un HEX heredado se resuelve al
 * token más cercano en OKLab.
 */
describe('normalizeCategoryColor', () => {
  it('respeta una clave de token válida', () => {
    expect(normalizeCategoryColor('cat-3')).toBe('cat-3');
    expect(normalizeCategoryColor('cat-12')).toBe('cat-12');
  });

  it('resuelve el alias heredado #10B981 → cat-1', () => {
    expect(LEGACY_CATEGORY_COLOR_ALIASES['#10B981']).toBe('cat-1');
    expect(normalizeCategoryColor('#10B981')).toBe('cat-1');
    expect(normalizeCategoryColor('#10b981')).toBe('cat-1');
  });

  it('mapea los HEX ancla a su propio token (vecino OKLab exacto)', () => {
    expect(normalizeCategoryColor('#059669')).toBe('cat-1');
    expect(normalizeCategoryColor('#F59E0B')).toBe('cat-5');
    expect(normalizeCategoryColor('#6B7280')).toBe('cat-12');
  });

  it('cada token maps a sí mismo (las 12 anclas son estables)', () => {
    for (const key of CATEGORY_COLOR_KEYS) {
      expect(normalizeCategoryColor(CATEGORY_COLOR_HEX[key])).toBe(key);
    }
  });

  it('la basura, el vacío y null caen al fallback cat-12', () => {
    expect(normalizeCategoryColor(null)).toBe('cat-12');
    expect(normalizeCategoryColor(undefined)).toBe('cat-12');
    expect(normalizeCategoryColor('')).toBe('cat-12');
    expect(normalizeCategoryColor('basura')).toBe('cat-12');
    expect(normalizeCategoryColor('cat-99')).toBe('cat-12');
    expect(normalizeCategoryColor(42)).toBe('cat-12');
  });

  it('acepta HEX de 3 dígitos', () => {
    expect(normalizeCategoryColor('#0a9')).toBe(normalizeCategoryColor('#00aa99'));
  });
});

describe('nearestCategoryColorKey', () => {
  it('devuelve una clave de token válida', () => {
    const key = nearestCategoryColorKey('#123456');
    expect(isCategoryColorKey(key)).toBe(true);
  });
});

describe('categoryColorVar / categoryColorSoft', () => {
  it('nunca devuelve un HEX crudo', () => {
    expect(categoryColorVar('#10B981')).toBe('var(--cat-1)');
    expect(categoryColorVar(null)).toBe('var(--cat-12)');
    expect(categoryColorVar('basura')).toBe('var(--cat-12)');
    expect(categoryColorVar('cat-5')).toBe('var(--cat-5)');
    expect(categoryColorSoft('cat-5')).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });

  it('el tinte suave se deriva del token, sin HEX', () => {
    expect(categoryColorSoft('cat-5')).toContain('var(--cat-5)');
    expect(categoryColorSoft(null)).toContain('var(--cat-12)');
  });
});
