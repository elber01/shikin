import type { ReadonlyURLSearchParams } from 'next/navigation';
import { toLocalDateString } from '@/lib/finzen/date-utils';

/**
 * Filtros de la vista de Transacciones (convención 10-U4, SDD §5.10).
 *
 * Módulo PURO: sin React, sin DOM, sin Next, sin Prisma. Solo parsea y
 * serializa los query params de la URL, que es la FUENTE DE VERDAD de los
 * filtros de la vista.
 *
 * El parseo es TOTAL (nunca lanza, nunca muestra un error): un parámetro
 * inválido se descarta en silencio, con el mismo patrón que `parseViewKey`:
 * - `category` / `account`: id no vacío, ≤64 chars y `/^[A-Za-z0-9_-]+$/`.
 * - `type`: solo `income|expense|transfer|adjustment`.
 * - `from` / `to`: `YYYY-MM-DD` REAL (2026-02-30 no existe → se descarta).
 * - `from > to`: se normaliza INTERCAMBIANDO los dos.
 * - `q`: texto libre, recortado a 200 caracteres.
 *
 * El `import type` de Next se borra en compilación: el módulo no tiene
 * dependencia de runtime con Next (ni con el DOM).
 */

/** Tipos de transacción que el filtro de la vista puede acotar. */
export type TransactionTypeFilter = 'income' | 'expense' | 'transfer' | 'adjustment';

/** Estado de los filtros de Transacciones (derivado de la URL). */
export interface TransactionFilters {
  /** id de Category (puede no existir → la vista lo valida). */
  categoryId: string | null;
  /** id de Account (puede no existir → la vista lo valida). */
  accountId: string | null;
  /** Tipo de transacción (`null` = todos). */
  type: TransactionTypeFilter | null;
  /** `YYYY-MM-DD` inclusivo (límite inferior). */
  from: string | null;
  /** `YYYY-MM-DD` inclusivo (límite superior). */
  to: string | null;
  /** Texto libre sobre `tx.description` (`''` = sin búsqueda). */
  query: string;
}

/** Filtros vacíos (referencia congelada: nadie la muta por accidente). */
export const EMPTY_TRANSACTION_FILTERS: TransactionFilters = Object.freeze({
  categoryId: null,
  accountId: null,
  type: null,
  from: null,
  to: null,
  query: '',
});

/** Presets de rango de fechas que la vista ofrece. */
export type DateFilterPreset =
  | 'all'
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'this_year'
  | 'last_year'
  | 'custom';

const TRANSACTION_TYPE_FILTERS: readonly TransactionTypeFilter[] = [
  'income',
  'expense',
  'transfer',
  'adjustment',
];

const TRANSACTION_TYPE_SET: ReadonlySet<string> = new Set<string>(TRANSACTION_TYPE_FILTERS);

/** Formato de id aceptado en la URL (cuid de Prisma y similares). */
const ID_PATTERN = /^[A-Za-z0-9_-]+$/;

/** Longitud máxima de un id en la query. */
const MAX_ID_LENGTH = 64;

/** Longitud máxima del texto de búsqueda. */
const MAX_QUERY_LENGTH = 200;

/** Orden canónico de serialización (URL determinista). */
export const TRANSACTION_FILTER_PARAM_ORDER = [
  'category',
  'account',
  'type',
  'from',
  'to',
  'q',
] as const;

/** Parsea un id de la query (`category` / `account`). */
function parseId(raw: string | null): string | null {
  if (raw === null) return null;
  if (raw.length === 0 || raw.length > MAX_ID_LENGTH) return null;
  return ID_PATTERN.test(raw) ? raw : null;
}

/** Parsea el tipo de transacción. */
function parseType(raw: string | null): TransactionTypeFilter | null {
  if (raw === null) return null;
  return TRANSACTION_TYPE_SET.has(raw) ? (raw as TransactionTypeFilter) : null;
}

/**
 * ¿Es una fecha ISO `YYYY-MM-DD` REAL?
 * `2026-13-45` y `2026-02-30` NO existen → `false`.
 */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** Parsea una fecha de la query (inválida → `null`). */
function parseDate(raw: string | null): string | null {
  if (raw === null) return null;
  return isIsoDate(raw) ? raw : null;
}

/** Parsea el texto de búsqueda (trim + tope de 200 caracteres). */
function parseQuery(raw: string | null): string {
  if (raw === null) return '';
  return raw.trim().slice(0, MAX_QUERY_LENGTH);
}

/**
 * Parsea los filtros desde los query params de la URL.
 * NUNCA lanza: un parámetro inválido se descarta en silencio.
 */
export function parseTransactionFilters(
  params: URLSearchParams | ReadonlyURLSearchParams
): TransactionFilters {
  const categoryId = parseId(params.get('category'));
  const accountId = parseId(params.get('account'));
  const type = parseType(params.get('type'));

  let from = parseDate(params.get('from'));
  let to = parseDate(params.get('to'));
  // Normalización: si el rango viene invertido, se intercambia (no se rompe).
  if (from !== null && to !== null && from > to) {
    const swap = from;
    from = to;
    to = swap;
  }

  return {
    categoryId,
    accountId,
    type,
    from,
    to,
    query: parseQuery(params.get('q')),
  };
}

/**
 * Serializa los filtros a query params (orden canónico:
 * `category`, `account`, `type`, `from`, `to`, `q`).
 * Los filtros vacíos NO aparecen.
 */
export function serializeTransactionFilters(f: TransactionFilters): Record<string, string> {
  const out: Record<string, string> = {};
  if (f.categoryId) out.category = f.categoryId;
  if (f.accountId) out.account = f.accountId;
  if (f.type) out.type = f.type;
  if (f.from) out.from = f.from;
  if (f.to) out.to = f.to;
  if (f.query) out.q = f.query;
  return out;
}

/** Query string canónica de los filtros (`''` si no hay ningún filtro). */
export function buildTransactionQuery(f: TransactionFilters): string {
  const params = serializeTransactionFilters(f);
  const search = new URLSearchParams();
  for (const key of TRANSACTION_FILTER_PARAM_ORDER) {
    const value: string | undefined = params[key];
    if (value !== undefined) search.append(key, value);
  }
  return search.toString();
}

/** `YYYY-MM-DD` de un día concreto. */
function isoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Nº de días de un mes (0-11) de un año. */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Rango de un mes natural. */
function monthRange(year: number, month: number): { from: string; to: string } {
  return { from: isoDate(year, month, 1), to: isoDate(year, month, daysInMonth(year, month)) };
}

/**
 * Rango de fechas de un preset.
 * `all` → sin rango (`null`/`null`).
 */
export function presetToRange(
  preset: Exclude<DateFilterPreset, 'custom'>,
  now: Date
): { from: string | null; to: string | null } {
  const year = now.getFullYear();
  const month = now.getMonth();

  switch (preset) {
    case 'all':
      return { from: null, to: null };
    case 'this_month':
      return monthRange(year, month);
    case 'last_month': {
      const previous = new Date(year, month - 1, 1);
      return monthRange(previous.getFullYear(), previous.getMonth());
    }
    case 'this_quarter': {
      const quarterStart = Math.floor(month / 3) * 3;
      const quarterEnd = quarterStart + 2;
      return {
        from: isoDate(year, quarterStart, 1),
        to: isoDate(year, quarterEnd, daysInMonth(year, quarterEnd)),
      };
    }
    case 'this_year':
      return { from: isoDate(year, 0, 1), to: isoDate(year, 11, 31) };
    case 'last_year':
      return { from: isoDate(year - 1, 0, 1), to: isoDate(year - 1, 11, 31) };
  }
}

/**
 * ¿Qué preset de fecha corresponde al rango actual?
 * Si el rango no encaja en ningún preset → `custom`.
 */
export function resolveDatePreset(f: TransactionFilters, now: Date): DateFilterPreset {
  if (!f.from && !f.to) return 'all';

  const presets: Array<Exclude<DateFilterPreset, 'custom'>> = [
    'this_month',
    'last_month',
    'this_quarter',
    'this_year',
    'last_year',
  ];
  for (const preset of presets) {
    const range = presetToRange(preset, now);
    if (range.from === f.from && range.to === f.to) return preset;
  }
  return 'custom';
}

/**
 * Rango de un mes natural a partir de su clave `YYYY-MM`.
 * `monthKeyRange('2026-11')` → `{ from: '2026-11-01', to: '2026-11-30' }`.
 * Una clave inválida → `null`.
 */
export function monthKeyRange(monthKey: string): { from: string; to: string } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return monthRange(year, month - 1);
}

/** ¿Hay algún filtro activo? */
export function hasActiveFilters(f: TransactionFilters): boolean {
  return (
    f.categoryId !== null ||
    f.accountId !== null ||
    f.type !== null ||
    f.from !== null ||
    f.to !== null ||
    f.query !== ''
  );
}

// ─────────────────────────────────────────────────────────────
// Estado de los filtros frente a los datos cargados (puro)
// ─────────────────────────────────────────────────────────────

/** Referencia mínima a una categoría/cuenta (solo el id). */
export interface FilterEntityRef {
  id: string;
}

/** Contexto para resolver si los filtros de la URL son aplicables. */
export interface FilterActivationContext {
  /** Categorías ya cargadas. */
  categories: readonly FilterEntityRef[];
  /** Cuentas ya cargadas. */
  accounts: readonly FilterEntityRef[];
  /** ¿Los datos siguen cargando? */
  loading: boolean;
}

/** Resultado de resolver los filtros de la URL contra los datos cargados. */
export interface ResolvedFilterActivation {
  /** El filtro de categoría ACOTA los resultados. */
  categoryActive: boolean;
  /** El filtro de cuenta ACOTA los resultados. */
  accountActive: boolean;
  /** La categoría del filtro existe en el catálogo cargado. */
  categoryExists: boolean;
  /** La cuenta del filtro existe en el catálogo cargado. */
  accountExists: boolean;
  /** Hay un filtro que apunta a algo que ya no existe. */
  hasDanglingFilter: boolean;
}

/**
 * Resuelve los filtros de la URL contra los datos ya cargados.
 *
 * MIENTRAS CARGA (`loading: true`) todavía no se puede saber si el id de la
 * URL existe: tratarlo como COLGANTE descartaría un deep-link válido (el
 * filtro se desactivaría y saltaría un aviso falso). Mientras carga:
 * - NO hay aviso de filtro colgante,
 * - el filtro se aplica con normalidad (queda activo a la espera de los datos).
 *
 * Con los datos ya cargados, un id que no existe → filtro COLGANTE: se avisa
 * y el filtro queda INACTIVO (no acota los resultados).
 */
export function resolveFilterActivation(
  filters: TransactionFilters,
  context: FilterActivationContext
): ResolvedFilterActivation {
  const categoryExists =
    filters.categoryId !== null && context.categories.some((c) => c.id === filters.categoryId);
  const accountExists =
    filters.accountId !== null && context.accounts.some((a) => a.id === filters.accountId);

  if (context.loading) {
    return {
      categoryActive: filters.categoryId !== null,
      accountActive: filters.accountId !== null,
      categoryExists,
      accountExists,
      hasDanglingFilter: false,
    };
  }

  return {
    categoryActive: categoryExists,
    accountActive: accountExists,
    categoryExists,
    accountExists,
    hasDanglingFilter:
      (filters.categoryId !== null && !categoryExists) ||
      (filters.accountId !== null && !accountExists),
  };
}

/**
 * Valor del `Select` de categoría/cuenta: SIEMPRE un ítem existente de la
 * lista (Radix exige que el valor tenga su `SelectItem`).
 *
 * - MIENTRAS CARGA (`loading: true`): el id de la URL. El catálogo todavía no
 *   está, pero el filtro SÍ se aplica → el desplegable no puede afirmar
 *   "todas" (el usuario vería una lista filtrada con un desplegable que dice
 *   lo contrario).
 * - TRAS CARGAR: el id si existe en el catálogo; si no, `"all"` (el filtro
 *   queda INACTIVO → el desplegable debe decirlo).
 */
export function resolveSelectFilterValue(
  filterId: string | null,
  exists: boolean,
  loading: boolean
): string {
  if (filterId === null) return 'all';
  if (loading) return filterId;
  return exists ? filterId : 'all';
}

// ─────────────────────────────────────────────────────────────
// Aplicación de los filtros (puro, sin React)
// ─────────────────────────────────────────────────────────────

/** Datos mínimos de una transacción para poder filtrarla. */
export interface FilterableTransaction {
  occurredOn: string | Date;
  categoryId?: string | null;
  fromAccountId?: string | null;
  toAccountId?: string | null;
  type: string;
  description?: string | null;
}

/**
 * Qué filtros están ACTIVOS.
 *
 * Un filtro COLGANTE (categoría/cuenta que ya no existe) está INACTIVO: se
 * conserva en la URL (para que el usuario lo pueda quitar) pero NO acota los
 * resultados (si no, la vista quedaría vacía sin explicación).
 */
export interface TransactionFilterActivation {
  /** La categoría del filtro existe → el filtro acota. */
  categoryActive: boolean;
  /** La cuenta del filtro existe → el filtro acota. */
  accountActive: boolean;
}

/**
 * Aplica los filtros de la URL a una lista de transacciones.
 *
 * Es la MISMA función que usa la vista al renderizar: al cargar en frío
 * `/?view=transactions&category=<id>&from=...&to=...` no hay estado local que
 * inicializar — los filtros vienen de la URL y se aplican en el primer render.
 *
 * Devuelve la lista filtrada ORDENADA de más reciente a más antigua.
 */
export function applyTransactionFilters<T extends FilterableTransaction>(
  transactions: readonly T[],
  filters: TransactionFilters,
  activation: TransactionFilterActivation
): T[] {
  return transactions
    .filter((tx) => {
      // Rango de fechas (inclusivo) — comparación de fechas ISO locales.
      const date = toLocalDateString(new Date(tx.occurredOn));
      if (filters.from && date < filters.from) return false;
      if (filters.to && date > filters.to) return false;
      // Categoría (solo si existe; si no, el filtro está INACTIVO).
      if (activation.categoryActive && tx.categoryId !== filters.categoryId) return false;
      // Cuenta: filtra por origen O destino.
      if (
        activation.accountActive &&
        tx.fromAccountId !== filters.accountId &&
        tx.toAccountId !== filters.accountId
      ) {
        return false;
      }
      // Tipo de transacción.
      if (filters.type && tx.type !== filters.type) return false;
      // Búsqueda por descripción (el valor filtrante es el de la URL).
      if (filters.query) {
        const needle = filters.query.toLowerCase();
        if (!(tx.description ?? '').toLowerCase().includes(needle)) return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.occurredOn).getTime() - new Date(a.occurredOn).getTime());
}
