import { NextResponse } from 'next/server';

/**
 * Deprecación de las rutas legacy `/api/agent/*` (Fase 0 — convención 11-A0).
 * ------------------------------------------------------------------
 * Las rutas legacy SIGUEN operativas (no se borran en Fase 0) pero quedan
 * deprecadas: cada respuesta —2xx y 4xx/429— lleva los headers
 * `Deprecation`, `Sunset` y `Link … rel="successor-version"`.
 *
 * La fecha de retiro es una CONSTANTE compartida: el test de contrato
 * verifica que aparece LITERALMENTE en `SDD.md` (anti-drift) y que es un
 * HTTP-date válido y futuro. Si el sucesor aún no existe, el `Sunset` se
 * prorroga (decisión del dueño).
 */
export const LEGACY_API_SUNSET = 'Sun, 14 Feb 2027 00:00:00 GMT';

/** Sucesores v1 de cada ruta legacy (array vacío = sin sucesor). */
export const LEGACY_SUCCESSOR: Record<'summary' | 'transactions' | 'accounts' | 'categories', string[]> = {
  summary: ['/api/v1/summary'],
  transactions: ['/api/v1/expenses', '/api/v1/incomes'],
  accounts: ['/api/v1/accounts'],
  // No existe sucesor v1 para las categorías (pendiente de Fase 1).
  categories: [],
};

/**
 * Headers de deprecación de una ruta legacy.
 * Varios sucesores → varios `Link` separados por `, `.
 */
export function legacyDeprecationHeaders(successor?: string[]): Record<string, string> {
  const headers: Record<string, string> = {
    Deprecation: 'true',
    Sunset: LEGACY_API_SUNSET,
  };

  if (successor && successor.length > 0) {
    headers.Link = successor.map((path) => `<${path}>; rel="successor-version"`).join(', ');
  }

  return headers;
}

/**
 * Añade los headers de deprecación a una respuesta existente.
 * PRESERVA el status y el body (solo muta los headers).
 */
export function withLegacyDeprecation(res: NextResponse, successor?: string[]): NextResponse {
  const headers = legacyDeprecationHeaders(successor);
  for (const [key, value] of Object.entries(headers)) {
    res.headers.set(key, value);
  }
  return res;
}
