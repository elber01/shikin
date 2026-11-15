'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useFinZenStore } from '@/store/finzen-store';
import type { ViewKey } from '@/lib/finzen/views';
import type { TransactionFilters } from '@/lib/finzen/transaction-filters';
import { buildViewHref } from '@/lib/finzen/view-href';

/** Opciones de `navigate()`. */
export interface NavigateOptions {
  /** Sustituye la entrada del historial en vez de añadir una (canonicalizar). */
  replace?: boolean;
  /**
   * Filtros de la vista de Transacciones (convención 10-U4).
   * Solo se aplican si `view === 'transactions'`; en cualquier otra vista se
   * ignoran (no hay un destino real detrás de esos filtros).
   */
  filters?: TransactionFilters;
}

/**
 * Navegación entre vistas (convención 10-U2) + drill-down (convención 10-U4).
 *
 * Único camino permitido para cambiar de vista: actualiza el store de forma
 * optimista (`setActiveView`) y sincroniza la URL con `/?view=<viewKey>` para
 * que el botón atrás/adelante del navegador funcione (deep-link).
 *
 * Si la vista solicitada YA es la activa del store, se usa `replace`: la URL
 * se sincroniza (p. ej. tras una canonicalización o un deep-link) sin añadir
 * una entrada al historial — si no, el botón "atrás" volvería a la misma vista
 * sin efecto visible.
 *
 * Los filtros de Transacciones viajan en la URL (`buildViewHref`): la URL es
 * la fuente de verdad de los filtros (compartible, con back/forward).
 */
export function useViewNavigation() {
  const router = useRouter();
  const setActiveView = useFinZenStore((s) => s.setActiveView);

  return useCallback(
    function navigate(view: ViewKey, opts?: NavigateOptions): void {
      // La vista activa se lee del STORE (no de la URL): la navegación es
      // optimista y la URL puede ir por detrás.
      const isSameView = useFinZenStore.getState().activeView === view;
      setActiveView(view);
      const url = buildViewHref(view, opts?.filters);
      if (opts?.replace || isSameView) {
        router.replace(url, { scroll: false });
      } else {
        router.push(url, { scroll: false });
      }
    },
    [router, setActiveView]
  );
}
