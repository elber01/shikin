'use client';

import { useEffect } from 'react';
import { useFinZenStore } from '@/store/finzen-store';
import { VIEW_KEYS } from '@/lib/finzen/views';
import {
  shortcutFor,
  type ShortcutAction,
} from '@/lib/finzen/shortcuts';
import { useViewNavigation } from '@/hooks/use-view-navigation';

/**
 * Atajos globales (convención 10-U2).
 *
 * - `⌘K` / `Ctrl+K` → command palette (toggle). Funciona INCLUSO con el foco
 *   en un campo editable (es el atajo de "buscar en cualquier sitio").
 * - El resto de atajos se ignoran si el foco está en un campo editable o si
 *   hay un modal abierto.
 *
 * La tabla de atajos (símbolos + descripciones) vive en
 * `src/lib/finzen/shortcuts.ts`: el handler y el diálogo de ayuda consumen la
 * MISMA constante → no pueden divergir.
 */

/** ¿El foco está en un campo editable (input/textarea/select/contenteditable)? */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}

/**
 * ¿Hay un modal abierto que bloquee los atajos?
 *
 * La propia command palette NO bloquea (su atajo es el toggle); cualquier otro
 * diálogo o alertdialog sí.
 */
export function hasBlockingModal(): boolean {
  const modals = document.querySelectorAll(
    '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'
  );
  for (const modal of Array.from(modals)) {
    if (!modal.hasAttribute('data-command-palette')) return true;
  }
  return false;
}

/** `Digit1`…`Digit9` → índice 0-based; cualquier otro código → null. */
function digitIndex(code: string): number | null {
  if (!code.startsWith('Digit')) return null;
  const digit = Number(code.slice(5));
  if (!Number.isInteger(digit) || digit < 1 || digit > 9) return null;
  return digit - 1;
}

/** Hook único: se activa UNA vez en el shell (`app-shell.tsx`). */
export function useGlobalShortcuts() {
  const setCommandPaletteOpen = useFinZenStore((s) => s.setCommandPaletteOpen);
  const setShortcutsDialogOpen = useFinZenStore((s) => s.setShortcutsDialogOpen);
  const setAddSheetOpen = useFinZenStore((s) => s.setAddSheetOpen);
  const navigate = useViewNavigation();

  useEffect(() => {
    /** Ejecuta la acción de un atajo (tabla compartida con el diálogo). */
    function runShortcut(action: ShortcutAction, viewIndex?: number) {
      const definition = shortcutFor(action);
      if (!definition) return;
      switch (definition.action) {
        case 'palette': {
          const open = useFinZenStore.getState().commandPaletteOpen;
          setCommandPaletteOpen(!open);
          break;
        }
        case 'help': {
          const open = useFinZenStore.getState().shortcutsDialogOpen;
          setShortcutsDialogOpen(!open);
          break;
        }
        case 'view': {
          if (viewIndex !== undefined && viewIndex < VIEW_KEYS.length) {
            navigate(VIEW_KEYS[viewIndex]);
          }
          break;
        }
        case 'newTransaction': {
          setAddSheetOpen(true);
          break;
        }
        case 'navigation':
        case 'tab':
        case 'close':
          // Comportamiento nativo de cmdk / Radix: no se intercepta.
          break;
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      // 1) ⌘K / Ctrl+K — paleta (toggle). No se ignora por el foco editable.
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        event.key.toLowerCase() === 'k'
      ) {
        if (hasBlockingModal()) return;
        event.preventDefault();
        runShortcut('palette');
        return;
      }

      // El resto se ignora con el foco en un campo editable o con un modal.
      if (isEditableTarget(event.target)) return;
      if (hasBlockingModal()) return;

      // 2) `?` — ayuda de atajos.
      if (
        event.key === '?' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        event.preventDefault();
        runShortcut('help');
        return;
      }

      // 3) Alt+1..7 — ir a la vista N (orden de VIEW_KEYS).
      if (event.altKey && !event.ctrlKey && !event.metaKey) {
        const index = digitIndex(event.code);
        if (index !== null) {
          if (index < VIEW_KEYS.length) {
            event.preventDefault();
            runShortcut('view', index);
          }
          return;
        }

        // 4) Alt+N — nueva transacción.
        if (event.code === 'KeyN') {
          event.preventDefault();
          runShortcut('newTransaction');
        }
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setCommandPaletteOpen, setShortcutsDialogOpen, setAddSheetOpen, navigate]);
}
