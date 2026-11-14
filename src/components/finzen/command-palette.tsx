'use client';

import { useMemo, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  FileText,
  Database,
  Keyboard,
  Languages,
  Plus,
  Search,
  SunMoon,
} from 'lucide-react';
import { useFinZenStore } from '@/store/finzen-store';
import { translations } from '@/lib/finzen/i18n';
import { otherLocale, localizedCategoryName } from '@/lib/finzen/localize';
import { formatMoney, type CurrencyCode } from '@/lib/finzen/currency';
import { downloadTransactions } from '@/lib/finzen/export';
import { VIEW_KEYS } from '@/lib/finzen/views';
import { VIEW_REGISTRY } from './view-registry';
import { useViewNavigation } from '@/hooks/use-view-navigation';

/** Tope de transacciones listadas en la paleta. */
const MAX_TRANSACTIONS = 25;

/** Selector del botón trigger de la paleta (sidebar / top bar móvil). */
const TRIGGER_SELECTOR = '[data-command-trigger]';

/** Primer trigger visible en el DOM (el que corresponde al viewport actual). */
function findVisibleTrigger(): HTMLElement | null {
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>(TRIGGER_SELECTOR)
  );
  return nodes.find((node) => node.offsetParent !== null) ?? null;
}

/**
 * Command palette (convención 10-U2).
 *
 * - Compone `ui/dialog` + `ui/command` (sin `CommandDialog`: trae strings en
 *   inglés hardcodeadas).
 * - Toda string visible vive en i18n (es + en), incluidos los `aria-label`.
 * - La acción que abre otro overlay (hoja de transacción / diálogo de atajos)
 *   se ejecuta en `onCloseAutoFocus`, DESPUÉS del desmontaje del diálogo →
 *   nunca hay dos modales solapados.
 */
export function CommandPalette() {
  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    setShortcutsDialogOpen,
    setAddSheetOpen,
    setEditingTransactionId,
    transactions,
    categories,
    accounts,
    locale,
    baseCurrency,
  } = useFinZenStore();
  const t = translations[locale];
  const { theme, setTheme } = useTheme();
  const navigate = useViewNavigation();
  const [query, setQuery] = useState('');
  /** Acción que se ejecuta al cerrar el diálogo (overlay pendiente). */
  const pendingActionRef = useRef<(() => void) | null>(null);

  /**
   * Transacciones que casan con la búsqueda (≥ 2 caracteres), ordenadas por
   * fecha descendente y limitadas a 25. No depende de `new Date()`: el orden
   * usa el string `occurredOn`.
   */
  const transactionMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const accountNames = new Map(accounts.map((a) => [a.id, a.name]));
    // La plantilla del meta tiene dos marcadores: {date} y {amount}. Se separa
    // para poder renderizar el importe con `tabular-nums`.
    const [metaBefore = '', metaAfter = ''] = t['palette.transactionMeta'].split('{amount}');
    return transactions
      .map((tx) => {
        const categoryName = tx.category
          ? localizedCategoryName(tx.category, locale)
          : '';
        const accountName =
          accountNames.get(tx.fromAccountId) ??
          accountNames.get(tx.toAccountId) ??
          '';
        const label =
          tx.description?.trim() || categoryName || accountName || tx.id;
        const haystack = `${tx.description ?? ''} ${categoryName} ${accountName}`.toLowerCase();
        return {
          tx,
          label,
          categoryName,
          accountName,
          haystack,
          amountText: formatMoney(tx.amount, tx.currency, locale),
          metaBefore: metaBefore.replace('{date}', tx.occurredOn.slice(0, 10)),
          metaAfter: metaAfter.replace('{date}', tx.occurredOn.slice(0, 10)),        };
      })
      .filter((item) => item.haystack.includes(q))
      .sort((a, b) =>
        a.tx.occurredOn < b.tx.occurredOn
          ? 1
          : a.tx.occurredOn > b.tx.occurredOn
          ? -1
          : 0
      )
      .slice(0, MAX_TRANSACTIONS);
  }, [transactions, accounts, locale, query, t]);

  function closePalette() {
    setCommandPaletteOpen(false);
  }

  /** Al cerrar, la búsqueda vuelve a estar vacía para la próxima apertura. */
  function handleOpenChange(open: boolean) {
    setCommandPaletteOpen(open);
    if (!open) setQuery('');
  }

  /** Export completo (mismo formato y nombre que Ajustes / Importar). */
  function exportAll(format: 'csv' | 'json') {
    if (transactions.length === 0) {
      toast.error(t['common.noData']);
      return;
    }
    const ctx = {
      categories,
      accounts,
      locale,
      baseCurrency: baseCurrency as CurrencyCode,
    };
    downloadTransactions({
      rows: transactions,
      ctx,
      format,
      prefix: 'finzen-export',
      envelope: {
        exportedAt: new Date().toISOString(),
        accounts,
      },
    });
    toast.success(t['common.exported'].replace('{format}', format.toUpperCase()));
  }

  function handleCloseAutoFocus(event: Event) {
    const pending = pendingActionRef.current;
    pendingActionRef.current = null;
    if (pending) {
      // El overlay pendiente gestiona su propio foco.
      event.preventDefault();
      pending();
      return;
    }
    const trigger = findVisibleTrigger();
    if (trigger) {
      event.preventDefault();
      trigger.focus();
    }
  }

  return (
    <Dialog open={commandPaletteOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className="overflow-hidden p-0"
        data-command-palette=""
        onCloseAutoFocus={handleCloseAutoFocus}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{t['palette.title']}</DialogTitle>
          <DialogDescription>{t['palette.description']}</DialogDescription>
        </DialogHeader>
        <Command
          label={t['palette.inputLabel']}
          className="[&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
        >
          <CommandInput
            placeholder={t['palette.placeholder']}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList label={t['palette.listLabel']}>
            <CommandEmpty>{t['palette.empty']}</CommandEmpty>

            {/* Navegación */}
            <CommandGroup heading={t['palette.group.navigation']}>
              {VIEW_KEYS.map((view) => {
                const meta = VIEW_REGISTRY[view];
                const Icon = meta.icon;
                return (
                  <CommandItem
                    key={view}
                    value={t[meta.labelKey]}
                    keywords={[view, ...(meta.paletteKeywords ?? [])]}
                    onSelect={() => {
                      navigate(view);
                      closePalette();
                    }}
                  >
                    <Icon />
                    <span>
                      {t['palette.navigateTo'].replace(
                        '{name}',
                        t[meta.labelKey]
                      )}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>

            {/* Acciones */}
            <CommandGroup heading={t['palette.group.actions']}>
              <CommandItem
                value={t['palette.action.newTransaction']}
                keywords={['new', 'transaction', 'add']}
                onSelect={() => {
                  pendingActionRef.current = () => setAddSheetOpen(true);
                  closePalette();
                }}
              >
                <Plus />
                <span>{t['palette.action.newTransaction']}</span>
              </CommandItem>
              <CommandItem
                value={t['palette.action.exportCsv']}
                keywords={['export', 'csv']}
                onSelect={() => {
                  exportAll('csv');
                  closePalette();
                }}
              >
                <FileText />
                <span>{t['palette.action.exportCsv']}</span>
              </CommandItem>
              <CommandItem
                value={t['palette.action.exportJson']}
                keywords={['export', 'json', 'backup']}
                onSelect={() => {
                  exportAll('json');
                  closePalette();
                }}
              >
                <Database />
                <span>{t['palette.action.exportJson']}</span>
              </CommandItem>
              <CommandItem
                value={t['palette.action.shortcuts']}
                keywords={['shortcuts', 'keyboard', 'help']}
                onSelect={() => {
                  pendingActionRef.current = () => setShortcutsDialogOpen(true);
                  closePalette();
                }}
              >
                <Keyboard />
                <span>{t['palette.action.shortcuts']}</span>
              </CommandItem>
            </CommandGroup>

            {/* Apariencia */}
            <CommandGroup heading={t['palette.group.appearance']}>
              <CommandItem
                value={t['palette.action.toggleTheme']}
                keywords={['theme', 'dark', 'light']}
                onSelect={() => {
                  setTheme(theme === 'dark' ? 'light' : 'dark');
                  closePalette();
                }}
              >
                <SunMoon />
                <span>{t['palette.action.toggleTheme']}</span>
              </CommandItem>
              <CommandItem
                value={t['palette.action.switchLanguage']}
                keywords={['language', 'locale', 'es', 'en']}
                onSelect={() => {
                  useFinZenStore.getState().setLocale(otherLocale(locale));
                  closePalette();
                }}
              >
                <Languages />
                <span>{t['palette.action.switchLanguage']}</span>
              </CommandItem>
            </CommandGroup>

            {/* Transacciones (solo con ≥ 2 caracteres de búsqueda) */}
            {transactionMatches.length > 0 && (
              <CommandGroup heading={t['palette.group.transactions']}>
                {transactionMatches.map(
                  ({ tx, label, categoryName, accountName, amountText, metaBefore, metaAfter }) => (
                    <CommandItem
                      key={tx.id}
                      value={`${label} ${categoryName} ${accountName}`}
                      keywords={[tx.id, tx.occurredOn]}
                      onSelect={() => {
                        pendingActionRef.current = () => {
                          setEditingTransactionId(tx.id);
                          setAddSheetOpen(true);
                        };
                        closePalette();
                      }}
                    >
                      <Search />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{label}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {metaBefore}
                          <span className="tabular-nums">{amountText}</span>
                          {metaAfter}
                        </span>
                      </span>
                    </CommandItem>
                  )
                )}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
