import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NextResponse } from 'next/server';
import {
  LEGACY_API_SUNSET,
  LEGACY_SUCCESSOR,
  legacyDeprecationHeaders,
  withLegacyDeprecation,
} from '@/lib/http/deprecation';

/**
 * Contrato de deprecación de las rutas legacy `/api/agent/*` (Fase 0).
 *
 * - Headers exactos (`Deprecation`, `Sunset`, `Link … rel="successor-version"`).
 * - El `Sunset` es un HTTP-date válido y FUTURO.
 * - Anti-drift: el `Sunset` del código aparece LITERALMENTE en `SDD.md`,
 *   `AGENTS.md` y `skills.md`.
 * - `withLegacyDeprecation` preserva status y body.
 */

describe('deprecación legacy — headers', () => {
  it('expone los headers exactos con un sucesor', () => {
    const headers = legacyDeprecationHeaders(['/api/v1/accounts']);

    expect(headers.Deprecation).toBe('true');
    expect(headers.Sunset).toBe(LEGACY_API_SUNSET);
    expect(headers.Link).toBe('</api/v1/accounts>; rel="successor-version"');
  });

  it('varios sucesores → varios Link separados por ", "', () => {
    const headers = legacyDeprecationHeaders(['/api/v1/expenses', '/api/v1/incomes']);

    expect(headers.Link).toBe(
      '</api/v1/expenses>; rel="successor-version", </api/v1/incomes>; rel="successor-version"'
    );
  });

  it('sin sucesor NO hay header Link (categories no tiene sucesor v1)', () => {
    const headers = legacyDeprecationHeaders(LEGACY_SUCCESSOR.categories);

    expect(headers.Deprecation).toBe('true');
    expect(headers.Sunset).toBe(LEGACY_API_SUNSET);
    expect(headers.Link).toBeUndefined();
    expect('Link' in headers).toBe(false);
  });

  it('sin argumento tampoco hay Link', () => {
    expect(legacyDeprecationHeaders().Link).toBeUndefined();
  });

  it('el mapa de sucesores es el aprobado (summary/transactions/accounts/categories)', () => {
    expect(LEGACY_SUCCESSOR.summary).toEqual(['/api/v1/summary']);
    expect(LEGACY_SUCCESSOR.transactions).toEqual(['/api/v1/expenses', '/api/v1/incomes']);
    expect(LEGACY_SUCCESSOR.accounts).toEqual(['/api/v1/accounts']);
    expect(LEGACY_SUCCESSOR.categories).toEqual([]);
  });
});

describe('deprecación legacy — fecha de retiro', () => {
  it('el Sunset es un HTTP-date válido', () => {
    const parsed = new Date(LEGACY_API_SUNSET);
    expect(Number.isNaN(parsed.getTime())).toBe(false);
    // HTTP-date: "Sun, 14 Feb 2027 00:00:00 GMT"
    expect(LEGACY_API_SUNSET).toBe('Sun, 14 Feb 2027 00:00:00 GMT');
  });

  it('el Sunset es FUTURO', () => {
    expect(new Date(LEGACY_API_SUNSET).getTime()).toBeGreaterThan(Date.now());
  });

  it('ANTI-DRIFT: el Sunset del código aparece literalmente en SDD.md, AGENTS.md y skills.md', () => {
    // Misma convención de path que el resto del suite: relativa a la raíz
    // del repo (`process.cwd()`).
    const sdd = readFileSync(resolve(process.cwd(), 'SDD.md'), 'utf-8');
    const agents = readFileSync(resolve(process.cwd(), 'AGENTS.md'), 'utf-8');
    const skills = readFileSync(resolve(process.cwd(), 'skills.md'), 'utf-8');

    expect(sdd).toContain(LEGACY_API_SUNSET);
    expect(agents).toContain(LEGACY_API_SUNSET);
    expect(skills).toContain(LEGACY_API_SUNSET);
  });
});

describe('deprecación legacy — withLegacyDeprecation', () => {
  it('preserva el status y el body', async () => {
    const original = NextResponse.json({ success: true, count: 3 }, { status: 201 });
    const wrapped = withLegacyDeprecation(original, LEGACY_SUCCESSOR.accounts);

    expect(wrapped.status).toBe(201);
    const body = (await wrapped.json()) as { success: boolean; count: number };
    expect(body).toEqual({ success: true, count: 3 });
  });

  it('preserva también los headers que ya traía la respuesta', () => {
    const original = NextResponse.json({ success: false, error: 'rate_limited' }, { status: 429 });
    original.headers.set('Retry-After', '42');
    original.headers.set('X-RateLimit-Limit', '60');

    const wrapped = withLegacyDeprecation(original, LEGACY_SUCCESSOR.transactions);

    expect(wrapped.status).toBe(429);
    expect(wrapped.headers.get('Retry-After')).toBe('42');
    expect(wrapped.headers.get('X-RateLimit-Limit')).toBe('60');
    expect(wrapped.headers.get('Deprecation')).toBe('true');
    expect(wrapped.headers.get('Sunset')).toBe(LEGACY_API_SUNSET);
    expect(wrapped.headers.get('Link')).toContain('rel="successor-version"');
  });

  it('añade los headers a una respuesta de error (4xx) también', () => {
    const original = NextResponse.json(
      { success: false, error: 'forbidden', message: 'nope' },
      { status: 403 }
    );
    const wrapped = withLegacyDeprecation(original, LEGACY_SUCCESSOR.summary);

    expect(wrapped.status).toBe(403);
    expect(wrapped.headers.get('Deprecation')).toBe('true');
    expect(wrapped.headers.get('Sunset')).toBe(LEGACY_API_SUNSET);
  });
});
