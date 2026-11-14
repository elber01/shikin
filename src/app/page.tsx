'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { AppShell } from '@/components/finzen/app-shell';
import { AuthForm } from '@/components/auth/auth-form';
import { Loader2 } from 'lucide-react';

/** Spinner de la ruta (reutilizado como fallback de `<Suspense>`). */
function PageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

export default function Home() {
  const { data: session, status } = useSession();
  const [mounted, setMounted] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  if (!mounted || status === 'loading') {
    return <PageSpinner />;
  }

  if (!session) {
    return <AuthForm />;
  }

  // [10-U2] La ruta `/` se prerenderiza estáticamente: los hooks de query
  // string (deep-link `?view=`) solo pueden usarse dentro de un límite
  // <Suspense> (si no, el build falla con `missing-suspense-with-csr-bailout`).
  return (
    <Suspense fallback={<PageSpinner />}>
      <AppShell />
    </Suspense>
  );
}
