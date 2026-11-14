'use client';

import { useSyncExternalStore } from 'react';

/**
 * Detección de plataforma (móvil vs escritorio) para el badge de atajos.
 *
 * `isMacPlatform()` SOLO se puede llamar en el cliente: durante el
 * prerender no hay `navigator` y el valor debe ser estable (el badge muestra
 * `Ctrl+K` por defecto y cambia a `⌘K` tras montar, sin flash de hidratación).
 */

/** Suscripción no-op: la plataforma no cambia durante la sesión. */
const noopSubscribe = () => () => {};

/**
 * ¿Estamos en macOS (⌘) o en otro sistema (Ctrl)?
 * Fallback a `userAgent` cuando `platform` no está disponible.
 */
export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform =
    nav.userAgentData?.platform ?? nav.platform ?? nav.userAgent ?? '';
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/**
 * Versión reactiva de `isMacPlatform()`:
 * `false` durante el prerender y el primer render del cliente, el valor real
 * después (sin `setState` en un efecto → sin flash de hidratación).
 */
export function useIsMacPlatform(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => isMacPlatform(),
    () => false
  );
}
