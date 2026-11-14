/**
 * Vistas del shell — fuente de verdad ÚNICA (convención 10-U2, SDD §5.8).
 *
 * El union `ViewKey` vive aquí y NUNCA se redeclara en otro fichero: el store
 * lo re-exporta y todos los mapas del shell (`VIEW_REGISTRY`, `VIEWS`) son
 * `Record<ViewKey, …>` → `tsc` falla si falta una vista (anti-drift).
 *
 * Módulo PURO: sin React, sin DOM, sin Next.
 */

export const VIEW_KEYS = [
  'dashboard',
  'transactions',
  'accounts',
  'budgets',
  'reports',
  'import',
  'settings',
] as const;

export type ViewKey = (typeof VIEW_KEYS)[number];

/** Vista por defecto: URL sin `view` o con un `view` inválido. */
export const DEFAULT_VIEW: ViewKey = 'dashboard';

const VIEW_KEY_SET: ReadonlySet<string> = new Set<string>(VIEW_KEYS);

/** ¿El valor es una clave de vista válida? */
export function isViewKey(value: unknown): value is ViewKey {
  return typeof value === 'string' && VIEW_KEY_SET.has(value);
}

/**
 * Parsea el query param `view` de la URL.
 * Ausente, vacío o inválido → `DEFAULT_VIEW` (sin error ni toast visible).
 */
export function parseViewKey(raw: string | null | undefined): ViewKey {
  return isViewKey(raw) ? raw : DEFAULT_VIEW;
}

/** Helper de exhaustividad: solo compila si `T` es `never`. */
export type AssertNever<T extends never> = T;

/** Vistas de `ViewKey` que un subconjunto NO cubre. */
export type MissingViews<Covered extends ViewKey> = Exclude<ViewKey, Covered>;
