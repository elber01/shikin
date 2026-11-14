import type { TranslationKey } from './i18n';

/**
 * Tabla ÚNICA de atajos (convención 10-U2).
 *
 * La consumen el handler (`src/hooks/use-global-shortcuts.ts`) y el diálogo de
 * ayuda (`src/components/finzen/shortcuts-dialog.tsx`) → no pueden divergir:
 * si se añade una acción nueva, el `switch` exhaustivo del handler deja de
 * compilar y el diálogo la muestra automáticamente.
 *
 * Los SÍMBOLOS de tecla son literales (como `CSV`/`JSON`); las DESCRIPCIONES
 * viven en i18n (es + en).
 */

/** Acción que dispara un atajo. */
export type ShortcutAction =
  /** `⌘K` / `Ctrl+K` — command palette. */
  | 'palette'
  /** `?` — diálogo de ayuda. */
  | 'help'
  /** `Alt+1..7` — ir a la vista N. */
  | 'view'
  /** `Alt+N` — nueva transacción. */
  | 'newTransaction'
  /** `↑` / `↓` — mover la selección (nativo de cmdk). */
  | 'navigation'
  /** `Tab` — mover el foco (nativo del navegador/Radix). */
  | 'tab'
  /** `Esc` — cerrar (nativo de Radix). */
  | 'close';

/** Grupo en la tabla de ayuda. */
export type ShortcutGroup = 'app' | 'keyboard';

export interface ShortcutDefinition {
  /** Símbolos de tecla que se muestran en la ayuda. */
  keys: readonly string[];
  /** Descripción (clave i18n). */
  descriptionKey: TranslationKey;
  /** Acción que ejecuta el handler. */
  action: ShortcutAction;
  /** Grupo de la tabla de ayuda. */
  group: ShortcutGroup;
}

/** Definición de un atajo. */
export const SHORTCUTS: readonly ShortcutDefinition[] = [
  {
    keys: ['⌘K', 'Ctrl+K'],
    descriptionKey: 'shortcuts.palette',
    action: 'palette',
    group: 'app',
  },
  {
    keys: ['?'],
    descriptionKey: 'shortcuts.help',
    action: 'help',
    group: 'app',
  },
  {
    keys: ['Alt+1', 'Alt+2', 'Alt+3', 'Alt+4', 'Alt+5', 'Alt+6', 'Alt+7'],
    descriptionKey: 'shortcuts.goToView',
    action: 'view',
    group: 'app',
  },
  {
    keys: ['Alt+N'],
    descriptionKey: 'shortcuts.newTransaction',
    action: 'newTransaction',
    group: 'app',
  },
  {
    keys: ['↑', '↓'],
    descriptionKey: 'shortcuts.arrowKeys',
    action: 'navigation',
    group: 'keyboard',
  },
  {
    keys: ['Tab'],
    descriptionKey: 'shortcuts.tab',
    action: 'tab',
    group: 'keyboard',
  },
  {
    keys: ['Esc'],
    descriptionKey: 'shortcuts.escape',
    action: 'close',
    group: 'keyboard',
  },
];

/** Definición de un atajo por su acción (para el handler). */
export function shortcutFor(action: ShortcutAction): ShortcutDefinition | undefined {
  return SHORTCUTS.find((s) => s.action === action);
}
