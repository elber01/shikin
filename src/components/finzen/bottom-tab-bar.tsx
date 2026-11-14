'use client';

import { Plus, Menu, LogOut, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFinZenStore } from '@/store/finzen-store';
import { translations } from '@/lib/finzen/i18n';
import { otherLocale } from '@/lib/finzen/localize';
import { useTheme } from 'next-themes';
import Image from 'next/image';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { signOut } from 'next-auth/react';
import { Separator } from '@/components/ui/separator';
import {
  MOBILE_MORE,
  MOBILE_PRIMARY,
  MOBILE_SECONDARY,
  VIEW_REGISTRY,
} from './view-registry';
import type { ViewKey } from '@/lib/finzen/views';
import { useViewNavigation } from '@/hooks/use-view-navigation';

/** Vistas que viven en el sheet "Más" (para el estado activo del botón). */
const MORE_VIEWS: readonly ViewKey[] = MOBILE_MORE;

export function BottomTabBar() {
  const { activeView, setAddSheetOpen, locale } = useFinZenStore();
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useViewNavigation();
  const t = translations[locale];

  function goTo(view: ViewKey) {
    navigate(view);
    setMoreOpen(false);
  }

  const tabClass = (active: boolean) =>
    cn(
      'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[64px]',
      active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
    );

  return (
    <>
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-surface/95 backdrop-blur-lg border-t border-border h-[72px] px-2"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label={t['a11y.bottomNav']}
      >
        <div className="flex items-center justify-around h-full max-w-md mx-auto">
          {MOBILE_PRIMARY.map((view) => {
            const meta = VIEW_REGISTRY[view];
            const Icon = meta.icon;
            const active = activeView === view;
            return (
              <button
                key={view}
                onClick={() => navigate(view)}
                className={tabClass(active)}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[11px] font-medium">{t[meta.labelKey]}</span>
              </button>
            );
          })}

          {/* Center FAB */}
          <button
            onClick={() => setAddSheetOpen(true)}
            className="relative -mt-8 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            aria-label={t['nav.add']}
          >
            <Plus className="w-6 h-6" />
          </button>

          {/* Cuentas — antes inaccesible en móvil */}
          {MOBILE_SECONDARY.map((view) => {
            const meta = VIEW_REGISTRY[view];
            const Icon = meta.icon;
            const active = activeView === view;
            return (
              <button
                key={view}
                onClick={() => navigate(view)}
                className={tabClass(active)}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[11px] font-medium">{t[meta.labelKey]}</span>
              </button>
            );
          })}

          {/* Más — abre sheet con Presupuestos / Reportes / Importar / Ajustes */}
          <button
            onClick={() => setMoreOpen(true)}
            className={tabClass(MORE_VIEWS.includes(activeView))}
            aria-current={MORE_VIEWS.includes(activeView) ? 'page' : undefined}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            aria-label={t['a11y.moreMenu']}
          >
            <Menu className="w-5 h-5" />
            <span className="text-[11px] font-medium">{t['nav.more']}</span>
          </button>
        </div>
      </nav>

      {/* Sheet "Más" */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="h-auto pb-6 rounded-t-xl sm:m-auto sm:max-w-md">
          <SheetHeader className="pb-2">
            <SheetTitle className="text-base">{t['nav.more']}</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-2 px-1">
            {MOBILE_MORE.map((view) => {
              const meta = VIEW_REGISTRY[view];
              const Icon = meta.icon;
              const active = activeView === view;
              return (
                <button
                  key={view}
                  onClick={() => goTo(view)}
                  className={cn(
                    'flex flex-col items-center gap-2 py-5 rounded-xl border transition-colors active:scale-[0.98]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
                    active
                      ? 'border-primary/40 bg-primary/5 text-primary'
                      : 'border-border bg-surface hover:bg-surface-2 text-foreground'
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon className="w-6 h-6" />
                  <span className="text-sm font-medium">{t[meta.labelKey]}</span>
                </button>
              );
            })}
          </div>
          <Separator className="my-3" />
          <button
            onClick={() => {
              setMoreOpen(false);
              signOut({ callbackUrl: '/login' });
            }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium text-expense hover:bg-expense-soft transition-colors active:scale-[0.98]"
          >
            <LogOut className="w-4 h-4" />
            {t['nav.logout']}
          </button>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function MobileTopBar() {
  const { locale, setLocale, commandPaletteOpen, setCommandPaletteOpen } = useFinZenStore();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const t = translations[locale];
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  return (
    <header className="lg:hidden sticky top-0 z-30 bg-surface/95 backdrop-blur-lg border-b border-border">
      <div className="flex items-center justify-between h-14 px-4">
        <div className="flex items-center gap-2">
          <Image
            src="/brand/shikin-logo.png"
            alt=""
            width={32}
            height={32}
            className="w-8 h-8 rounded-md ring-1 ring-border"
          />
          <span className="text-lg font-bold text-primary">{t['app.name']}</span>
        </div>
        <div className="flex items-center gap-1">
          {/* Trigger de la command palette (⌘K / Ctrl+K) */}
          <button
            type="button"
            onClick={() => setCommandPaletteOpen(true)}
            data-command-trigger
            className="p-2 rounded-md hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            aria-label={t['palette.triggerLabel']}
            aria-expanded={commandPaletteOpen}
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            onClick={() => setLocale(otherLocale(locale))}
            className="px-2 py-1 rounded-md hover:bg-surface-2 text-xs font-semibold"
            aria-label={t['a11y.switchLanguage']}
          >
            {otherLocale(locale) === 'es' ? 'ES' : 'EN'}
          </button>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-md hover:bg-surface-2"
            aria-label={t['a11y.toggleTheme']}
          >
            {mounted && theme === 'dark' ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
