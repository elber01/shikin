'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useFinZenStore } from '@/store/finzen-store';
import { translations } from '@/lib/finzen/i18n';
import { VIEW_KEYS } from '@/lib/finzen/views';
import { SHORTCUTS, type ShortcutDefinition } from '@/lib/finzen/shortcuts';

/**
 * Diálogo de ayuda de atajos (convención 10-U2).
 *
 * La tabla de atajos sale de `src/lib/finzen/shortcuts.ts` — la MISMA
 * constante que consume el handler → no pueden divergir. Los símbolos de tecla
 * son literales; las descripciones viven en i18n (es + en).
 */
export function ShortcutsDialog() {
  const { shortcutsDialogOpen, setShortcutsDialogOpen, locale } = useFinZenStore();
  const t = translations[locale];

  const appShortcuts = SHORTCUTS.filter((s) => s.group === 'app');
  const keyboardShortcuts = SHORTCUTS.filter((s) => s.group === 'keyboard');

  /** Filas de un grupo: la acción "vista" se expande en una fila por vista. */
  function rowsOf(definition: ShortcutDefinition) {
    if (definition.action === 'view') {
      return VIEW_KEYS.map((view, index) => ({
        key: `${definition.action}-${view}`,
        keys: [`Alt+${index + 1}`],
        description: t[definition.descriptionKey].replace('{n}', String(index + 1)),
      }));
    }
    return [
      {
        key: definition.action,
        keys: definition.keys,
        description: t[definition.descriptionKey],
      },
    ];
  }

  function renderRows(definitions: readonly ShortcutDefinition[]) {
    return definitions.flatMap((definition) =>
      rowsOf(definition).map((row) => (
        <tr key={row.key} className="border-b border-border last:border-0">
          <td className="py-2 pr-4 align-top">
            <span className="flex flex-wrap gap-1">
              {row.keys.map((key) => (
                <kbd
                  key={key}
                  className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-xs font-mono text-foreground"
                >
                  {key}
                </kbd>
              ))}
            </span>
          </td>
          <td className="py-2 align-top text-muted-foreground">
            {row.description}
          </td>
        </tr>
      ))
    );
  }

  /** Cabecera de columnas (nombre accesible de cada columna). */
  function renderHead() {
    return (
      <thead>
        <tr className="border-b border-border [&>th]:py-2 [&>th]:text-left [&>th]:text-xs [&>th]:font-medium [&>th]:text-muted-foreground [&>th:first-child]:pr-4">
          <th scope="col">{t['shortcuts.column.keys']}</th>
          <th scope="col">{t['shortcuts.column.action']}</th>
        </tr>
      </thead>
    );
  }

  return (
    <Dialog open={shortcutsDialogOpen} onOpenChange={setShortcutsDialogOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t['shortcuts.title']}</DialogTitle>
          <DialogDescription>{t['shortcuts.description']}</DialogDescription>
        </DialogHeader>

        <table className="w-full text-sm">
          {renderHead()}
          <tbody>{renderRows(appShortcuts)}</tbody>
        </table>

        <p className="text-xs text-muted-foreground">{t['shortcuts.close']}</p>

        <h3 className="text-sm font-semibold">{t['shortcuts.navigation']}</h3>
        <table className="w-full text-sm">
          {renderHead()}
          <tbody>{renderRows(keyboardShortcuts)}</tbody>
        </table>

        <p className="text-xs text-muted-foreground">{t['shortcuts.inDialogs']}</p>
      </DialogContent>
    </Dialog>
  );
}
