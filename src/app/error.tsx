'use client';

import { useEffect } from 'react';
import { ErrorFallback } from '@/components/finzen/ui/error-fallback';
import { useViewNavigation } from '@/hooks/use-view-navigation';
import { reportError } from '@/lib/finzen/error-report';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const navigate = useViewNavigation();

  useEffect(() => {
    reportError('route', error, { digest: error.digest });
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <ErrorFallback
        onRetry={reset}
        onDashboard={() => navigate('dashboard')}
      />
    </main>
  );
}
