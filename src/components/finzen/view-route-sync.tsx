'use client';

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFinZenStore } from '@/store/finzen-store';
import { parseViewKey } from '@/lib/finzen/views';
import { replaceViewParamInSearch } from '@/lib/finzen/view-href';

/**
 * Sincroniza la URL (`/?view=<viewKey>`) con el store (`activeView`).
 *
 * - La URL es la fuente de verdad del deep-link: `/?view=reports` abre Reportes.
 * - `view` ausente o inválido → `dashboard` (sin toast ni error visible).
 * - Canonicaliza siempre con `replace` (nunca `push`): el botón "atrás" del
 *   navegador no queda atrapado en entradas duplicadas.
 *
 * Invariante del efecto:
 *   1. `fromUrl = parseViewKey(viewParam)`.
 *   2. Si `fromUrl !== activeView` → `setActiveView(fromUrl)` y NO se hace
 *      `replace` (la canonicalización llega en la 2ª iteración).
 *   3. Si no y `viewParam !== fromUrl` → `router.replace` con el param `view`
 *      corregido, PRESERVANDO el resto de query params (convención 10-U4:
 *      los filtros de Transacciones no se pierden al canonicalizar).
 *
 * El efecto depende del STRING `viewParam` (no del objeto `searchParams`) y
 * lee el store con `getState()` dentro del efecto.
 */
export function ViewRouteSync() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewParam = searchParams.get('view');
  // Query string completa como STRING (identidad estable entre renders).
  const searchString = searchParams.toString();
  // Suscripción reactiva: hace que el efecto vuelva a correr cuando el store
  // cambia (necesario para la 2ª iteración de la canonicalización).
  const activeView = useFinZenStore((s) => s.activeView);
  // Último parámetro visto: distingue "la URL cambió" (deep-link / atrás) de
  // "el store cambió" (navegación optimista con la URL todavía por detrás).
  const lastParamRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const fromUrl = parseViewKey(viewParam);
    const { activeView: current, setActiveView } = useFinZenStore.getState();
    const paramChanged = lastParamRef.current !== viewParam;
    lastParamRef.current = viewParam;

    if (fromUrl !== current) {
      // Solo se adopta la URL cuando el parámetro CAMBIÓ (deep-link o
      // atrás/adelante). Si el store cambió por una navegación optimista en
      // vuelo, la URL va por detrás → no se revierte la vista.
      if (paramChanged) setActiveView(fromUrl);
      return;
    }

    if (viewParam !== fromUrl) {
      // La canonicalización PRESERVA el resto de query params (convención
      // 10-U4): los filtros de Transacciones no se pierden al corregir el
      // param `view`.
      router.replace(replaceViewParamInSearch(searchString, fromUrl), {
        scroll: false,
      });
    }
  }, [viewParam, activeView, router, searchString]);

  return null;
}
