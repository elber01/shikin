/**
 * Categorías — color como TOKEN semántico (convención 10-U1, SDD §5.7).
 *
 * `Category.color` guarda una CLAVE (`cat-1`..`cat-12`), nunca un HEX. El
 * color real vive en `src/app/globals.css` como `--cat-N` (light + dark), así
 * que la vista siempre pinta `var(--cat-N)` y el tema decide el tono.
 *
 * Este módulo es PURO (sin React, sin Prisma, sin DOM): resuelve la clave,
 * mapea un HEX heredado al token más cercano en OKLab y expone las expresiones
 * CSS que las vistas inyectan en `style` o en props de gráficos.
 *
 * Regla dura: el render NUNCA emite HEX crudo. Aunque la BD conserve un HEX
 * heredado (datos previos a la migración), la vista lo normaliza aquí.
 */

/** Claves de token válidas para `Category.color`. */
export const CATEGORY_COLOR_KEYS = [
  'cat-1',
  'cat-2',
  'cat-3',
  'cat-4',
  'cat-5',
  'cat-6',
  'cat-7',
  'cat-8',
  'cat-9',
  'cat-10',
  'cat-11',
  'cat-12',
] as const;

export type CategoryColorKey = (typeof CATEGORY_COLOR_KEYS)[number];

/** Token de fallback: gris neutro, usado cuando el color es null o basura. */
export const FALLBACK_CATEGORY_COLOR: CategoryColorKey = 'cat-12';

/**
 * Anclas HEX de cada token (valor de diseño original de la paleta).
 * Solo se usan para (a) migrar datos heredados y (b) calcular el vecino
 * más cercano en OKLab. NUNCA se inyectan en `style` ni en props de gráficos.
 */
export const CATEGORY_COLOR_HEX: Record<CategoryColorKey, string> = {
  'cat-1': '#059669',
  'cat-2': '#14B8A6',
  'cat-3': '#22C55E',
  'cat-4': '#1E3A5F',
  'cat-5': '#F59E0B',
  'cat-6': '#3B82F6',
  'cat-7': '#A855F7',
  'cat-8': '#EF4444',
  'cat-9': '#EC4899',
  'cat-10': '#F97316',
  'cat-11': '#F7931A',
  'cat-12': '#6B7280',
};

const CATEGORY_COLOR_KEY_SET: ReadonlySet<string> = new Set(CATEGORY_COLOR_KEYS);

const CATEGORY_COLOR_KEY_PATTERN = /^cat-(1[0-2]|[1-9])$/;

/** ¿El valor es una clave de token válida (`cat-1`..`cat-12`)? */
export function isCategoryColorKey(v: unknown): v is CategoryColorKey {
  return typeof v === 'string' && CATEGORY_COLOR_KEY_PATTERN.test(v);
}

/** ¿El valor es un HEX de 6 dígitos (`#RRGGBB`)? */
function isHexColor(v: unknown): v is string {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.trim());
}

/** ¿El valor es un HEX de 3 dígitos (`#RGB`)? */
function isShortHexColor(v: unknown): v is string {
  return typeof v === 'string' && /^#[0-9a-fA-F]{3}$/.test(v.trim());
}

/** Expande `#RGB` a `#RRGGBB`. */
function expandShortHex(hex: string): string {
  const body = hex.trim().replace('#', '');
  return `#${body[0]}${body[0]}${body[1]}${body[1]}${body[2]}${body[2]}`;
}

/**
 * Alias de diseño para colores HEREDADOS del seed (fase 10-U1).
 *
 * El seed histórico usaba 13 HEX para 12 tokens: `#10B981` (emerald-500) era
 * el color de "Ingreso Pasivo" y se fusiona con `#059669` (emerald-600) en el
 * token `cat-1`. Es una decisión de diseño de la paleta, no el resultado de
 * una distancia: en OKLab `#10B981` queda algo más cerca de `#14B8A6` (`cat-2`).
 * El alias se resuelve ANTES del vecino OKLab para que los datos migrados
 * coincidan exactamente con los del seed nuevo.
 */
export const LEGACY_CATEGORY_COLOR_ALIASES: Readonly<Record<string, CategoryColorKey>> = {
  '#10B981': 'cat-1',
};

// ─────────────────────────────────────────────────────────────
// Conversión de color: sRGB → OKLab
// ─────────────────────────────────────────────────────────────

type OkLab = { L: number; a: number; b: number };

/** sRGB (0..255) → lineal (0..1). */
function srgbChannelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** HEX `#RRGGBB` → OKLab (Björn Ottosson). */
function hexToOkLab(hex: string): OkLab {
  const normalized = hex.trim().replace('#', '');
  const r = srgbChannelToLinear(parseInt(normalized.slice(0, 2), 16));
  const g = srgbChannelToLinear(parseInt(normalized.slice(2, 4), 16));
  const b = srgbChannelToLinear(parseInt(normalized.slice(4, 6), 16));

  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  };
}

/** Distancia euclídea en OKLab. */
function okLabDistance(a: OkLab, b: OkLab): number {
  const dL = a.L - b.L;
  const da = a.a - b.a;
  const db = a.b - b.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

/**
 * Vecino más cercano de un HEX entre las 12 anclas, medido en OKLab.
 * Empate → índice menor (orden estable de `CATEGORY_COLOR_KEYS`).
 */
export function nearestCategoryColorKey(hex: string): CategoryColorKey {
  const target = hexToOkLab(hex);
  let bestKey: CategoryColorKey = CATEGORY_COLOR_KEYS[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const key of CATEGORY_COLOR_KEYS) {
    const distance = okLabDistance(target, hexToOkLab(CATEGORY_COLOR_HEX[key]));
    // `<` estricto: en empate se conserva el índice menor.
    if (distance < bestDistance) {
      bestDistance = distance;
      bestKey = key;
    }
  }

  return bestKey;
}

/**
 * Normaliza cualquier valor de `Category.color` a una clave de token.
 *
 * - clave válida (`cat-N`) → se respeta tal cual
 * - HEX (`#RGB`/`#RRGGBB`) → alias heredado conocido, si no, vecino más
 *   cercano en OKLab
 * - null / '' / basura → `cat-12` (fallback)
 */
export function normalizeCategoryColor(v: unknown): CategoryColorKey {
  if (isCategoryColorKey(v)) return v;
  if (isHexColor(v) || isShortHexColor(v)) {
    const normalized = v.trim().toUpperCase();
    const alias = LEGACY_CATEGORY_COLOR_ALIASES[normalized];
    if (alias) return alias;
    return nearestCategoryColorKey(
      isShortHexColor(normalized) ? expandShortHex(normalized) : normalized
    );
  }
  return FALLBACK_CATEGORY_COLOR;
}

/** Expresión CSS del token: `var(--cat-3)`. Nunca HEX. */
export function categoryColorVar(v: string | null | undefined): string {
  return `var(--${normalizeCategoryColor(v)})`;
}

/**
 * Expresión CSS del tinte suave del token:
 * `color-mix(in oklab, var(--cat-3) 15%, transparent)`.
 * No existen tokens extra: el tinte se deriva del mismo token.
 */
export function categoryColorSoft(v: string | null | undefined): string {
  return `color-mix(in oklab, var(--${normalizeCategoryColor(v)}) 15%, transparent)`;
}

/**
 * Resolutor CSS para datos de categoría (gráficos, swatches, filas).
 * Un HEX heredado se resuelve a su token vecino en OKLab; el resultado
 * siempre es un `var(--cat-N)`.
 */
export function categoryColorCss(v: string | null | undefined): string {
  return categoryColorVar(v);
}
