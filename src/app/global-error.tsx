'use client';

import { useEffect, useSyncExternalStore, type CSSProperties } from 'react';
import { translations } from '@/lib/finzen/i18n';
import type { Locale } from '@/lib/finzen/currency';
import { reportError } from '@/lib/finzen/error-report';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

function resolveLocale(browserLanguage: string, documentLanguage: string): Locale {
  const normalizedBrowser = browserLanguage.toLowerCase();
  if (normalizedBrowser.startsWith('es')) return 'es';
  if (normalizedBrowser.startsWith('en')) return 'en';

  if (documentLanguage === 'es' || documentLanguage === 'en') {
    return documentLanguage;
  }
  return 'en';
}

const PAGE_STYLE: CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1rem',
  backgroundColor: 'Canvas',
  color: 'CanvasText',
  colorScheme: 'light dark',
};

const CARD_STYLE: CSSProperties = {
  width: '100%',
  maxWidth: '36rem',
  padding: '1.5rem',
  border: '1px solid ButtonBorder',
  borderRadius: '0.75rem',
  backgroundColor: 'Canvas',
  color: 'CanvasText',
  textAlign: 'center',
};

const PRIMARY_BUTTON_STYLE: CSSProperties = {
  minHeight: '2.75rem',
  padding: '0.625rem 1rem',
  border: '1px solid AccentColor',
  borderRadius: '0.5rem',
  backgroundColor: 'AccentColor',
  color: 'Canvas',
  fontWeight: 600,
};

const SECONDARY_BUTTON_STYLE: CSSProperties = {
  minHeight: '2.75rem',
  padding: '0.625rem 1rem',
  border: '1px solid ButtonBorder',
  borderRadius: '0.5rem',
  backgroundColor: 'ButtonFace',
  color: 'ButtonText',
  fontWeight: 600,
};

function subscribeToClient(): () => void {
  return () => undefined;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  const isClient = useSyncExternalStore(
    subscribeToClient,
    () => true,
    () => false
  );
  const locale: Locale = isClient
    ? resolveLocale(navigator.language, document.documentElement.lang)
    : 'en';
  const t = translations[locale];

  useEffect(() => {
    reportError('global', error, { digest: error.digest });
  }, [error]);

  return (
    <html lang={locale}>
      <body style={{ margin: 0 }}>
        <main style={PAGE_STYLE}>
          <section role="alert" style={CARD_STYLE}>
            <h1 style={{ margin: 0, fontSize: '1.5rem' }}>{t['errorBoundary.title']}</h1>
            <p style={{ margin: '0.75rem 0 0', lineHeight: 1.5 }}>
              {t['errorBoundary.description']}
            </p>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.75rem',
                justifyContent: 'center',
                marginTop: '1.5rem',
              }}
            >
              <button type="button" style={PRIMARY_BUTTON_STYLE} onClick={reset}>
                {t['errorBoundary.retry']}
              </button>
              <button
                type="button"
                style={SECONDARY_BUTTON_STYLE}
                onClick={() => window.location.assign('/?view=dashboard')}
              >
                {t['errorBoundary.dashboard']}
              </button>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
