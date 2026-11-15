import { describe, expect, it } from 'vitest';
import { translations } from '@/lib/finzen/i18n';

/**
 * P2 — Paridad i18n (es/en).
 *
 * `TranslationKey` es DERIVADO del diccionario `es` y `en` es
 * `Record<TranslationKey, string>` → `tsc` ya garantiza que no falte ninguna
 * clave. Lo que `tsc` NO cubre son los PLACEHOLDERS (`{n}`, `{name}`, …):
 * una clave puede existir en ambos idiomas con placeholders distintos y la
 * vista mostraría un texto roto ("undefined" o un literal sin sustituir).
 *
 * Este test cierra ese hueco: mismo set de claves, mismo nº y placeholders
 * idénticos en cada clave.
 */

/** Extrae los placeholders `{…}` de una cadena, en orden de aparición. */
function placeholdersOf(value: string): string[] {
  const matches = value.match(/\{[^{}]+\}/g);
  return matches ? matches.slice().sort() : [];
}

const es = translations.es;
const en = translations.en;

describe('i18n — paridad es/en', () => {
  it('las dos tablas tienen EXACTAMENTE el mismo set de claves', () => {
    const esKeys = Object.keys(es).sort();
    const enKeys = Object.keys(en).sort();
    expect(enKeys).toEqual(esKeys);
  });

  it('las dos tablas tienen el mismo nº de claves', () => {
    expect(Object.keys(en)).toHaveLength(Object.keys(es).length);
  });

  it('no hay claves duplicadas en es ni en en', () => {
    for (const locale of ['es', 'en'] as const) {
      const keys = Object.keys(translations[locale]);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('los placeholders de cada clave coinciden entre es y en', () => {
    const mismatches: string[] = [];
    for (const key of Object.keys(es) as Array<keyof typeof es>) {
      const esPlaceholders = placeholdersOf(es[key]);
      const enPlaceholders = placeholdersOf(en[key]);
      if (esPlaceholders.join('|') !== enPlaceholders.join('|')) {
        mismatches.push(
          `${key}: es=[${esPlaceholders.join(',')}] en=[${enPlaceholders.join(',')}]`
        );
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('ninguna traducción queda vacía', () => {
    for (const key of Object.keys(es) as Array<keyof typeof es>) {
      expect(es[key].trim().length).toBeGreaterThan(0);
      expect(en[key].trim().length).toBeGreaterThan(0);
    }
  });
});
