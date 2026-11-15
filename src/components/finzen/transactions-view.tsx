'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Download, Filter, Receipt, Plus } from 'lucide-react';
import { useFinZenStore } from '@/store/finzen-store';
import { translations } from '@/lib/finzen/i18n';
import { toast } from 'sonner';
import {
  convertAmount,
  formatMoney,
  type CurrencyCode,
} from '@/lib/finzen/currency';
import {
  downloadTransactions,
} from '@/lib/finzen/export';
import { intlLocale, localizedCategoryName } from '@/lib/finzen/localize';
import { toLocalDateString } from '@/lib/finzen/date-utils';
import {
  applyTransactionFilters,
  hasActiveFilters,
  presetToRange,
  resolveDatePreset,
  resolveFilterActivation,
  resolveSelectFilterValue,
  type DateFilterPreset,
  type TransactionFilters,
  type TransactionTypeFilter,
} from '@/lib/finzen/transaction-filters';
import { useTransactionFilters } from '@/hooks/use-transaction-filters';
import { TransactionRow } from '@/components/finzen/transaction-row';
import { StatCard } from '@/components/finzen/ui/stat-card';
import { StatGrid } from '@/components/finzen/ui/stat-grid';
import { EmptyState } from '@/components/finzen/ui/empty-state';

/** Espera antes de escribir el texto de búsqueda en la URL. */
const SEARCH_DEBOUNCE_MS = 300;

export function TransactionsView() {
  const { transactions, categories, accounts, locale, baseCurrency, loading, setAddSheetOpen, setEditingTransactionId } = useFinZenStore();
  const t = translations[locale];

  // ── Los filtros viven en la URL (convención 10-U4): no hay estado de
  //    filtros en el store ni en el componente.
  const { filters, applyFilters, clearFilters } = useTransactionFilters();

  function handleEditTx(id: string) {
    setEditingTransactionId(id);
    setAddSheetOpen(true);
  }

  // ── Periodo DERIVADO de `from`/`to` (la URL es la fuente de verdad).
  const now = new Date();
  const datePreset = resolveDatePreset(filters, now);

  // ── Filtros colgantes: apuntan a una categoría/cuenta que ya no existe →
  //    se tratan como INACTIVOS (no se aplican) y se conservan en la URL.
  //    MIENTRAS CARGA no se puede saber si el id existe: no se avisa y el
  //    filtro se aplica con normalidad (si no, un deep-link válido se
  //    descartaría al vuelo y saltaría un aviso falso).
  const {
    categoryActive: categoryIsActive,
    accountActive: accountIsActive,
    categoryExists,
    accountExists,
    hasDanglingFilter,
  } = resolveFilterActivation(filters, { categories, accounts, loading });

  // ── El `value` del Select SIEMPRE es un ítem existente de la lista (Radix):
  //    · MIENTRAS CARGA → el id de la URL (el catálogo aún no está, pero el
  //      filtro SÍ se aplica: el desplegable no puede afirmar "todas").
  //    · TRAS CARGAR → el id si existe; si no, "todas" (el filtro queda
  //      INACTIVO → el desplegable debe decirlo).
  const categorySelectValue = resolveSelectFilterValue(
    filters.categoryId,
    categoryExists,
    loading
  );
  const accountSelectValue = resolveSelectFilterValue(
    filters.accountId,
    accountExists,
    loading
  );
  // Ítem PENDIENTE: durante la carga el catálogo está vacío, así que el id de
  // la URL no tiene ítem propio → se añade uno (Radix exige que el valor
  // exista en la lista) que anuncia que el catálogo se está cargando.
  const pendingCategoryId =
    loading && filters.categoryId !== null && !categoryExists ? filters.categoryId : null;
  const pendingAccountId =
    loading && filters.accountId !== null && !accountExists ? filters.accountId : null;

  // ── Buffer local del input de búsqueda (el valor que FILTRA es el de la URL).
  //    El buffer se re-sincroniza cuando cambia el `q` de la URL (back/forward).
  const [search, setSearch] = useState(filters.query);
  const [syncedQuery, setSyncedQuery] = useState(filters.query);
  if (filters.query !== syncedQuery) {
    setSyncedQuery(filters.query);
    setSearch(filters.query);
  }

  useEffect(() => {
    if (search === filters.query) return;
    const timer = setTimeout(() => {
      applyFilters({ ...filters, query: search });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search, filters, applyFilters]);

  const filtered = useMemo(() => {
    // Los filtros vienen de la URL (fuente de verdad): en CARGA FRÍA
    // (`/?view=transactions&category=...&from=...`) ya se aplican en el
    // primer render — no hay estado local que inicializar.
    return applyTransactionFilters(transactions, filters, {
      categoryActive: categoryIsActive,
      accountActive: accountIsActive,
    });
  }, [transactions, filters, categoryIsActive, accountIsActive]);

  // Group by day
  const grouped = useMemo(() => {
    const groups: { label: string; items: typeof filtered }[] = [];
    let currentLabel = '';
    for (const tx of filtered) {
      const d = new Date(tx.occurredOn);
      const today = new Date();
      const isToday = d.toDateString() === today.toDateString();
      const isYesterday =
        d.toDateString() === new Date(today.getTime() - 86400000).toDateString();
      const label = isToday
        ? t['transactions.today']
        : isYesterday
        ? t['transactions.yesterday']
        : d.toLocaleDateString(intlLocale(locale), {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          });
      if (label !== currentLabel) {
        groups.push({ label, items: [] });
        currentLabel = label;
      }
      groups[groups.length - 1].items.push(tx);
    }
    return groups;
  }, [filtered, t, locale]);

  // Totals
  const totals = useMemo(() => {
    let income = 0;
    let expenses = 0;
    for (const tx of filtered) {
      const v = convertAmount(tx.amount, tx.currency, baseCurrency as CurrencyCode);
      if (tx.type === 'income') income += v;
      else if (tx.type === 'expense') expenses += v;
    }
    return { income, expenses, count: filtered.length };
  }, [filtered, baseCurrency]);

  /** Escribe un cambio de filtro en la URL (sin tocar el resto). */
  function patchFilters(patch: Partial<TransactionFilters>) {
    applyFilters({ ...filters, ...patch });
  }

  /** Cambia el periodo a un preset (o a un rango personalizado). */
  function handlePeriodChange(value: string) {
    const preset = value as DateFilterPreset;
    if (preset === 'custom') {
      // Rango personalizado: hoy→hoy (luego el usuario ajusta los campos).
      const today = toLocalDateString(now);
      patchFilters({ from: today, to: today });
      return;
    }
    const range = presetToRange(preset, now);
    patchFilters({ from: range.from, to: range.to });
  }

  function exportFiltered(format: 'csv' | 'json') {
    if (filtered.length === 0) { toast.error(t['transactions.noTransactionsToExport']); return; }
    const ctx = { categories, accounts, locale, baseCurrency: baseCurrency as CurrencyCode };
    downloadTransactions({
      rows: filtered,
      ctx,
      format,
      prefix: 'finzen-filtered',
      envelope: {
        exportedAt: new Date().toISOString(),
        // Envelope ADITIVO: conserva dateFilter/categoryFilter/search y añade
        // accountFilter/type/from/to (convención 10-U4).
        filterApplied: {
          dateFilter: datePreset,
          categoryFilter: filters.categoryId ?? 'all',
          search: filters.query,
          accountFilter: filters.accountId ?? 'all',
          type: filters.type ?? 'all',
          from: filters.from,
          to: filters.to,
        },
      },
    });
    toast.success(
      t['transactions.exportedCount']
        .replace('{n}', String(filtered.length))
        .replace('{format}', format.toUpperCase())
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl sm:text-2xl font-bold">{t['transactions.title']}</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-11 min-h-11" onClick={() => exportFiltered('csv')}>
            <Download className="w-4 h-4 mr-1.5" />
            CSV
          </Button>
          <Button variant="outline" size="sm" className="h-11 min-h-11" onClick={() => exportFiltered('json')}>
            <Download className="w-4 h-4 mr-1.5" />
            JSON
          </Button>
        </div>
      </div>

      {/* Totals — [responsive] 3-col desde md (768px): con la escalera terminando en text-xl,
          el peor monto realista (17 chars ≈ 183px) cabe en ~208px útiles; de 640-767px apiladas
          con text-lg. break-words = última línea de defensa: el dinero se envuelve, jamás se trunca. */}
      <StatGrid scale="sm" className="gap-3">
        <StatCard
          className="p-3"
          label={t['dashboard.income']}
          value={formatMoney(totals.income, baseCurrency as CurrencyCode, locale)}
          tone="income"
          scale="sm"
        />
        <StatCard
          className="p-3"
          label={t['dashboard.expenses']}
          value={formatMoney(totals.expenses, baseCurrency as CurrencyCode, locale)}
          tone="expense"
          scale="sm"
        />
        <StatCard className="p-3" label="#" value={String(totals.count)} scale="sm" />
      </StatGrid>

      {/* Filtro colgante — la categoría/cuenta ya no existe: se avisa y se ofrece quitarla */}
      {hasDanglingFilter && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-xs text-foreground"
        >
          <span>{t['transactions.danglingFilter']}</span>
          <Button
            variant="outline"
            size="sm"
            className="h-9 min-h-9 text-xs"
            onClick={clearFilters}
          >
            {t['transactions.removeFilters']}
          </Button>
        </div>
      )}

      {/* Filters — todos escriben en la URL (fuente de verdad) */}
      <Card className="p-3 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t['transactions.search']}
            aria-label={t['transactions.search']}
            className="pl-9 h-10"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 *:min-w-0">
          <Select value={datePreset} onValueChange={handlePeriodChange}>
            <SelectTrigger className="h-9 text-xs w-full" aria-label={t['transactions.filterPeriod']}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this_month">{t['transactions.thisMonth']}</SelectItem>
              <SelectItem value="last_month">{t['transactions.lastMonth']}</SelectItem>
              <SelectItem value="this_quarter">{t['transactions.thisQuarter']}</SelectItem>
              <SelectItem value="this_year">{t['transactions.thisYear']}</SelectItem>
              <SelectItem value="last_year">{t['transactions.lastYear']}</SelectItem>
              <SelectItem value="all">{t['common.all']}</SelectItem>
              <SelectItem value="custom">{t['transactions.customRange']}</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.type ?? 'all'}
            onValueChange={(v) =>
              patchFilters({ type: v === 'all' ? null : (v as TransactionTypeFilter) })
            }
          >
            <SelectTrigger className="h-9 text-xs w-full" aria-label={t['transactions.filterType']}>
              <SelectValue placeholder={t['transactions.allTypes']} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t['transactions.allTypes']}</SelectItem>
              <SelectItem value="income">{t['transactions.typeIncome']}</SelectItem>
              <SelectItem value="expense">{t['transactions.typeExpense']}</SelectItem>
              <SelectItem value="transfer">{t['transactions.typeTransfer']}</SelectItem>
              <SelectItem value="adjustment">{t['transactions.typeAdjustment']}</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={categorySelectValue}
            onValueChange={(v) => patchFilters({ categoryId: v === 'all' ? null : v })}
          >
            {/* Nombre accesible GENÉRICO: el valor seleccionado se anuncia
                aparte (un `aria-label` con "Todas las categorías" pisaba el
                valor real). */}
            <SelectTrigger className="h-9 text-xs w-full" aria-label={t['transactions.filterCategory']}>
              <Filter className="w-3 h-3 mr-1" />
              <SelectValue placeholder={t['transactions.allCategories']} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t['transactions.allCategories']}</SelectItem>
              {pendingCategoryId && (
                <SelectItem value={pendingCategoryId} disabled>
                  {t['a11y.loadingPanel']}
                </SelectItem>
              )}
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.icon} {localizedCategoryName(c, locale)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={accountSelectValue}
            onValueChange={(v) => patchFilters({ accountId: v === 'all' ? null : v })}
          >
            {/* Nombre accesible GENÉRICO (no pisa el valor seleccionado). */}
            <SelectTrigger className="h-9 text-xs w-full" aria-label={t['transactions.filterAccount']}>
              <SelectValue placeholder={t['transactions.allAccounts']} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t['transactions.allAccounts']}</SelectItem>
              {pendingAccountId && (
                <SelectItem value={pendingAccountId} disabled>
                  {t['a11y.loadingPanel']}
                </SelectItem>
              )}
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {datePreset === 'custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 *:min-w-0">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">{t['transactions.from']}</span>
              <Input
                type="date"
                value={filters.from ?? ''}
                onChange={(e) => patchFilters({ from: e.target.value || null })}
                className="h-9 text-xs"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">{t['transactions.to']}</span>
              <Input
                type="date"
                value={filters.to ?? ''}
                onChange={(e) => patchFilters({ to: e.target.value || null })}
                className="h-9 text-xs"
              />
            </label>
          </div>
        )}
      </Card>

      {/* List */}
      <Card className="p-2">
        {grouped.length === 0 ? (
          transactions.length === 0 ? (
            <EmptyState
              surface="plain"
              className="py-12 text-center"
              icon={
                <div className="w-14 h-14 rounded-2xl bg-surface-2 flex items-center justify-center mx-auto mb-3">
                  <Receipt className="w-7 h-7 text-muted-foreground" />
                </div>
              }
              title={t['transactions.noTransactions']}
              description={t['transactions.emptyHint']}
              action={{
                label: t['transactions.emptyCta'],
                onClick: () => setAddSheetOpen(true),
                icon: <Plus className="w-4 h-4 mr-1" />,
              }}
            />
          ) : hasActiveFilters(filters) ? (
            <EmptyState
              surface="plain"
              className="text-center text-sm text-muted-foreground py-12"
              titleAs="p"
              titleClassName="text-sm font-normal text-muted-foreground mb-0"
              title={t['transactions.noResultsForFilters']}
            />
          ) : (
            <EmptyState
              surface="plain"
              className="text-center text-sm text-muted-foreground py-12"
              titleAs="p"
              titleClassName="text-sm font-normal text-muted-foreground mb-0"
              title={t['transactions.noTransactions']}
            />
          )
        ) : (
          <div className="space-y-3">
            {grouped.map((group) => (
              <div key={group.label}>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-3 py-1.5">
                  {group.label}
                </div>
                <div className="space-y-0.5">
                  {group.items.map((tx) => (
                    <TransactionRow
                      key={tx.id}
                      tx={tx}
                      onEdit={handleEditTx}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="text-xs text-center text-muted-foreground">
        {t['transactions.showing']} {filtered.length} {t['transactions.of']} {transactions.length}
      </div>
    </div>
  );
}
