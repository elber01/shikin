'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useFinZenStore } from '@/store/finzen-store';
import type { ViewKey } from '@/lib/finzen/views';

/** Opciones de `navigate()`. */
export interface NavigateOptions {
  /** Sustituye la entrada del historial en vez de añadir una (canonicalizar). */
  replace?: boolean;
}

/**
 * Navegación entre vistas (convención 10-U2).
 *
 * Único camino permitido para cambiar de vista: actualiza el store de forma
 * optimista (`setActiveView`) y sincroniza la URL con `/?view=<viewKey>` para
 * que el botón atrás/adelante del navegador funcione (deep-link).
 *
 * Si la vista solicitada YA es la activa del store, se usa `replace`: la URL
 * se sincroniza (p. ej. tras una canonicalización o un deep-link) sin añadir
 * una entrada al historial — si no, el botón "atrás" volvería a la misma vista
 * sin efecto visible.
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
      const url = `/?view=${view}`;
      if (opts?.replace || isSameView) {
        router.replace(url, { scroll: false });
      } else {
        router.push(url, { scroll: false });
      }
    },
    [router, setActiveView]
  );
}
