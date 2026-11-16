import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { db } from '@/lib/db';
import { TursoRateLimitStore } from '@/lib/services/rate-limit-store';
import { InMemoryRateLimitStore, apiKeyScope } from '@/lib/services/rate-limit';

/**
 * Fase 0 — store COMPARTIDO del rate limit contra una BD REAL (temporal).
 *
 * La BD de test la monta `tests/global-setup.ts` (SQLite temporal en
 * `os.tmpdir()`, BORRADA al terminar). Ni `db/custom.db` ni Turso son
 * alcanzables desde este suite.
 *
 * Lo que se demuestra aquí:
 * - la tabla `RateLimitBucket` existe en el esquema;
 * - la sentencia es ATÓMICA (25 incrementos concurrentes ⇒ 25 hits);
 * - el rollover de ventana es real (no simulado);
 * - el `id` almacenado es el scope (`key:<64-hex>`), nunca la key cruda;
 * - PARIDAD DE CONTRATO con el store en memoria.
 */

const WINDOW_MS = 60_000;
const T0 = 1_700_000_000_000;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

describe('rate limit — store compartido (BD temporal)', () => {
  beforeAll(async () => {
    // La tabla se crea desde el DDL de `prisma/schema.prisma` (global-setup).
    // Las columnas de tiempo son BIGINT (epoch-ms no cabe en Int32), igual
    // que en `prisma/schema.prisma` y `scripts/migrate-rate-limit-table.ts`.
    await db.$executeRawUnsafe(
      'CREATE TABLE IF NOT EXISTS "RateLimitBucket" ("id" TEXT NOT NULL PRIMARY KEY, "hits" INTEGER NOT NULL DEFAULT 0, "windowStartMs" BIGINT NOT NULL, "expiresAtMs" BIGINT NOT NULL, "updatedAtMs" BIGINT NOT NULL)'
    );
    await db.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "RateLimitBucket_expiresAtMs_idx" ON "RateLimitBucket"("expiresAtMs")'
    );
  });

  afterAll(async () => {
    await db.$executeRawUnsafe('DELETE FROM "RateLimitBucket"');
    await db.$disconnect();
    Reflect.deleteProperty(globalThis, 'prisma');
  });

  it('la tabla RateLimitBucket existe en la BD temporal', async () => {
    const rows = await db.$queryRawUnsafe<Array<{ name: string }>>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='RateLimitBucket'"
    );
    expect(rows).toHaveLength(1);
  });

  it('las columnas BIGINT se guardan con typeof = integer (SQLite no distingue)', async () => {
    const store = new TursoRateLimitStore();
    const scope = apiKeyScope(sha256('fz_bigint'));
    await db.$executeRawUnsafe('DELETE FROM "RateLimitBucket" WHERE "id" = ?', scope);

    await store.hit(scope, T0, WINDOW_MS);

    const rows = await db.$queryRawUnsafe<
      Array<{ windowStartType: string; expiresAtType: string; updatedAtType: string }>
    >(
      'SELECT typeof("windowStartMs") AS windowStartType, typeof("expiresAtMs") AS expiresAtType, typeof("updatedAtMs") AS updatedAtType FROM "RateLimitBucket" WHERE "id" = ?',
      scope
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].windowStartType).toBe('integer');
    expect(rows[0].expiresAtType).toBe('integer');
    expect(rows[0].updatedAtType).toBe('integer');
  });

  it('25 incrementos concurrentes ⇒ hits = 25 (sentencia atómica)', async () => {
    const store = new TursoRateLimitStore();
    const scope = apiKeyScope(sha256('fz_concurrencia'));
    await db.$executeRawUnsafe('DELETE FROM "RateLimitBucket" WHERE "id" = ?', scope);

    const results = await Promise.all(
      Array.from({ length: 25 }, () => store.hit(scope, T0, WINDOW_MS))
    );

    // Cada sentencia ve el contador YA incrementado (atómica): el conjunto
    // de valores devueltos es exactamente 1..25 (sin huecos ni duplicados).
    const observed = results.map((state) => state.hits).sort((a, b) => a - b);
    expect(observed).toEqual(Array.from({ length: 25 }, (_, index) => index + 1));

    for (const state of results) {
      expect(state.windowStartMs).toBe(T0);
      expect(state.expiresAtMs).toBe(T0 + WINDOW_MS);
    }

    const rows = await db.$queryRawUnsafe<Array<{ hits: number }>>(
      'SELECT "hits" FROM "RateLimitBucket" WHERE "id" = ?',
      scope
    );
    expect(Number(rows[0].hits)).toBe(25);
  });

  it('rollover real: al expirar la ventana el cubeto se reinicia', async () => {
    const store = new TursoRateLimitStore();
    const scope = apiKeyScope(sha256('fz_rollover'));
    await db.$executeRawUnsafe('DELETE FROM "RateLimitBucket" WHERE "id" = ?', scope);

    await store.hit(scope, T0, WINDOW_MS);
    const second = await store.hit(scope, T0 + 1_000, WINDOW_MS);
    expect(second.hits).toBe(2);
    expect(second.windowStartMs).toBe(T0);
    expect(second.expiresAtMs).toBe(T0 + WINDOW_MS);

    const afterRollover = await store.hit(scope, T0 + WINDOW_MS, WINDOW_MS);
    expect(afterRollover.hits).toBe(1);
    expect(afterRollover.windowStartMs).toBe(T0 + WINDOW_MS);
    expect(afterRollover.expiresAtMs).toBe(T0 + WINDOW_MS + WINDOW_MS);
  });

  it('el id almacenado es `key:<64-hex>` y NUNCA la key cruda', async () => {
    const store = new TursoRateLimitStore();
    const rawKey = 'fz_clave_cruda_que_no_debe_persistirse';
    const scope = apiKeyScope(sha256(rawKey));
    await db.$executeRawUnsafe('DELETE FROM "RateLimitBucket" WHERE "id" = ?', scope);

    await store.hit(scope, T0, WINDOW_MS);

    const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(
      'SELECT "id" FROM "RateLimitBucket" WHERE "id" = ?',
      scope
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(scope);
    expect(rows[0].id).toMatch(/^key:[0-9a-f]{64}$/);
    expect(rows[0].id).not.toContain(rawKey);

    // Ninguna fila de la tabla contiene la key cruda.
    const all = await db.$queryRawUnsafe<Array<{ id: string }>>('SELECT "id" FROM "RateLimitBucket"');
    expect(all.map((r) => r.id).join('|')).not.toContain(rawKey);
  });

  it('paridad de contrato: memoria y Turso producen el mismo estado', async () => {
    const memory = new InMemoryRateLimitStore();
    const shared = new TursoRateLimitStore();
    const memoryScope = apiKeyScope(sha256('fz_paridad_memoria'));
    const sharedScope = apiKeyScope(sha256('fz_paridad_turso'));
    await db.$executeRawUnsafe('DELETE FROM "RateLimitBucket" WHERE "id" = ?', sharedScope);

    const timeline = [T0, T0 + 1_000, T0 + 2_000, T0 + WINDOW_MS, T0 + WINDOW_MS + 5_000];

    for (const timestamp of timeline) {
      const inMemory = await memory.hit(memoryScope, timestamp, WINDOW_MS);
      const inTurso = await shared.hit(sharedScope, timestamp, WINDOW_MS);

      expect(inTurso.hits).toBe(inMemory.hits);
      expect(inTurso.windowStartMs).toBe(inMemory.windowStartMs);
      expect(inTurso.expiresAtMs).toBe(inMemory.expiresAtMs);
    }
  });
});
