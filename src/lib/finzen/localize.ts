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
