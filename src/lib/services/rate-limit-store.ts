/**
 * Rate limit compartido sobre Turso/libSQL (Fase 0 — convención 11-A0).
 * ------------------------------------------------------------------
 * Implementación del contrato `RateLimitStore` contra la tabla
 * `RateLimitBucket` (1 fila por principal).
 *
 * POR QUÉ SQL CRUDO Y NO `prisma.upsert()`:
 * `upsert()` es un read-modify-write (lee la fila, calcula en JS y
 * escribe) → con peticiones concurrentes se PIERDEN incrementos.
 * La sentencia `INSERT … ON CONFLICT DO UPDATE … RETURNING` es ATÓMICA:
 * el motor resuelve el conflicto y devuelve el valor ya incrementado.
 *
 * SEGURIDAD:
 * - El `id` es el *scope* (`key:<sha256>`), NUNCA la key en claro.
 * - Los fallos se registran SANEADOS: `{ scope, reason, name }` + el stack
 *   sin su primera línea. Nunca el scope, ni la key, ni el mensaje crudo.
 * - Si el almacén no responde, el limitador degrada al fallback en
 *   memoria (nunca 5xx) salvo modo `strict`.
 */

import { db } from '@/lib/db';
import {
  classifyRateLimitError,
  reportRateLimitFailure,
  type RateLimitScope,
  type RateLimitStore,
  type RateLimitWindowState,
} from './rate-limit';

/** Fila de `RateLimitBucket` tal y como la devuelve el motor. */
interface BucketRow {
  hits: number | bigint;
  windowStartMs: number | bigint;
  expiresAtMs: number | bigint;
}

/**
 * Cliente mínimo de Prisma usado por el store (permite inyectar un fake
 * en tests sin depender del cliente real).
 */
export interface RateLimitRawClient {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
}

/**
 * Sentencia ATÓMICA (una sola) — ventana fija anclada al primer hit.
 *
 * Orden de los parámetros posicionales:
 *   1. id           = scope
 *   2. windowStart  = now
 *   3. expiresAt    = now + windowMs
 *   4. updatedAt    = now
 *   5. now          (condición de expirado de `hits`)
 *   6. now          (condición de expirado de `windowStartMs`)
 *   7. now          (nuevo `windowStartMs`)
 *   8. now          (condición de expirado de `expiresAtMs`)
 *   9. now + windowMs (nuevo `expiresAtMs`)
 *  10. now          (`updatedAtMs`)
 */
const UPSERT_RETURNING_SQL = `INSERT INTO "RateLimitBucket" ("id","hits","windowStartMs","expiresAtMs","updatedAtMs")
VALUES (?, 1, ?, ?, ?)
ON CONFLICT("id") DO UPDATE SET
  "hits"          = CASE WHEN "expiresAtMs" <= ? THEN 1 ELSE "hits" + 1 END,
  "windowStartMs" = CASE WHEN "expiresAtMs" <= ? THEN ? ELSE "windowStartMs" END,
  "expiresAtMs"   = CASE WHEN "expiresAtMs" <= ? THEN ? ELSE "expiresAtMs" END,
  "updatedAtMs"   = ?
RETURNING "hits", "windowStartMs", "expiresAtMs"`;

/** Plan B: el mismo upsert SIN `RETURNING` (motores que no lo soportan). */
const UPSERT_SQL = `INSERT INTO "RateLimitBucket" ("id","hits","windowStartMs","expiresAtMs","updatedAtMs")
VALUES (?, 1, ?, ?, ?)
ON CONFLICT("id") DO UPDATE SET
  "hits"          = CASE WHEN "expiresAtMs" <= ? THEN 1 ELSE "hits" + 1 END,
  "windowStartMs" = CASE WHEN "expiresAtMs" <= ? THEN ? ELSE "windowStartMs" END,
  "expiresAtMs"   = CASE WHEN "expiresAtMs" <= ? THEN ? ELSE "expiresAtMs" END,
  "updatedAtMs"   = ?`;

/** Lectura conservadora del plan B (siempre ≥ nuestro propio incremento). */
const SELECT_SQL = `SELECT "hits", "windowStartMs", "expiresAtMs" FROM "RateLimitBucket" WHERE "id" = ?`;

/** ¿El error es "este motor no soporta RETURNING"? */
function isReturningUnsupported(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const lower = message.toLowerCase();
  if (lower.includes('no such table')) return false;
  return lower.includes('returning') || lower.includes('syntax error');
}

/** Normaliza los tipos del motor (SQLite/Turso pueden devolver bigint). */
function toWindowState(row: BucketRow | undefined): RateLimitWindowState {
  if (!row) {
    throw new Error('RateLimitBucket: la sentencia no devolvió ninguna fila');
  }
  return {
    hits: Number(row.hits),
    windowStartMs: Number(row.windowStartMs),
    expiresAtMs: Number(row.expiresAtMs),
  };
}

/**
 * Store compartido sobre Turso/libSQL (también sirve para un SQLite
 * local: la sentencia es ANSI-compatible con SQLite 3.35+).
 */
export class TursoRateLimitStore implements RateLimitStore {
  private supportsReturning = true;

  constructor(private readonly client: RateLimitRawClient = db) {}

  async hit(scope: RateLimitScope, nowMs: number, windowMs: number): Promise<RateLimitWindowState> {
    const expiresAtMs = nowMs + windowMs;
    const params: unknown[] = [
      scope, // id
      nowMs, // windowStartMs
      expiresAtMs, // expiresAtMs
      nowMs, // updatedAtMs
      nowMs, // condición hits
      nowMs, // condición windowStartMs
      nowMs, // nuevo windowStartMs
      nowMs, // condición expiresAtMs
      expiresAtMs, // nuevo expiresAtMs
      nowMs, // updatedAtMs
    ];

    if (this.supportsReturning) {
      try {
        const rows = await this.client.$queryRawUnsafe<BucketRow[]>(
          UPSERT_RETURNING_SQL,
          ...params
        );
        return toWindowState(rows[0]);
      } catch (error) {
        if (!isReturningUnsupported(error)) throw this.reportFailure(error);
        // El motor no soporta RETURNING → plan B para las siguientes llamadas.
        this.supportsReturning = false;
      }
    }

    try {
      await this.client.$executeRawUnsafe(UPSERT_SQL, ...params);
      const rows = await this.client.$queryRawUnsafe<BucketRow[]>(SELECT_SQL, scope);
      return toWindowState(rows[0]);
    } catch (error) {
      throw this.reportFailure(error);
    }
  }

  /**
   * Clasifica y registra el fallo (saneado, 1 log/minuto) y lo re-lanza
   * para que el limitador decida (degradar o 503).
   */
  private reportFailure(error: unknown): unknown {
    reportRateLimitFailure(classifyRateLimitError(error), error);
    return error;
  }
}

/**
 * Fábrica del store compartido (Turso/libSQL).
 * La instancia se mantiene a nivel de módulo para que el store pueda
 * recordar si el motor soporta `RETURNING`.
 */
export function createSharedRateLimitStore(): RateLimitStore {
  return new TursoRateLimitStore();
}
