'use client';

import {
  Moon,
  Sun,
  ChevronLeft,
  ChevronRight,
  Languages,
  LogOut,
  Search,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useFinZenStore } from '@/store/finzen-store';
import { translations } from '@/lib/finzen/i18n';
import { otherLocale } from '@/lib/finzen/localize';
import { useIsMacPlatform } from '@/lib/finzen/platform';
import { DESKTOP_NAV_ORDER, VIEW_REGISTRY } from './view-registry';
import { useViewNavigation } from '@/hooks/use-view-navigation';

export function Sidebar() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { data: session } = useSession();
  const { activeView, sidebarCollapsed, toggleSidebar, locale, setLocale, commandPaletteOpen, setCommandPaletteOpen, resetStore } =
    useFinZenStore();
  const navigate = useViewNavigation();
  const isMac = useIsMacPlatform();
  const shortcutHint = isMac ? '⌘K' : 'Ctrl+K';
  const t = translations[locale];

  // Datos reales de sesión — nada de placeholders
  const userName = session?.user?.name || session?.user?.email || '—';
  const userEmail = session?.user?.email || '';
  const userInitial = userName.charAt(0).toUpperCase() || 'U';

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  return (
    <aside
      className={cn(
        'hidden lg:flex fixed inset-y-0 left-0 z-30 flex-col bg-surface border-r border-border transition-[width] duration-200',
        sidebarCollapsed ? 'w-16' : 'w-[280px]'
      )}
      aria-label={t['a11y.sidebar']}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 h-16 px-4 border-b border-border">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2 min-w-0">
            <Image
              src="/brand/shikin-logo.png"
              alt=""
              width={32}
              height={32}
              className="w-8 h-8 rounded-md ring-1 ring-border shrink-0"
            />
            <span className="text-xl sm:text-2xl font-bold text-primary tracking-tight truncate">{t['app.name']}</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-md hover:bg-surface-2 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            aria-label={t['a11y.toggleSidebar']}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Trigger de la command palette (⌘K / Ctrl+K) — franja propia, bajo el logo y sobre la nav */}
      <div className="px-2 pt-2">
        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          data-command-trigger
          className={cn(
            'flex w-full min-h-[40px] items-center gap-2 rounded-md border border-border bg-surface-2 text-muted-foreground hover:text-foreground transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
            sidebarCollapsed ? 'justify-center p-2' : 'px-3 py-2'
          )}
          aria-label={t['palette.triggerLabel']}
          aria-expanded={commandPaletteOpen}
        >
          <Search className="w-4 h-4 shrink-0" />
          {!sidebarCollapsed && (
            <>
              <span className="flex-1 text-left text-xs">{t['palette.triggerText']}</span>
              <kbd className="rounded border border-border bg-surface px-1 text-[10px] font-mono">
                {shortcutHint}
              </kbd>
            </>
          )}
        </button>
      </div>

      {/* Session info — datos reales de la sesión activa */}
      {!sidebarCollapsed && session?.user && (
        <div className="p-3 border-b border-border">
          <div className="px-3 py-2 rounded-md bg-surface-2 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
              {userInitial}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{userName}</div>
              <div className="text-xs text-muted-foreground truncate">{userEmail}</div>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-1">
        {DESKTOP_NAV_ORDER.map((view) => {
          const meta = VIEW_REGISTRY[view];
          const Icon = meta.icon;
          const active = activeView === view;
          return (
            <button
              key={view}
              onClick={() => navigate(view)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors relative',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
                sidebarCollapsed && 'justify-center'
              )}
              title={sidebarCollapsed ? t[meta.labelKey] : undefined}
              aria-current={active ? 'page' : undefined}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-primary" />
              )}
              <Icon className="w-5 h-5 shrink-0" />
              {!sidebarCollapsed && <span>{t[meta.labelKey]}</span>}
            </button>
          );
        })}
      </nav>

      {/* Footer: theme + lang + user */}
      <div className="p-2 border-t border-border space-y-1">
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-surface-2',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
            sidebarCollapsed && 'justify-center'
          )}
          aria-label={t['a11y.toggleTheme']}
        >
          {mounted && theme === 'dark' ? (
            <Sun className="w-5 h-5" />
          ) : (
            <Moon className="w-5 h-5" />
          )}
          {!sidebarCollapsed && (
            <span>{mounted && theme === 'dark' ? t['nav.lightMode'] : t['nav.darkMode']}</span>
          )}
        </button>

        <button
          onClick={() => setLocale(otherLocale(locale))}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-surface-2',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
            sidebarCollapsed && 'justify-center'
          )}
          aria-label={t['a11y.switchLanguage']}
        >
          <Languages className="w-5 h-5" />
          {!sidebarCollapsed && (
            <span>{t[otherLocale(locale) === 'es' ? 'common.spanish' : 'common.english']}</span>
          )}
        </button>

        <button
          onClick={() => {
            resetStore();
            void signOut({ callbackUrl: '/login' });
          }}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-expense-soft hover:text-expense transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
            sidebarCollapsed && 'justify-center'
          )}
          aria-label={t['nav.logout']}
          title={sidebarCollapsed ? t['nav.logout'] : undefined}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!sidebarCollapsed && <span>{t['nav.logout']}</span>}
        </button>
      </div>
    </aside>
  );
}
