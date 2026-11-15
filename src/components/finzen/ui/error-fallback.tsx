'use client';

import { AlertTriangle, Home, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { translations } from '@/lib/finzen/i18n';
import { useFinZenStore } from '@/store/finzen-store';

interface ErrorFallbackProps {
  onRetry: () => void;
  onDashboard: () => void;
}

/** Fallback visual común para errores de render/lifecycle. */
export function ErrorFallback({ onRetry, onDashboard }: ErrorFallbackProps) {
  const locale = useFinZenStore((state) => state.locale);
  const t = translations[locale];

  return (
    <div
      role="alert"
      className="mx-auto flex min-h-[320px] w-full max-w-xl flex-col items-center justify-center rounded-xl border border-border bg-surface p-6 text-center"
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-expense-soft text-expense">
        <AlertTriangle className="h-6 w-6" aria-hidden="true" />
      </div>
      <h1 className="text-xl font-semibold text-foreground">{t['errorBoundary.title']}</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {t['errorBoundary.description']}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button className="h-11 min-h-11" onClick={onRetry}>
          <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
          {t['errorBoundary.retry']}
        </Button>
        <Button variant="outline" className="h-11 min-h-11" onClick={onDashboard}>
          <Home className="mr-2 h-4 w-4" aria-hidden="true" />
          {t['errorBoundary.dashboard']}
        </Button>
      </div>
    </div>
  );
}
