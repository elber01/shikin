import { es as dateFnsEs, enUS as dateFnsEn } from 'date-fns/locale';
import type { Locale } from './currency';

/**
 * Locale de date-fns para el idioma activo.
 *
 * date-fns no conoce el idioma del usuario: sin esto, "27 de septiembre de
 * 2026" se renderiza en inglés dentro de una UI en español.
 */
export function dateFnsLocale(locale: Locale) {
  return locale === 'es' ? dateFnsEs : dateFnsEn;
}
