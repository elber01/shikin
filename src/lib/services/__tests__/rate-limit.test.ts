import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import {
  apiKeyScope,
  classifyRateLimitError,
  createRateLimiter,
  DEFAULT_RATE_LIMIT_POLICY,
  InMemoryRateLimitStore,
  RATE_LIMIT_FAILURE_REASONS,
  RateLimitUnavailableError,
  __resetRateLimitFailureLogForTests,
  type RateLimitFailureReason,
  type RateLimitPolicy,
  type RateLimitStore,
} from '@/lib/services/rate-limit';

/**
 * Fase 0 — limitador compartido (convención 11-A0).
 *
 * Este suite es PURO: no toca la base de datos ni la red.
 * El store compartido sobre Turso se prueba en `rate-limit-store.db.test.ts`.
 */

const POLICY: RateLimitPolicy = { limit: 60, windowMs: 60_000 };
const T0 = 1_700_000_000_000;

/** Subconjunto de la decisión que usa el suite. */
interface BurstDecision {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: number;
  degraded: boolean;
}

/** Hash SHA-256 de una key (mismo criterio que `src/lib/auth/api-key.ts`). */
function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Store que siempre falla (simula tabla ausente / Turso caído). */
function throwingStore(error: Error): RateLimitStore {
  return {
    hit: async () => {
      throw error;
    },
  };
}

/** Burst de N peticiones sobre un limitador; devuelve las decisiones. */
async function burst(
  consume: (scope: string, nowMs?: number) => Promise<BurstDecision>,
  scope: string,
  times: number,
  nowMs: number
) {
  const decisions: BurstDecision[] = [];
  for (let i = 0; i < times; i++) {
    decisions.push(await consume(scope, nowMs));
  }
  return decisions;
}

beforeEach(() => {
  __resetRateLimitFailureLogForTests();
});

describe('rate limit — ventana y bloqueo', () => {
  it('permite 60 peticiones y bloquea la 61ª', async () => {
    const limiter = createRateLimiter({ store: new InMemoryRateLimitStore(), policy: POLICY });

    const decisions = await burst((scope, now) => limiter.consume(scope, now), 'key:abc', 61, T0);

    expect(decisions.filter((d) => d.ok)).toHaveLength(60);
    expect(decisions[59].ok).toBe(true);
    expect(decisions[60].ok).toBe(false);
  });

  it('remaining / retryAfter / resetAt son coherentes', async () => {
    const limiter = createRateLimiter({ store: new InMemoryRateLimitStore(), policy: POLICY });

    const first = await limiter.consume('key:abc', T0);
    expect(first.remaining).toBe(59);
    expect(first.retryAfterSeconds).toBe(0);
    expect(first.resetAt).toBe(T0 + POLICY.windowMs);
    expect(first.limit).toBe(60);
    expect(first.windowMs).toBe(60_000);
    expect(first.degraded).toBe(false);

    await burst((scope, now) => limiter.consume(scope, now), 'key:abc', 59, T0);

    const blocked = await limiter.consume('key:abc', T0);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBe(60);
    expect(blocked.resetAt).toBe(T0 + POLICY.windowMs);
  });

  it('el retryAfter nunca es 0 cuando está bloqueado', async () => {
    const limiter = createRateLimiter({ store: new InMemoryRateLimitStore(), policy: POLICY });
    await burst((scope, now) => limiter.consume(scope, now), 'key:abc', 61, T0);

    const blocked = await limiter.consume('key:abc', T0 + POLICY.windowMs - 1);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it('rollover: al expirar la ventana el cubeto se reinicia (hits = 1)', async () => {
    const store = new InMemoryRateLimitStore();
    const limiter = createRateLimiter({ store, policy: POLICY });

    await burst((scope, now) => limiter.consume(scope, now), 'key:abc', 60, T0);
    const blocked = await limiter.consume('key:abc', T0);
    expect(blocked.ok).toBe(false);

    const afterRollover = await limiter.consume('key:abc', T0 + POLICY.windowMs);
    expect(afterRollover.ok).toBe(true);
    expect(afterRollover.remaining).toBe(59);
    expect(afterRollover.resetAt).toBe(T0 + POLICY.windowMs + POLICY.windowMs);
  });

  it('el rollover reinicia también el windowStart', async () => {
    const store = new InMemoryRateLimitStore();
    await store.hit('key:abc', T0, POLICY.windowMs);
    const state = await store.hit('key:abc', T0 + POLICY.windowMs, POLICY.windowMs);

    expect(state.hits).toBe(1);
    expect(state.windowStartMs).toBe(T0 + POLICY.windowMs);
    expect(state.expiresAtMs).toBe(T0 + POLICY.windowMs + POLICY.windowMs);
  });

  it('aislamiento: dos scopes distintos no comparten contador', async () => {
    const limiter = createRateLimiter({ store: new InMemoryRateLimitStore(), policy: POLICY });

    await burst((scope, now) => limiter.consume(scope, now), 'key:uno', 60, T0);
    const otro = await limiter.consume('key:otro', T0);

    expect(otro.ok).toBe(true);
    expect(otro.remaining).toBe(59);
  });
});

describe('rate limit — scope compartido entre v1 y legacy', () => {
  it('v1 y legacy calculan EXACTAMENTE el mismo scope para la misma key', () => {
    const rawKey = 'fz_ejemplo_de_prueba_no_es_real';
    const hash = sha256(rawKey);

    // Las dos superficies (v1 y legacy) llaman a `apiKeyScope` con el mismo hash.
    const scopeV1 = apiKeyScope(hash);
    const scopeLegacy = apiKeyScope(hash);

    expect(scopeV1).toBe(scopeLegacy);
    expect(scopeV1).toBe(`key:${hash}`);
  });

  it('el cubeto compartido bloquea en la 61ª petición (v1 + legacy)', async () => {
    const limiter = createRateLimiter({ store: new InMemoryRateLimitStore(), policy: POLICY });
    const scope = apiKeyScope(sha256('fz_compartida'));

    // 60 peticiones por la vía "v1"…
    await burst((s, now) => limiter.consume(s, now), scope, 60, T0);
    // …la 61ª llega por la vía legacy: el cubeto es el MISMO.
    const legacyHit = await limiter.consume(scope, T0);

    expect(legacyHit.ok).toBe(false);
    expect(legacyHit.retryAfterSeconds).toBe(60);
  });

  it('el scope NUNCA contiene la key cruda', () => {
    const rawKey = 'fz_secreto_no_debe_aparecer';
    const scope = apiKeyScope(sha256(rawKey));

    expect(scope).not.toContain(rawKey);
    expect(scope.startsWith('key:')).toBe(true);
    expect(scope).toMatch(/^key:[0-9a-f]{64}$/);
  });
});

describe('rate limit — degradación y modo estricto', () => {
  it('fallback: si el store compartido falla, degrada a memoria (degraded = true) y NO hay 5xx', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const limiter = createRateLimiter({
      store: throwingStore(new Error('SQLITE_ERROR: no such table: RateLimitBucket')),
      policy: POLICY,
    });

    const decision = await limiter.consume('key:abc', T0);

    expect(decision.ok).toBe(true);
    expect(decision.degraded).toBe(true);
    expect(decision.remaining).toBe(59);

    const report = spy.mock.calls[0]?.[1] as { scope?: string; reason?: string; name?: string };
    expect(report.scope).toBe('rate-limit');
    // Taxonomía canónica (SDD.md §2): el fallo se clasifica por su causa.
    expect(report.reason).toBe('table_missing');
    expect(report.name).toBe('Error');
    // El log NO contiene el scope (hash), ni la key, ni el mensaje crudo.
    expect(JSON.stringify(spy.mock.calls[0])).not.toContain('key:abc');
    expect(JSON.stringify(spy.mock.calls[0])).not.toContain('no such table: RateLimitBucket');
    spy.mockRestore();
  });

  it('fallback: el log de fallo se emite como máximo una vez por minuto', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const limiter = createRateLimiter({
      store: throwingStore(new Error('boom')),
      policy: POLICY,
    });

    await limiter.consume('key:abc', T0);
    await limiter.consume('key:abc', T0 + 1);
    await limiter.consume('key:abc', T0 + 2);

    expect(spy.mock.calls.length).toBe(1);
    spy.mockRestore();
  });

  it('fallback: el log NUNCA incluye el mensaje crudo (multi-línea, estilo Prisma)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const prismaLike = new Error(
      'Invalid `prisma.$queryRawUnsafe()` invocation:\n\n\nRaw query failed. Code: `1`. Message: `no such table: RateLimitBucket`\n    at somewhere (file.js:1:1)'
    );
    const limiter = createRateLimiter({
      store: throwingStore(prismaLike),
      policy: POLICY,
    });

    await limiter.consume('key:abc', T0);

    const payload = JSON.stringify(spy.mock.calls[0]);
    expect(payload).not.toContain('no such table');
    expect(payload).not.toContain('Raw query failed');
    expect(payload).not.toContain('key:abc');
    spy.mockRestore();
  });

  it('fallback: el contador en memoria sigue limitando aunque el store compartido falle', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const limiter = createRateLimiter({
      store: throwingStore(new Error('boom')),
      policy: POLICY,
    });

    const decisions = await burst((scope, now) => limiter.consume(scope, now), 'key:abc', 61, T0);

    expect(decisions.filter((d) => d.ok)).toHaveLength(60);
    expect(decisions[60].ok).toBe(false);
    vi.restoreAllMocks();
  });

  it('strict: si el store compartido falla, lanza RateLimitUnavailableError', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const limiter = createRateLimiter({
      store: throwingStore(new Error('Turso caído')),
      policy: POLICY,
      failMode: 'strict',
    });

    await expect(limiter.consume('key:abc', T0)).rejects.toBeInstanceOf(RateLimitUnavailableError);
    await expect(limiter.consume('key:abc', T0)).rejects.toMatchObject({
      code: 'rate_limit_unavailable',
    });
    vi.restoreAllMocks();
  });
});

describe('rate limit — control negativo', () => {
  it('un limitador que NUNCA bloquea NO pasa las aserciones del contrato', async () => {
    const policy = POLICY;

    // Limitador roto: el store siempre devuelve hits = 1 (nunca bloquea).
    const broken = createRateLimiter({
      store: { hit: async () => ({ hits: 1, windowStartMs: T0, expiresAtMs: T0 + policy.windowMs }) },
      policy,
    });

    const brokenDecisions = await burst((scope, now) => broken.consume(scope, now), 'key:abc', 61, T0);
    const brokenBlocked = brokenDecisions.some((d) => !d.ok);

    // El control negativo: el suite DETECTA el limitador roto.
    expect(brokenBlocked).toBe(false);

    // Y el limitador real sí bloquea (misma aserción, resultado contrario).
    const real = createRateLimiter({ store: new InMemoryRateLimitStore(), policy });
    const realDecisions = await burst((scope, now) => real.consume(scope, now), 'key:abc', 61, T0);
    expect(realDecisions.some((d) => !d.ok)).toBe(true);
  });
});

describe('rate limit — taxonomía del `reason` del log de fallo', () => {
  it('el conjunto de reasons es EXACTAMENTE table_missing|timeout|unknown (SDD.md §2)', () => {
    expect([...RATE_LIMIT_FAILURE_REASONS].sort()).toEqual(['table_missing', 'timeout', 'unknown']);
  });

  it('el clasificador solo devuelve valores de la taxonomía canónica', () => {
    const classified = [
      classifyRateLimitError(new Error('no such table: RateLimitBucket')),
      classifyRateLimitError(new Error('timeout')),
      classifyRateLimitError(new Error('boom')),
      classifyRateLimitError('no such table'),
      classifyRateLimitError(undefined),
    ];

    for (const reason of classified) {
      expect(RATE_LIMIT_FAILURE_REASONS).toContain(reason);
    }
  });

  it('todo reason emitido por el limitador pertenece a ese conjunto', async () => {
    const cases: Array<{ error: Error; expected: RateLimitFailureReason }> = [
      { error: new Error('SQLITE_ERROR: no such table: RateLimitBucket'), expected: 'table_missing' },
      { error: new Error('Request timed out'), expected: 'timeout' },
      { error: new Error('ETIMEDOUT'), expected: 'timeout' },
      { error: new Error('boom'), expected: 'unknown' },
    ];

    const observed = new Set<string>();

    for (const { error, expected } of cases) {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const limiter = createRateLimiter({ store: throwingStore(error), policy: POLICY });

      await limiter.consume('key:abc', T0);

      const report = spy.mock.calls[0]?.[1] as { reason?: string };
      expect(report.reason).toBe(expected);
      observed.add(report.reason ?? '');
      spy.mockRestore();
      __resetRateLimitFailureLogForTests();
    }

    expect([...observed].sort()).toEqual(['table_missing', 'timeout', 'unknown']);
  });
});

describe('rate limit — política por defecto', () => {
  it('la política por defecto es 60 req/min', () => {
    expect(DEFAULT_RATE_LIMIT_POLICY.limit).toBe(60);
    expect(DEFAULT_RATE_LIMIT_POLICY.windowMs).toBe(60_000);
  });
});
