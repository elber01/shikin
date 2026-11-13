'use client';

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lightbulb, Target, Plus, Pencil, Trash2 } from 'lucide-react';
import { ApiError, useFinZenStore } from '@/store/finzen-store';
import { translations } from '@/lib/finzen/i18n';
import { convertAmount, formatMoney, CURRENCIES, type CurrencyCode } from '@/lib/finzen/currency';
import { localizedCategoryName } from '@/lib/finzen/localize';
import { categoryColorVar } from '@/lib/finzen/category-color';
import { toast } from 'sonner';
import { EmptyState } from '@/components/finzen/ui/empty-state';
import { IconButton } from '@/components/finzen/ui/icon-button';
import { ConfirmDelete } from '@/components/finzen/ui/confirm-delete';
import { ProgressBar } from '@/components/finzen/ui/progress-bar';
import { CrudDialog } from '@/components/finzen/ui/crud-dialog';
import { CategoryIcon } from '@/components/finzen/ui/category-icon';

export function BudgetsView() {
  const { budget, transactions, categories, locale, baseCurrency, addBudgetItem, updateBudgetItem, deleteBudgetItem } = useFinZenStore();
  const t = translations[locale];
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState('');
  const [plannedAmount, setPlannedAmount] = useState('');
  const [alertThreshold, setAlertThreshold] = useState('80');

  function openCreate() {
    setEditingItemId(null); setCategoryId(''); setPlannedAmount(''); setAlertThreshold('80'); setDialogOpen(true);
  }
  function openEdit(itemId: string) {
    const item = budget?.items.find(i => i.id === itemId);
    if (!item) return;
    setEditingItemId(itemId);
    setCategoryId(item.categoryId);
    setPlannedAmount(String(item.plannedAmount));
    setAlertThreshold(String(item.alertThresholdPct));
    setDialogOpen(true);
  }
  function closeDialog() { setDialogOpen(false); setEditingItemId(null); }

  /** Traduce el código snake_case del servidor a un mensaje en el idioma del usuario. */
  function budgetErrorMessage(err: unknown): string {
    if (err instanceof ApiError) {
      if (err.code === 'not_found') return t['budgets.errorNotFound'];
      if (err.code === 'invalid_category') return t['budgets.errorInvalidCategory'];
      if (err.code === 'invalid_amount') return t['budgets.errorInvalidAmount'];
    }
    return String(err).replace('Error: ', '');
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryId) { toast.error(t['budgets.selectCategory']); return; }
    const amount = Number(plannedAmount.replace(',', '.'));
    if (!amount || amount <= 0) { toast.error(t['budgets.invalidAmount']); return; }
    const threshold = Math.min(100, Math.max(1, parseInt(alertThreshold) || 80));
    try {
      if (editingItemId && budget) {
        await updateBudgetItem(budget.id, editingItemId, { plannedAmount: amount, alertThresholdPct: threshold });
        toast.success(t['budgets.updated']);
      } else {
        if (budget && budget.items.some(i => i.categoryId === categoryId)) { toast.error(t['budgets.duplicate']); return; }
        await addBudgetItem({ categoryId, plannedAmount: amount, alertThresholdPct: threshold });
        toast.success(t['budgets.added']);
      }
      closeDialog();
    } catch (err) { toast.error(budgetErrorMessage(err)); }
  }

  async function handleDelete(itemId: string) {
    try { await deleteBudgetItem(itemId); toast.success(t['budgets.deleted']); }
    catch (err) { toast.error(budgetErrorMessage(err)); }
  }

  const items = useMemo(() => {
    if (!budget) return [];
    const now = new Date();
    return budget.items.map(item => {
      const cat = categories.find(c => c.id === item.categoryId);
      const spent = transactions.filter(tx => tx.categoryId === item.categoryId && tx.type === 'expense' && (() => { const d = new Date(tx.occurredOn); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); })()).reduce((s, tx) => s + convertAmount(tx.amount, tx.currency, baseCurrency as CurrencyCode), 0);
      const planned = item.plannedAmount; const pct = planned > 0 ? (spent / planned) * 100 : 0;
      return { ...item, category: cat, spent, planned, pct, remaining: planned - spent };
    });
  }, [budget, transactions, categories, baseCurrency]);

  const totals = useMemo(() => { const s = items.reduce((a, i) => a + i.spent, 0); const p = items.reduce((a, i) => a + i.planned, 0); return { spent: s, planned: p, pct: p > 0 ? (s / p) * 100 : 0 }; }, [items]);
  const availableCategories = categories.filter(c => c.direction === 'expense' && !(budget?.items || []).some(i => i.categoryId === c.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl sm:text-2xl font-bold">{t['budgets.title']}</h1>
        <Button size="sm" className="h-11 min-h-11" onClick={openCreate} disabled={availableCategories.length === 0 && !editingItemId}><Plus className="w-4 h-4 mr-1" />{t['budgets.new']}</Button>
      </div>
      {items.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium">{t['budgets.overall']}</span><span className="text-sm tabular-nums">{formatMoney(totals.spent, baseCurrency as CurrencyCode, locale)} / {formatMoney(totals.planned, baseCurrency as CurrencyCode, locale)}</span></div>
          <ProgressBar value={totals.pct} tone="auto" size="md" />
          <div className="text-xs text-muted-foreground mt-1.5">{totals.pct.toFixed(0)}% {t['budgets.spent']}</div>
        </Card>
      )}
      {items.length === 0 ? (
        <EmptyState
          icon={
            <div className="w-14 h-14 rounded-2xl bg-surface-2 flex items-center justify-center mx-auto mb-3">
              <Target className="w-7 h-7 text-muted-foreground" />
            </div>
          }
          title={t['budgets.emptyTitle']}
          description={t['budgets.emptyHint']}
          action={{
            label: t['budgets.new'],
            onClick: openCreate,
            disabled: availableCategories.length === 0,
            icon: <Plus className="w-4 h-4 mr-1" />,
          }}
        />
      ) : (
        <Card className="p-4 space-y-2">
          {items.map(item => {
            const isOver = item.pct > 100; const isAppr = item.pct >= item.alertThresholdPct && !isOver;
            return (
              <div key={item.id} className="p-3 rounded-lg border border-border hover:bg-surface-2 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0"><CategoryIcon category={item.category} variant="bare" /><span className="text-sm font-medium truncate">{item.category ? localizedCategoryName(item.category, locale) : '—'}</span>{(isOver || isAppr) && <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: isOver ? 'var(--expense-soft)' : 'var(--warning-soft)', color: isOver ? 'var(--expense)' : 'var(--warning)' }}>{isOver ? t['budgets.overBudget'] : t['budgets.approaching']}</span>}</div>
                  <div className="flex items-center gap-1 shrink-0">
                    <IconButton
                      icon={<Pencil className="w-3.5 h-3.5" />}
                      label={t['a11y.edit']}
                      onClick={() => openEdit(item.id)}
                    />
                    <ConfirmDelete
                      trigger={
                        <IconButton
                          icon={<Trash2 className="w-3.5 h-3.5" />}
                          label={t['a11y.delete']}
                          variant="danger"
                        />
                      }
                      title={t['budgets.deleteTitle']}
                      description={t['budgets.deleteBody']}
                      confirmLabel={t['budgets.delete']}
                      cancelLabel={t['budgets.cancel']}
                      onConfirm={() => {
                        void handleDelete(item.id);
                      }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between mb-1.5"><span className="text-xs tabular-nums text-muted-foreground">{formatMoney(item.spent, baseCurrency as CurrencyCode, locale)} / {formatMoney(item.planned, baseCurrency as CurrencyCode, locale)}</span><span className="text-xs tabular-nums text-muted-foreground">{item.pct.toFixed(0)}%</span></div>
                <ProgressBar
                  value={item.pct}
                  tone={
                    isOver ? 'expense' : isAppr ? 'warning' : categoryColorVar(item.category?.color)
                  }
                  size="sm"
                />
                <div className="flex items-center justify-between mt-1.5 text-xs"><span className="text-muted-foreground">{t['budgets.alertAt']} {item.alertThresholdPct}%</span><span className="tabular-nums" style={{ color: isOver ? 'var(--expense)' : 'var(--muted-foreground)' }}>{isOver ? `${t['budgets.overBudget']} ${t['budgets.by']} ${formatMoney(Math.abs(item.remaining), baseCurrency as CurrencyCode, locale)}` : `${formatMoney(item.remaining, baseCurrency as CurrencyCode, locale)} ${t['budgets.left']}`}</span></div>
              </div>
            );
          })}
        </Card>
      )}
      <CrudDialog
        open={dialogOpen}
        onOpenChange={o => { if (!o) closeDialog(); }}
        title={editingItemId ? t['budgets.editItem'] : t['budgets.newItem']}
        submitLabel={editingItemId ? t['budgets.saveChanges'] : t['budgets.add']}
        onSubmit={handleSave}
      >
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">{t['budgets.category']}</Label>
          <Select value={categoryId} onValueChange={setCategoryId} disabled={editingItemId !== null}>
            <SelectTrigger className="h-11"><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              {(editingItemId ? categories.filter(c => c.direction === 'expense') : availableCategories).map(c => (
                <SelectItem key={c.id} value={c.id}><span className="flex items-center gap-2"><span>{c.icon}</span>{localizedCategoryName(c, locale)}</span></SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">{t['budgets.amount']}</Label>
            <div className="relative">
              <Input type="text" inputMode="decimal" value={plannedAmount} onChange={e => setPlannedAmount(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="0.00" className="h-11 font-mono text-right pr-12" required />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">{CURRENCIES[baseCurrency as CurrencyCode].symbol}</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">{t['budgets.alertPct']}</Label>
            <Input type="number" min="1" max="100" value={alertThreshold} onChange={e => setAlertThreshold(e.target.value)} className="h-11 font-mono text-right" />
          </div>
        </div>
      </CrudDialog>
    </div>
  );
}
