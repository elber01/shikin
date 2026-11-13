'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useTheme } from 'next-themes';
import { useSession, signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';
import {
  User,
  Users,
  Tags,
  ShieldCheck,
  Building2,
  Palette,
  Globe,
  Moon,
  Download,
  Trash2,
  LogOut,
  FileText,
  Database,
} from 'lucide-react';
import { toast } from 'sonner';
import { useFinZenStore } from '@/store/finzen-store';
import { translations } from '@/lib/finzen/i18n';
import { CURRENCIES, type CurrencyCode, type Locale } from '@/lib/finzen/currency';
import {
  downloadTextFile,
  exportFilename,
  exportTransactionsCsv,
  exportTransactionsJson,
} from '@/lib/finzen/export';
import { localeFlag, localizedPair } from '@/lib/finzen/localize';
import { cn } from '@/lib/utils';
import { CategoriesManager } from '@/components/finzen/categories-manager';
import { ApiKeyManager } from '@/components/finzen/api-key-manager';
import { ConfirmDelete } from '@/components/finzen/ui/confirm-delete';
import { CurrencySelect } from '@/components/finzen/ui/currency-select';

// [UX fix, auditoría P2-2] Las filas de cuenta eran botones muertos: ahora son
// acordeones con información REAL de la sesión y del store.
export function SettingsView() {
  const { locale, setLocale, baseCurrency, setBaseCurrency, categories, accounts, transactions, resetStore } = useFinZenStore();
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => setMounted(true), []);
  const t = translations[locale];

  // [UX fix, auditoría P2-2] Exportar datos desde Ajustes: era un botón muerto.
  // Misma lógica probada del Import Center (export completo, sin filtros).
  function exportData(format: 'csv' | 'json') {
    if (transactions.length === 0 && accounts.length === 0) {
      toast.error(t['common.noData']);
      return;
    }
    const ctx = { categories, accounts, locale, baseCurrency: baseCurrency as CurrencyCode };
    const content =
      format === 'json'
        ? exportTransactionsJson(transactions, ctx, {
            exportedAt: new Date().toISOString(),
            accounts,
          })
        : exportTransactionsCsv(transactions, ctx);
    downloadTextFile(
      exportFilename('finzen-export', format),
      content,
      format === 'json' ? 'application/json' : 'text/csv'
    );
    toast.success(t['common.exported'].replace('{format}', format.toUpperCase()));
  }

  // [UX fix, auditoría P2-2] Eliminar cuenta: era un botón muerto sin confirmación.
  // Ahora: DELETE /api/me (cascada) + confirmación explícita + logout.
  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      const res = await fetch('/api/me', { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      resetStore();
      toast.success(t['settings.accountDeleted']);
      signOut({ callbackUrl: '/login' });
    } catch (err) {
      toast.error(t['settings.deleteAccountFailed'], {
        description: String(err),
      });
      setDeleting(false);
    }
  }

  function InfoRow({ label, value }: { label: string; value: string }) {
    return (
      <div className="flex items-center justify-between py-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm font-medium text-right break-all min-w-0 pl-4">{value}</span>
      </div>
    );
  }

  function ComingSoon() {
    return (
      <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-surface-2 text-muted-foreground shrink-0">
        {t['common.soon']}
      </span>
    );
  }

  const items = [
    {
      icon: User,
      label: t['settings.profile'],
      subtitle: session?.user?.name || t['settings.myProfile'],
      content: (
        <div className="divide-y divide-border">
          <InfoRow label={t['settings.name']} value={session?.user?.name || '—'} />
          <InfoRow label={t['settings.email']} value={session?.user?.email || '—'} />
          <InfoRow
            label={t['settings.language']}
            value={`${localeFlag(locale)} ${localizedPair(t['common.spanish'], t['common.english'], locale)}`}
          />
          <InfoRow label={t['settings.baseCurrency']} value={`${CURRENCIES[baseCurrency as CurrencyCode].symbol} ${baseCurrency}`} />
        </div>
      ),
    },
    {
      icon: Users,
      label: t['settings.household'],
      subtitle: t['settings.householdSubtitle'],
      content: (
        <div className="text-sm text-muted-foreground space-y-2">
          <InfoRow label={t['settings.members']} value={session?.user?.name || '—'} />
          <p>{t['settings.householdDev']}</p>
          <ComingSoon />
        </div>
      ),
    },
    {
      icon: Tags,
      label: t['settings.categories'],
      subtitle: t['settings.categoriesSubtitle'].replace('{n}', String(categories.length)),
      content: (
        <div className="text-sm text-muted-foreground space-y-2">
          <p>{t['settings.categoriesHint']}</p>
        </div>
      ),
    },
    {
      icon: ShieldCheck,
      label: t['settings.security'],
      subtitle: t['settings.twoFactorSubtitle'],
      content: (
        <div className="divide-y divide-border">
          <InfoRow label={t['settings.passwords']} value={t['settings.passwordAlgoValue']} />
          <InfoRow label={t['settings.sessions']} value={t['settings.sessionsValue']} />
          <div className="pt-2"><ComingSoon /><span className="text-xs text-muted-foreground ml-1.5">{t['settings.twoFactorDev']}</span></div>
        </div>
      ),
    },
    {
      icon: Building2,
      label: t['settings.bankConnections'],
      subtitle: t['settings.noConnections'],
      content: (
        <div className="text-sm text-muted-foreground space-y-2">
          <p>{t['settings.plaidHint']}</p>
          <ComingSoon />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-xl sm:text-2xl font-bold">{t['settings.title']}</h1>

      {/* Account items — acordeones con contenido real */}
      <Card className="px-4">
        <Accordion type="single" collapsible className="w-full">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <AccordionItem key={item.label} value={item.label} className="border-border">
                <AccordionTrigger className="py-3 hover:no-underline group">
                  <div className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    <div className="w-9 h-9 rounded-lg bg-surface-2 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium group-hover:no-underline">{item.label}</div>
                      <div className="text-xs text-muted-foreground truncate">{item.subtitle}</div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4 pt-1">{item.content}</AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </Card>

      {/* Appearance */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">{t['settings.appearance']}</h2>
        </div>

        {/* Theme */}
        <div className="mb-4">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-2">
            <Moon className="w-3 h-3" />
            {t['settings.theme']}
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['light', 'dark', 'system'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setTheme(mode)}
                className={cn(
                  'h-10 rounded-md border text-sm font-medium transition-colors',
                  mounted && theme === mode
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-surface-2'
                )}
              >
                {mode === 'light' ? t['common.light'] : mode === 'dark' ? t['common.dark'] : t['common.system']}
              </button>
            ))}
          </div>
        </div>

        {/* Language */}
        <div className="mb-4">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-2">
            <Globe className="w-3 h-3" />
            {t['settings.language']}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(['es', 'en'] as Locale[]).map((l) => (
              <button
                key={l}
                onClick={() => setLocale(l)}
                className={cn(
                  'h-10 rounded-md border text-sm font-medium transition-colors',
                  locale === l
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-surface-2'
                )}
              >
                {localeFlag(l)} {localizedPair(t['common.spanish'], t['common.english'], l)}
              </button>
            ))}
          </div>
        </div>

        {/* Base currency */}
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
            {t['settings.currency']}
          </label>
          <CurrencySelect
            value={baseCurrency as CurrencyCode}
            onChange={(v) => setBaseCurrency(v)}
            showName
            className="h-10"
          />
        </div>
      </Card>

      {/* Category Management */}
      <CategoriesManager />

      {/* AI Agent Integration */}
      <ApiKeyManager />

      {/* Data & danger zone */}
      <Card className="px-4 py-2">
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="export" className="border-border">
            <AccordionTrigger className="py-3 hover:no-underline group">
              <div className="flex items-center gap-3 flex-1 min-w-0 text-left">
                <div className="w-9 h-9 rounded-lg bg-surface-2 flex items-center justify-center shrink-0">
                  <Download className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{t['settings.dataExport']}</div>
                  <div className="text-xs text-muted-foreground">CSV · JSON</div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4 pt-1">
              <p className="text-xs text-muted-foreground mb-3">
                {t['settings.exportHint']}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="h-11 min-h-11" onClick={() => exportData('csv')}>
                  <FileText className="w-4 h-4 mr-1.5" />CSV
                </Button>
                <Button variant="outline" size="sm" className="h-11 min-h-11" onClick={() => exportData('json')}>
                  <Database className="w-4 h-4 mr-1.5" />JSON
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>

      <Card className="p-2">
        <ConfirmDelete
          trigger={
            <button className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-expense-soft transition-colors text-left group" disabled={deleting}>
              <div className="w-9 h-9 rounded-lg bg-expense-soft flex items-center justify-center shrink-0">
                <Trash2 className="w-4 h-4 text-expense" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-expense">{t['settings.deleteAccount']}</div>
                <div className="text-xs text-muted-foreground">
                  {t['settings.deleteAccountHint']}
                </div>
              </div>
            </button>
          }
          title={t['settings.deleteAccountTitle']}
          description={t['settings.deleteAccountBody']}
          confirmLabel={deleting ? t['settings.deleting'] : t['settings.deleteEverything']}
          cancelLabel={t['common.cancel']}
          onConfirm={handleDeleteAccount}
          pending={deleting}
        />
      </Card>

      {/* Logout */}
      <Card className="p-2">
        <button
          onClick={() => { resetStore(); signOut({ callbackUrl: '/login' }); }}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-surface-2 transition-colors text-left"
        >
          <div className="w-9 h-9 rounded-lg bg-surface-2 flex items-center justify-center shrink-0">
            <LogOut className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium">{t['settings.signOut']}</div>
            <div className="text-xs text-muted-foreground">{t['settings.signOutHint']}</div>
          </div>
        </button>
      </Card>

      {/* Footer */}
      <div className="text-center text-xs text-muted-foreground py-2">
        {t['app.name']} v2.0.0 · Turso + Auth
      </div>
    </div>
  );
}
