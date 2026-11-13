'use client';

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Download, Plus, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { useFinZenStore } from '@/store/finzen-store';
import { translations } from '@/lib/finzen/i18n';
import { convertAmount, formatMoney, type CurrencyCode } from '@/lib/finzen/currency';
import { computeMonthlyFlows } from '@/lib/finzen/finance';
import {
  downloadTextFile,
  exportFilename,
  exportTransactionsCsv,
  exportTransactionsJson,
} from '@/lib/finzen/export';
import { intlLocale, localizedCategoryName } from '@/lib/finzen/localize';
import { categoryColorVar } from '@/lib/finzen/category-color';
import { StatCard } from '@/components/finzen/ui/stat-card';
import { StatGrid } from '@/components/finzen/ui/stat-grid';
import { EmptyState } from '@/components/finzen/ui/empty-state';
import { ProgressBar } from '@/components/finzen/ui/progress-bar';

type Range = '6m' | '1y' | 'all';

/** Clave de mes natural (YYYY-MM) de una fecha. */
function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function ReportsView() {
  const { transactions, categories, accounts, locale, baseCurrency, setAddSheetOpen } = useFinZenStore();
  const t = translations[locale];

  const [range, setRange] = useState<Range>('1y');

  // ── Una sola fuente de verdad: los flujos mensuales delimitan el rango y
  // alimentan a la vez el gráfico, los totales y la exportación. Antes el
  // gráfico medía 6 meses fijos mientras los totales seguían otro periodo.
  const flows = useMemo(() => {
    const now = new Date();
    const endYear = now.getFullYear();
    const endMonth = now.getMonth();
    let months = range === '6m' ? 6 : 12;
    if (range === 'all') {
      let oldestYear = endYear;
      let oldestMonth = endMonth;
      for (const tx of transactions) {
        const d = new Date(tx.occurredOn);
        if (
          d.getFullYear() < oldestYear ||
          (d.getFullYear() === oldestYear && d.getMonth() < oldestMonth)
        ) {
          oldestYear = d.getFullYear();
          oldestMonth = d.getMonth();
        }
      }
      months = (endYear - oldestYear) * 12 + (endMonth - oldestMonth) + 1;
    }
    return computeMonthlyFlows(
      transactions,
      baseCurrency as CurrencyCode,
      Math.max(1, months),
      endYear,
      endMonth
    );
  }, [transactions, baseCurrency, range]);

  const rangeKeys = useMemo(() => new Set(flows.map((f) => f.key)), [flows]);

  const filteredTx = useMemo(
    () => transactions.filter((tx) => rangeKeys.has(monthKey(new Date(tx.occurredOn)))),
    [transactions, rangeKeys]
  );

  const totals = useMemo(() => {
    const income = flows.reduce((s, f) => s + f.income, 0);
    const expenses = flows.reduce((s, f) => s + f.expenses, 0);
    const savings = income - expenses;
    return {
      income,
      expenses,
      savings,
      ratio: income > 0 ? (savings / income) * 100 : 0,
    };
  }, [flows]);

  const topCategories = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of filteredTx) {
      if (tx.type !== 'expense' || !tx.categoryId) continue;
      const v = convertAmount(tx.amount, tx.currency, baseCurrency as CurrencyCode);
      map.set(tx.categoryId, (map.get(tx.categoryId) ?? 0) + v);
    }
    return Array.from(map.entries())
      .map(([id, amount]) => {
        const cat = categories.find((c) => c.id === id);
        return {
          name: cat ? localizedCategoryName(cat, locale) : t['common.other'],
          icon: cat?.icon ?? '📦',
          color: categoryColorVar(cat?.color),
          amount,
          pct: totals.expenses > 0 ? (amount / totals.expenses) * 100 : 0,
        };
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [filteredTx, categories, baseCurrency, locale, totals, t]);

  const chartData = useMemo(() => {
    const intl = intlLocale(locale);
    return flows.map((f) => ({
      month: new Intl.DateTimeFormat(intl, { month: 'short' }).format(new Date(f.year, f.month, 1)),
      income: f.income,
      expenses: f.expenses,
    }));
  }, [flows, locale]);

  function exportRange(format: 'csv' | 'json') {
    if (filteredTx.length === 0) {
      toast.error(t['transactions.noTransactionsToExport']);
      return;
    }
    const ctx = { categories, accounts, locale, baseCurrency: baseCurrency as CurrencyCode };
    const content =
      format === 'json'
        ? exportTransactionsJson(filteredTx, ctx, {
            exportedAt: new Date().toISOString(),
            range,
          })
        : exportTransactionsCsv(filteredTx, ctx);
    downloadTextFile(
      exportFilename('finzen-reports', format),
      content,
      format === 'json' ? 'application/json' : 'text/csv'
    );
    toast.success(t['common.exported'].replace('{format}', format.toUpperCase()));
  }

  // Empty state — usuario sin transacciones (tras TODOS los hooks, nunca antes)
  if (transactions.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl sm:text-2xl font-bold">{t['reports.title']}</h1>
        <EmptyState
          className="shadow-card"
          icon={
            <div className="w-14 h-14 rounded-2xl bg-surface-2 flex items-center justify-center mx-auto mb-3">
              <BarChart3 className="w-7 h-7 text-muted-foreground" />
            </div>
          }
          title={t['reports.emptyTitle']}
          description={t['reports.emptyHint']}
          action={{
            label: t['reports.emptyCta'],
            onClick: () => setAddSheetOpen(true),
            icon: <Plus className="w-4 h-4 mr-1" />,
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl sm:text-2xl font-bold">{t['reports.title']}</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border overflow-hidden">
            {(['6m', '1y', 'all'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 h-9 text-xs font-medium transition-colors ${
                  range === r ? 'bg-primary text-primary-foreground' : 'hover:bg-surface-2'
                }`}
              >
                {r === '6m' ? '6M' : r === '1y' ? '1Y' : t['reports.rangeAll']}
              </button>
            ))}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-11 min-h-11" aria-label={t['reports.exportMenu']}>
                <Download className="w-4 h-4 mr-1.5" />
                {t['reports.export']}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportRange('csv')}>
                {t['common.exportCsv']}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportRange('json')}>
                {t['common.exportJson']}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Totals */}
      <StatGrid scale="md">
        <StatCard
          label={t['reports.totalIncome']}
          value={formatMoney(totals.income, baseCurrency as CurrencyCode, locale)}
          tone="income"
          labelClassName="uppercase tracking-wide"
          valueClassName="mt-1"
        />
        <StatCard
          label={t['reports.totalExpenses']}
          value={formatMoney(totals.expenses, baseCurrency as CurrencyCode, locale)}
          tone="expense"
          labelClassName="uppercase tracking-wide"
          valueClassName="mt-1"
        />
        <StatCard
          label={t['reports.netSavings']}
          value={formatMoney(totals.savings, baseCurrency as CurrencyCode, locale)}
          tone={totals.savings < 0 ? 'expense' : 'default'}
          labelClassName="uppercase tracking-wide"
          valueClassName="mt-1"
          hint={`${totals.ratio.toFixed(1)}%`}
        />
      </StatGrid>

      {/* Income vs Expenses chart */}
      <Card className="p-5">
        <h2 className="text-lg font-semibold mb-4">{t['reports.incomeVsExpenses']}</h2>
        <div className="h-60 sm:h-72 w-full overflow-x-auto scroll-area">
          <div className="h-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                axisLine={false}
                tickLine={false}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={50}
              />
              <YAxis
                tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                axisLine={false}
                tickLine={false}
                width={50}
                tickFormatter={(v: number) => formatMoney(v, baseCurrency as CurrencyCode, locale, { compact: true })}
              />
              <Tooltip
                cursor={{ fill: 'var(--surface-2)' }}
                contentStyle={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number) => formatMoney(v, baseCurrency as CurrencyCode, locale)}
              />
              <Bar dataKey="income" fill="var(--income)" radius={[4, 4, 0, 0]} maxBarSize={36} />
              <Bar dataKey="expenses" fill="var(--expense)" radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>
        <div className="flex gap-4 mt-2 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ background: 'var(--income)' }} />
            {t['dashboard.income']}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ background: 'var(--expense)' }} />
            {t['dashboard.expenses']}
          </span>
        </div>
      </Card>

      {/* Top categories */}
      <Card className="p-5">
        <h2 className="text-lg font-semibold mb-4">{t['reports.topCategories']}</h2>
        <div className="space-y-3">
          {topCategories.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">{t['reports.noExpenses']}</p>
          )}
          {topCategories.map((cat, i) => (
            <div key={cat.name} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}.</span>
                  <span>{cat.icon}</span>
                  <span className="font-medium">{cat.name}</span>
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {formatMoney(cat.amount, baseCurrency as CurrencyCode, locale)} · {cat.pct.toFixed(0)}%
                </span>
              </div>
              <ProgressBar value={cat.pct} tone={cat.color} animated={false} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
