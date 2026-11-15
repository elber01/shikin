export type ErrorReportScope = 'route' | 'global' | 'view' | 'undo';

export interface ErrorReport {
  scope: ErrorReportScope;
  name: string;
  digest?: string;
  stack?: string;
}

export interface ErrorReportContext {
  digest?: string;
}

function stackWithoutMessage(stack: string | undefined): string | undefined {
  if (!stack) return undefined;
  const lines = stack.split('\n');
  if (lines.length <= 1) return undefined;
  return lines.slice(1).join('\n');
}

/**
 * Registra un error sin datos financieros ni identificadores personales.
 *
 * Solo se conserva el tipo, el digest y el stack sin su primera línea (que
 * contiene el mensaje). Nunca se incluyen cuerpos de request, emails,
 * descripciones, nombres de cuenta, API keys, headers ni snapshots de undo.
 */
export function reportError(
  scope: ErrorReportScope,
  error: unknown,
  context: ErrorReportContext = {}
): ErrorReport {
  const errorObject = error instanceof Error ? error : null;
  const report: ErrorReport = {
    scope,
    name: errorObject?.name ?? 'UnknownError',
  };

  if (typeof context.digest === 'string' && context.digest.length > 0) {
    report.digest = context.digest;
  }

  const stack = stackWithoutMessage(errorObject?.stack);
  if (stack) report.stack = stack;

  console.error('[shikin:error]', report);
  return report;
}
