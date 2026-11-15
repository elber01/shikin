'use client';

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useViewNavigation } from '@/hooks/use-view-navigation';
import {
  EMPTY_TRANSACTION_FILTERS,
  parseTransactionFilters,
  type TransactionFilters,
} from '@/lib/finzen/transaction-filters';

/**
 * Filtros de la vista de Transacciones (convención 10-U4, SDD §5.10).
 *
 * La URL es la FUENTE DE VERDAD de los filtros: este hook lee de los query
 * params y escribe siempre a través de `useViewNavigation().navigate()`, que
 * es el único camino de navegación permitido (nunca `setActiveView`).
 *
 * - `applyFilters` usa `replace` por defecto: cambiar un filtro NO ensucia el
 *   historial del navegador (AGENTS.md §5 — "Drill-down y filtros en URL").
 * - El drill-down desde OTRA vista (`navigate('transactions', { filters })`)
 *   sí hace `push`: el botón "atrás" vuelve a la vista de origen.
 */
export interface UseTransactionFiltersResult {
  /** Filtros actuales, derivados de la URL. */
  filters: TransactionFilters;
  /** Escribe unos filtros nuevos en la URL (`replace` por defecto). */
  applyFilters(next: TransactionFilters, opts?: { replace?: boolean }): void;
  /** Borra todos los filtros → `?view=transactions`. */
  clearFilters(): void;
}

export function useTransactionFilters(): UseTransactionFiltersResult {
  const searchParams = useSearchParams();
  const navigate = useViewNavigation();

  // `searchParams` no tiene identidad estable entre renders: se usa su query
  // string (un string) como dependencia del memo.
  const queryString = searchParams.toString();

  const filters = useMemo(
    () => parseTransactionFilters(new URLSearchParams(queryString)),
    [queryString]
  );

  const applyFilters = useCallback(
    (next: TransactionFilters, opts?: { replace?: boolean }) => {
      navigate('transactions', {
        filters: next,
        replace: opts?.replace ?? true,
      });
    },
    [navigate]
  );

  const clearFilters = useCallback(() => {
    navigate('transactions', {
      filters: EMPTY_TRANSACTION_FILTERS,
      replace: true,
    });
  }, [navigate]);

  return { filters, applyFilters, clearFilters };
}
