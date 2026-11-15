import type { ViewKey } from '@/lib/finzen/views';
import {
  buildTransactionQuery,
  type TransactionFilters,
} from '@/lib/finzen/transaction-filters';

/**
 * Construcción de URLs de vista (convención 10-U4, SDD §5.10).
 *
 * Módulo PURO: sin React, sin DOM, sin Next, sin Prisma.
 *
 * - `buildViewHref` es el ÚNICO constructor de URLs de drill-down: el destino
 *   es siempre `?view=transactions` + filtros. En cualquier otra vista los
 *   filtros se IGNORAN (no tienen destino real).
 * - `replaceViewParamInSearch` canonicaliza el param `view` PRESERVANDO todos
 *   los demás (los filtros no se pierden al cambiar de vista).
 */

/** URL de una vista, con filtros opcionales (solo aplican a Transacciones). */
export function buildViewHref(view: ViewKey, filters?: TransactionFilters): string {
  const query = view === 'transactions' && filters ? buildTransactionQuery(filters) : '';
  return query ? `/?view=${view}&${query}` : `/?view=${view}`;
}

/**
 * Sustituye el param `view` de un query string preservando el resto.
 * `'?view=reports&category=abc'` + `'transactions'` → `'?view=transactions&category=abc'`.
 */
export function replaceViewParamInSearch(search: string, view: ViewKey): string {
  const current = new URLSearchParams(search);
  current.delete('view');

  const next = new URLSearchParams();
  next.set('view', view);
  for (const [key, value] of current.entries()) {
    next.append(key, value);
  }
  return `?${next.toString()}`;
}
