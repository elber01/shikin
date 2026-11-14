'use client';

import { useEffect } from 'react';
import type { ComponentType } from 'react';
import { useFinZenStore } from '@/store/finzen-store';
import { Sidebar } from './sidebar';
import { BottomTabBar, MobileTopBar } from './bottom-tab-bar';
import { AddTransactionSheet } from './add-transaction-sheet';
import { DashboardView } from './dashboard-view';
import { TransactionsView } from './transactions-view';
import { AccountsView } from './accounts-view';
import { BudgetsView } from './budgets-view';
import { ReportsView } from './reports-view';
import { ImportView } from './import-view';
import { SettingsView } from './settings-view';
import { ViewTransition } from './view-transition';
import { ViewRouteSync } from './view-route-sync';
import { CommandPalette } from './command-palette';
import { ShortcutsDialog } from './shortcuts-dialog';
import { useGlobalShortcuts } from '@/hooks/use-global-shortcuts';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { translations } from '@/lib/finzen/i18n';
import type { ViewKey } from '@/lib/finzen/views';

// `Record<ViewKey, …>` → `tsc` falla si falta una vista (anti-drift 10-U2).
const VIEWS: Record<ViewKey, ComponentType> = {
  dashboard: DashboardView,
  transactions: TransactionsView,
  accounts: AccountsView,
  budgets: BudgetsView,
  reports: ReportsView,
  import: ImportView,
  settings: SettingsView,
};

export function AppShell() {
  const { activeView, sidebarCollapsed, loadData, loading, transactions, accounts, locale } = useFinZenStore();
  const t = translations[locale];

  // Atajos globales — se activan UNA sola vez (no en cada vista).
  useGlobalShortcuts();

  // Load data from API on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Show loading state on first load
  if (loading && transactions.length === 0 && accounts.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center" role="status" aria-label={t['a11y.loadingPanel']}>
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const ActiveView = VIEWS[activeView];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Deep-link: la URL (?view=…) y el store (activeView) quedan sincronizados. */}
      <ViewRouteSync />

      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2 focus:rounded-md focus:bg-primary focus:text-primary-foreground focus:text-sm focus:font-medium focus:shadow-lg"
      >
        {t['a11y.skipToContent']}
      </a>

      <Sidebar />

      <MobileTopBar />

      <main
        id="main-content"
        className={cn(
          'min-h-screen pb-24 lg:pb-0',
          'lg:pl-[280px]',
          sidebarCollapsed && 'lg:pl-16'
        )}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          <ViewTransition key={activeView}>
            <ActiveView />
          </ViewTransition>
        </div>
      </main>

      <BottomTabBar />
      <AddTransactionSheet />
      <CommandPalette />
      <ShortcutsDialog />
    </div>
  );
}
