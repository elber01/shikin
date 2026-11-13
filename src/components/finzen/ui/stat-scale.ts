/**
 * Escala responsive de stats — fuente ÚNICA (convención 8.7 de AGENTS.md §5).
 *
 * La regla del repo: el grid de stats se apila bajo el breakpoint que permite
 * que el TEXTO más grande quepa. El techo de fuente y el breakpoint NO se
 * pueden decidir en sitios distintos — por eso viven juntos aquí.
 *
 *   sm → techo `text-xl` → 3 columnas desde `md`
 *   md → techo `text-2xl` → 3 columnas desde `lg`
 *   lg → techo `text-4xl` → 3 columnas desde `lg`
 *
 * `StatCard`, `StatGrid` y `KpiCard` leen de esta tabla: cambiar la escala es
 * cambiar UNA línea y todas las vistas se mueven juntas.
 */
export const STAT_SCALE = {
  sm: { amount: 'text-base sm:text-lg md:text-xl', grid: 'md:grid-cols-3' },
  md: { amount: 'text-xl sm:text-2xl', grid: 'lg:grid-cols-3' },
  lg: { amount: 'text-3xl sm:text-4xl', grid: 'lg:grid-cols-3' },
} as const;

export type StatScale = keyof typeof STAT_SCALE;
