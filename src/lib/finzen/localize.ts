import type { Locale } from './currency';

/**
 * Helpers de localización compartidos por los componentes.
 *
 * Existen para que las vistas NO ramifiquen con `locale === 'es' ?`:
 * la regla de "qué idioma gana" vive aquí, en un único sitio, y el texto
 * visible sale de `i18n.ts`.
 */

/** Categoría con sus nombres traducidos opcionales (en Prisma: nameEs/nameEn). */
export interface LocalizedCategory {
  name: string;
  nameEs?: string | null;
  nameEn?: string | null;
}

/**
 * Nombre de la categoría en el idioma activo.
 * `nameEs`/`nameEn` son opcionales → cae al `name` neutro.
 */
export function localizedCategoryName(c: LocalizedCategory, locale: Locale): string {
  return locale === 'es' ? c.nameEs || c.name : c.nameEn || c.name;
}

/** Locale BCP-47 para `Intl` (fechas y números). */
export function intlLocale(locale: Locale): string {
  return locale === 'es' ? 'es-DO' : 'en-US';
}

/** Idioma al que salta el toggle de idioma. */
export function otherLocale(locale: Locale): Locale {
  return locale === 'es' ? 'en' : 'es';
}

/** Bandera del idioma (emoji: no es texto traducible, pero sí cultural). */
export function localeFlag(locale: Locale): string {
  return locale === 'es' ? '🇪🇸' : '🇬🇧';
}

/**
 * Elige la variante del par (es, en) que corresponde al idioma activo.
 * Se usa con datos que ya vienen bilingües desde el servidor (alertas).
 */
export function localizedPair(
  es: string | null | undefined,
  en: string | null | undefined,
  locale: Locale
): string {
  const primary = locale === 'es' ? es : en;
  const fallback = locale === 'es' ? en : es;
  return primary || fallback || '';
}

/**
 * Etiqueta legible de un periodo de filtros (convención 10-U4).
 *
 * Se usa en los `aria-label` del drill-down: el nombre accesible debe llevar
 * el dato real (categoría/cuenta + importe + periodo). Un rango dentro del
 * mismo mes se muestra como un único mes ("noviembre de 2026"); si abarca
 * varios, se muestra "mes A – mes B".
 */
export function filterPeriodLabel(
  from: string | null,
  to: string | null,
  locale: Locale
): string {
  if (!from && !to) return '';

  const format = (value: string): string =>
    new Intl.DateTimeFormat(intlLocale(locale), {
      month: 'long',
      year: 'numeric',
    }).format(new Date(`${value}T12:00:00`));

  if (from && to) {
    const fromLabel = format(from);
    const toLabel = format(to);
    return fromLabel === toLabel ? fromLabel : `${fromLabel} – ${toLabel}`;
  }

  const only = from ?? to;
  return only ? format(only) : '';
}
