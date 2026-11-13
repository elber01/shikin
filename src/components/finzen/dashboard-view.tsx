'use client';

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Lightbulb, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useFinZenStore } from '@/store/finzen-store';
import { translations } from '@/lib/finzen/i18n';
import {
  convertAmount,
  formatMoney,
  type CurrencyCode,
} from '@/lib/finzen/currency';
import {
  computeNetWorth,
  computeMonthlyFlows,
  computeNetWorthHistory,
  computeDelta,
  type MonthlyFlow,
} from '@/lib/finzen/finance';
import { intlLocale, localizedCategoryName, localizedPair } from '@/lib/finzen/localize';
import { categoryColorVar } from '@/lib/finzen/category-color';
import { KpiCard } from '@/components/finzen/kpi-card';
import { StatGrid } from '@/components/finzen/ui/stat-grid';
import { EmptyState } from '@/components/finzen/ui/empty-state';
import { TransactionRow } from '@/components/finzen/transaction-row';
import { useAlerts } from '@/hooks/use-alerts';
import { useIsMobile } from '@/hooks/use-is-mobile';

/**
 * Token del icono de alerta por severidad.
 *
 * El fondo translúcido usa `color-mix(in oklab, currentColor N%, transparent)`:
 * un sufijo alpha pegado a una `var()` (`var(--expense)20`) NO es CSS válido —
 * el navegador lo descarta y el fondo nunca se pintaba. `currentColor` resuelve
 * al `color` del propio elemento (el token de la severidad), así que el fondo
 * es siempre una mezcla del mismo color, sin repetir tokens ni usar HEX.
 */
const ALERT_ICON_COLOR = {
  critical: 'var(--expense)',
  warning: 'var(--warning)',
  info: 'var(--info)',
} as const;

/** 12% ≈ el 0x20 (alpha 32/255) que se intentaba con el sufijo inválido. */
const ALERT_ICON_BG = 'color-mix(in oklab, currentColor 12%, transparent)';

export function DashboardView() {
  const { transactions, accounts, categories, locale, baseCurrency, setActiveView, setAddSheetOpen, setEditingTransactionId, loading } =
    useFinZenStore();
  const t = translations[locale];
  const alerts = useAlerts();
  const isMobile = useIsMobile();

  function handleEditTx(id: string) {
    setEditingTransactionId(id);
    setAddSheetOpen(true);
  }

  // Dashboard month selector — allows viewing any month
  const [selectedMonth, setSelectedMonth] = useState<string>(''); // YYYY-MM, empty = current month
  const viewDate = selectedMonth
    ? new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]) - 1, 1)
    : new Date();
  // Primitivos derivados — deps estables para los memos de abajo
  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return t['dashboard.greeting.morning'];
    if (h < 18) return t['dashboard.greeting.afternoon'];
    return t['dashboard.greeting.evening'];
  }, [t]);

  // ── KPIs del mes seleccionado (en moneda base) + mes anterior para deltas reales
  const { totals, prevTotals } = useMemo(() => {
    // computeMonthlyFlows es la única fuente de verdad de los flujos por mes.
    const current = computeMonthlyFlows(transactions, baseCurrency, 1, viewYear, viewMonth)[0];
    const previous = computeMonthlyFlows(transactions, baseCurrency, 2, viewYear, viewMonth - 1)[0];
    const toTotals = (flow: MonthlyFlow) => {
      const savings = flow.income - flow.expenses;
      return {
        income: flow.income,
        expenses: flow.expenses,
        savings,
        ratio: flow.income > 0 ? (savings / flow.income) * 100 : 0,
      };
    };
    return { totals: toTotals(current), prevTotals: toTotals(previous) };
  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- viewDate deriva de new Date() (impuro), el compiler no puede preservar
  }, [transactions, viewYear, viewMonth, baseCurrency]);

  // Net worth = sum of all account balances (converted to base currency)
  const netWorth = useMemo(
    () => computeNetWorth(accounts, baseCurrency as CurrencyCode),
    [accounts, baseCurrency]
  );

  // ── Historia REAL del net worth (12 meses): reconstruida hacia atrás desde el
  // valor actual restando los flujos netos de cada mes. Sin placeholders.
  // Siempre relativa al mes actual — el monto del hero es el net worth ACTUAL.
  const netWorthHistory = useMemo(() => {
    const now = new Date();
    const flows = computeMonthlyFlows(transactions, baseCurrency, 12, now.getFullYear(), now.getMonth());
    return computeNetWorthHistory(netWorth, flows);
  }, [transactions, baseCurrency, netWorth]);

  const netWorthDelta = computeDelta(netWorthHistory[11], netWorthHistory[10]);

  // ── Deltas reales mes-vs-mes-anterior (undefined si no hay base de comparación)
  const incomeDelta = computeDelta(totals.income, prevTotals.income);
  const expensesDelta = computeDelta(totals.expenses, prevTotals.expenses);
  const ratioDelta = computeDelta(totals.ratio, prevTotals.ratio);
  const formatDelta = (d: number | undefined) =>
    d === undefined ? undefined : `${d >= 0 ? '+' : ''}${Math.abs(d) < 10 ? d.toFixed(1) : Math.round(d)}%`;

  // ── Expense distribution by category (this month, in base currency)
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of transactions) {
      if (tx.type !== 'expense' || !tx.categoryId) continue;
      const d = new Date(tx.occurredOn);
      if (d.getMonth() !== viewMonth || d.getFullYear() !== viewYear) continue;
      const converted = convertAmount(tx.amount, tx.currency, baseCurrency);
      map.set(tx.categoryId, (map.get(tx.categoryId) ?? 0) + converted);
    }
    const result = Array.from(map.entries())
      .map(([catId, amount]) => {
        const cat = categories.find((c) => c.id === catId);
        return {
          name: cat ? localizedCategoryName(cat, locale) : t['common.other'],
          value: amount,
          color: categoryColorVar(cat?.color),
          icon: cat?.icon ?? '📦',
        };
      })
      .sort((a, b) => b.value - a.value);
    return result;
  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- idem: deps derivan de new Date()
  }, [transactions, viewYear, viewMonth, categories, baseCurrency, locale, t]);

  // ── Cash flow chart data — 12 meses (6 en móvil), computed from real transactions
  // Los flujos se calculan en su propio memo (como en reports-view) para que el
  // React Compiler pueda preservar ambas memos sinmemorizar un array mutado.
  const cashFlowFlows = useMemo(() => {
    const monthsBack = isMobile ? 6 : 12;
    return computeMonthlyFlows(
      transactions,
      baseCurrency as CurrencyCode,
      monthsBack,
      viewYear,
      viewMonth
    );
  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- viewDate deriva de new Date() (impuro), el compiler no puede preservar
  }, [transactions, viewYear, viewMonth, baseCurrency, isMobile]);

  const cashFlowData = useMemo(() => {
    const intl = intlLocale(locale);
    return cashFlowFlows.map((flow) => ({
      month: new Intl.DateTimeFormat(intl, { month: 'short' }).format(
        new Date(flow.year, flow.month, 1)
      ),
      income: flow.income,
      expenses: flow.expenses,
    }));
  }, [cashFlowFlows, locale]);

  // ── Recent transactions (top 5)
  const recent = [...transactions]
    .sort((a, b) => new Date(b.occurredOn).getTime() - new Date(a.occurredOn).getTime())
    .slice(0, 5);

  // [UX fix, auditoría P2-8] Mientras cargan los datos (login o recarga), mostrar
  // skeletons en lugar del estado vacío — evita el susto de "perdí mis datos".
  // (Colocado tras TODOS los hooks para respetar rules-of-hooks.)
  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label={t['a11y.loadingPanel']}>
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-36 w-full rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Greeting header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">{greeting}</h1>
          <p className="text-sm text-muted-foreground">
            {formatMoney(netWorth, baseCurrency, locale)} {baseCurrency}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={selectedMonth || `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="h-9 text-xs rounded-md border border-border bg-surface-2 px-2 text-foreground"
            aria-label={t['common.selectMonth']}
          />
          {selectedMonth && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedMonth('')}
              className="h-9 text-xs"
            >
              {t['common.today']}
            </Button>
          )}
          <Button onClick={() => setAddSheetOpen(true)} className="h-10">
            + {t['nav.add']}
          </Button>
        </div>
      </div>

      {/* Empty state — no accounts yet */}
      {accounts.length === 0 && transactions.length === 0 ? (
        <EmptyState
          className="shadow-card"
          titleAs="h2"
          titleClassName="text-xl font-bold mb-2"
          icon={
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">👋</span>
            </div>
          }
          title={t['auth.welcome']}
          description={t['dashboard.emptyHint']}
          descriptionClassName="mb-5 max-w-md"
          action={{
            label: t['dashboard.emptyCreateAccount'],
            onClick: () => setActiveView('accounts'),
          }}
          secondaryAction={{
            label: t['dashboard.emptyRecordTransaction'],
            onClick: () => setAddSheetOpen(true),
          }}
        />
      ) : (
        <>
          {/* Hero: Net Worth — variante gradiente, sparkline con historia real de 12 meses */}
          <KpiCard
            label={t['dashboard.netWorth']}
            amount={formatMoney(netWorth, baseCurrency, locale)}
            delta={formatDelta(netWorthDelta)}
            deltaDirection={
              netWorthDelta === undefined
                ? 'neutral'
                : netWorthDelta >= 0
                ? 'up'
                : 'down'
            }
            deltaTone={netWorthDelta === undefined || netWorthDelta >= 0 ? 'positive' : 'negative'}
            size="hero"
            sparkData={transactions.length > 0 ? netWorthHistory : undefined}
            color="primary"
            variant="gradient"
          />

          {/* Three KPI cards — deltas reales vs mes anterior */}
          <StatGrid scale="md">
            <KpiCard
              label={t['dashboard.income']}
              amount={formatMoney(totals.income, baseCurrency, locale)}
              delta={formatDelta(incomeDelta)}
              deltaDirection={incomeDelta === undefined ? 'neutral' : incomeDelta >= 0 ? 'up' : 'down'}
              deltaTone={incomeDelta === undefined ? 'neutral' : incomeDelta >= 0 ? 'positive' : 'negative'}
              color="income"
            />
            <KpiCard
              label={t['dashboard.expenses']}
              amount={formatMoney(totals.expenses, baseCurrency, locale)}
              delta={formatDelta(expensesDelta)}
              deltaDirection={expensesDelta === undefined ? 'neutral' : expensesDelta >= 0 ? 'up' : 'down'}
              // Gastar más = flecha arriba pero tono negativo
              deltaTone={expensesDelta === undefined ? 'neutral' : expensesDelta >= 0 ? 'negative' : 'positive'}
              color="expense"
            />
            <KpiCard
              label={t['dashboard.savingsRatio']}
              amount={`${totals.ratio.toFixed(1)}%`}
              delta={formatDelta(ratioDelta)}
              deltaDirection={ratioDelta === undefined ? 'neutral' : ratioDelta >= 0 ? 'up' : 'down'}
              deltaTone={ratioDelta === undefined ? 'neutral' : ratioDelta >= 0 ? 'positive' : 'negative'}
              color="income"
              suffix={t['dashboard.savingsTarget']}
            />
          </StatGrid>

          {/* Cash flow chart */}
          <Card className="p-5 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{t['dashboard.cashFlow']}</h2>
              <span className="text-xs text-muted-foreground">
                {t['common.lastMonths'].replace('{n}', String(cashFlowData.length))}
              </span>
            </div>
            <div className="h-56 sm:h-64 w-full overflow-x-auto scroll-area">
              <div className="h-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cashFlowData} barGap={2}>
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
                    tickFormatter={(v: number) => formatMoney(v, baseCurrency, locale, { compact: true })}
                  />
                  <Tooltip
                    cursor={{ fill: 'var(--surface-2)' }}
                    contentStyle={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => formatMoney(v, baseCurrency, locale)}
                  />
                  <Bar dataKey="income" fill="var(--income)" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="expenses" fill="var(--expense)" radius={[4, 4, 0, 0]} maxBarSize={32} />
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

          {/* Distribution + Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Expense distribution donut */}
            <Card className="p-5 lg:col-span-1 shadow-card">
              <h2 className="text-lg font-semibold mb-4">{t['dashboard.expenseDistribution']}</h2>
              {categoryBreakdown.length > 0 ? (
                <>
                  <div className="h-48 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryBreakdown}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={55}
                          outerRadius={80}
                          paddingAngle={2}
                          stroke="none"
                        >
                          {categoryBreakdown.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                          formatter={(v: number) => formatMoney(v, baseCurrency, locale)}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-xs text-muted-foreground">{t['dashboard.expenses']}</span>
                      <span className="text-xl font-bold tabular-nums">
                        {formatMoney(totals.expenses, baseCurrency, locale, { compact: true })}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {categoryBreakdown.slice(0, 4).map((c) => (
                      <div key={c.name} className="flex items-center gap-2 text-xs">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: c.color }}
                        />
                        <span className="flex-1 truncate">
                          {c.icon} {c.name}
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {((c.value / totals.expenses) * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
                  {t['transactions.noTransactions']}
                </div>
              )}
            </Card>

            {/* Alerts */}
            <Card className="p-5 lg:col-span-2 shadow-card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">
                  {t['dashboard.alerts']} ({alerts.length})
                </h2>
              </div>
              {alerts.length > 0 ? (
                <div className="space-y-2">
                  {alerts.map((alert) => {
                    const Icon =
                      alert.severity === 'critical'
                        ? AlertTriangle
                        : alert.type === 'cash_flow_forecast'
                        ? TrendingUp
                        : alert.type === 'expense_spike'
                        ? TrendingUp
                        : Lightbulb;
                    const tone = ALERT_ICON_COLOR[alert.severity];
                    return (
                      <div
                        key={alert.id}
                        className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-surface-2 transition-colors"
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                          style={{ background: ALERT_ICON_BG, color: tone }}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">
                            {localizedPair(alert.titleEs, alert.titleEn, locale)}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {localizedPair(alert.messageEs, alert.messageEn, locale)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  {t['dashboard.noAlerts']}
                </div>
              )}
            </Card>
          </div>

          {/* Recent transactions */}
          <Card className="p-5 shadow-card">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">{t['dashboard.recentTransactions']}</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveView('transactions')}
                className="text-primary"
              >
                {t['dashboard.viewAll']}
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
            {recent.length > 0 ? (
              <div className="space-y-0.5">
                {recent.map((tx) => (
                  <TransactionRow key={tx.id} tx={tx} onEdit={handleEditTx} />
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                {t['transactions.noTransactions']}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
