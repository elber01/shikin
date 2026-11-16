/**
 * Rate limit compartido (Fase 0 — convención 11-A0).
 * ------------------------------------------------------------------
 * Módulo PURO: no importa la base de datos ni ningún módulo de Next.
 * Solo define los contratos, el limitador y el *fallback* en memoria.
 *
 * REGLAS (AGENTS.md §5 — "Rate limit compartido y rutas legacy"):
 * - Un `Map` en memoria NUNCA es la autoridad: es el *fallback* degradado
 *   cuando el almacén compartido no responde.
 * - El identificador del cubeto es el hash SHA-256 de la key
 *   (`key:<sha256-hex>`), NUNCA la key cruda.
 * - El MISMO scope lo usan `/api/v1/*` y las rutas legacy `/api/agent/*`.
 * - Si el almacén compartido falla: se degrada al contador en memoria
 *   (nunca 5xx) salvo que `failMode = 'strict'` (exposición MCP).
 *
 * La ventana es FIJA y anclada al primer hit de cada cubeto: cuando la
 * ventana expira, el siguiente hit reinicia el cubeto (hits = 1).
 */

/** Política por defecto: 60 peticiones por minuto y por API key. */
export interface RateLimitPolicy {
  limit: number;
  windowMs: number;
}

export const DEFAULT_RATE_LIMIT_POLICY: RateLimitPolicy = { limit: 60, windowMs: 60_000 };

/**
 * Identificador opaco del cubeto. P. ej. `key:<sha256-hex-64>`.
 * El scope puede contener otros prefijos (`user:<id>`, `session:<id>`),
 * pero NUNCA una credencial en claro.
 */
export type RateLimitScope = string;

/** Construye el scope de un cubeto de API key a partir del hash SHA-256. */
export function apiKeyScope(keyHash: string): RateLimitScope {
  return `key:${keyHash}`;
}

/** Estado de la ventana vigente de un cubeto. */
export interface RateLimitWindowState {
  hits: number;
  windowStartMs: number;
  expiresAtMs: number;
}

/**
 * Almacén de contadores. La implementación de referencia es el store
 * compartido sobre Turso/libSQL (`rate-limit-store.ts`); esta interfaz
 * permite enchufar un fake en tests o un almacén distinto.
 */
export interface RateLimitStore {
  /**
   * Registra un hit de forma ATÓMICA (concurrente) y devuelve el estado
   * de la ventana vigente.
   */
  hit(scope: RateLimitScope, nowMs: number, windowMs: number): Promise<RateLimitWindowState>;
}

/** Qué hacer cuando el almacén compartido no responde. */
export type RateLimitFailMode = 'fallback' | 'strict';

/** Decisión del limitador para una petición concreta. */
export interface RateLimitDecision {
  ok: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: number;
  windowMs: number;
  scope: RateLimitScope;
  /** `true` ⇒ el almacén compartido falló y se usó el fallback en memoria. */
  degraded: boolean;
}

/** Limitador de peticiones. */
export interface RateLimiter {
  consume(scope: RateLimitScope, nowMs?: number): Promise<RateLimitDecision>;
}

/** Error que se lanza en modo `strict` cuando el almacén no responde. */
export class RateLimitUnavailableError extends Error {
  readonly code = 'rate_limit_unavailable';

  constructor(message = 'Rate limiter temporarily unavailable') {
    super(message);
    this.name = 'RateLimitUnavailableError';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Logging saneado
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Motivos de fallo registrados (sin datos personales ni credenciales).
 *
 * TAXONOMÍA ÚNICA (SDD.md §2): el conjunto de valores que puede
 * aparecer en un log del limitador es EXACTAMENTE
 * `table_missing | timeout | unknown`. No existe un valor "genérico"
 * propio del limitador: el store compartido y el limitador clasifican
 * el fallo con la MISMA función (`classifyRateLimitError`), así el log
 * nunca contradice la spec.
 */
export const RATE_LIMIT_FAILURE_REASONS = ['table_missing', 'timeout', 'unknown'] as const;

export type RateLimitFailureReason = (typeof RATE_LIMIT_FAILURE_REASONS)[number];

/** Cadencia máxima del log de fallo: 1 por proceso y minuto. */
const FAILURE_LOG_INTERVAL_MS = 60_000;
let lastFailureLogAtMs = 0;

/** Clasifica el error del almacén compartido sin propagar su mensaje. */
export function classifyRateLimitError(error: unknown): RateLimitFailureReason {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const lower = message.toLowerCase();
  if (lower.includes('no such table')) return 'table_missing';
  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('etimedout')) {
    return 'timeout';
  }
  return 'unknown';
}

/**
 * Stack sin el mensaje crudo.
 *
 * `error-report.ts` descarta la primera línea (que contiene el mensaje).
 * Los errores de Prisma, en cambio, llevan el mensaje en VARIAS líneas
 * ("Invalid `prisma...` invocation:" + "Raw query failed…"), así que aquí
 * se conservan SOLO las líneas de stack (`    at …`).
 */
function stackWithoutMessage(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;
  const stack = error.stack;
  if (!stack) return undefined;
  const lines = stack.split('\n');
  const firstFrame = lines.findIndex((line) => /^\s*at\s/.test(line));
  const frames = firstFrame >= 0 ? lines.slice(firstFrame) : lines.slice(1);
  if (frames.length === 0) return undefined;
  return frames.join('\n');
}

/**
 * Registra un fallo del limitador SIN datos sensibles:
 * solo `{ scope, reason, name }` + el stack sin su primera línea.
 * Nunca el scope del cubeto (contiene el hash), ni la key, ni el mensaje.
 *
 * Cadencia: máximo 1 log por proceso y minuto.
 */
export function reportRateLimitFailure(reason: RateLimitFailureReason, error: unknown): void {
  const now = Date.now();
  if (now - lastFailureLogAtMs < FAILURE_LOG_INTERVAL_MS) return;
  lastFailureLogAtMs = now;

  const stack = stackWithoutMessage(error);
  const report = {
    scope: 'rate-limit' as const,
    reason,
    name: error instanceof Error ? error.name : 'UnknownError',
    ...(stack ? { stack } : {}),
  };
  console.error('[shikin:rate-limit]', report);
}

/**
 * Reinicia la cadencia del log de fallos.
 * SOLO para tests (evita depender del reloj entre suites).
 */
export function __resetRateLimitFailureLogForTests(): void {
  lastFailureLogAtMs = 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fallback en memoria
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Store en memoria: SOLO como *fallback* degradado (nunca la autoridad).
 * Aplica exactamente la misma semántica de ventana que el store SQL:
 * si la ventana expiró, el hit reinicia el cubeto (hits = 1) con una
 * ventana nueva; si no, incrementa los hits conservando la ventana.
 */
export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<RateLimitScope, RateLimitWindowState>();

  async hit(scope: RateLimitScope, nowMs: number, windowMs: number): Promise<RateLimitWindowState> {
    const current = this.buckets.get(scope);

    if (!current || current.expiresAtMs <= nowMs) {
      // GC perezoso: los cubetos caducados se recogen al insertar (sin temporizador).
      this.collectGarbage(nowMs);
      const fresh: RateLimitWindowState = {
        hits: 1,
        windowStartMs: nowMs,
        expiresAtMs: nowMs + windowMs,
      };
      this.buckets.set(scope, fresh);
      return { ...fresh };
    }

    const next: RateLimitWindowState = {
      hits: current.hits + 1,
      windowStartMs: current.windowStartMs,
      expiresAtMs: current.expiresAtMs,
    };
    this.buckets.set(scope, next);
    return { ...next };
  }

  /** Nº de cubetos vivos (diagnóstico y tests). */
  get size(): number {
    return this.buckets.size;
  }

  private collectGarbage(nowMs: number): void {
    for (const [scope, state] of this.buckets) {
      if (state.expiresAtMs <= nowMs) this.buckets.delete(scope);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Limitador
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crea un limitador sobre un almacén enchufable.
 *
 * - Si el almacén lanza: en modo `fallback` se usa el `fallbackStore`
 *   (por defecto, un `InMemoryRateLimitStore`) y la decisión sale con
 *   `degraded: true` (nunca 5xx). En modo `strict` se lanza
 *   `RateLimitUnavailableError` (el route responde 503).
 */
export function createRateLimiter(opts: {
  store: RateLimitStore;
  fallbackStore?: RateLimitStore;
  policy?: RateLimitPolicy;
  failMode?: RateLimitFailMode;
  now?: () => number;
}): RateLimiter {
  const policy = opts.policy ?? DEFAULT_RATE_LIMIT_POLICY;
  const fallbackStore = opts.fallbackStore ?? new InMemoryRateLimitStore();
  const failMode = opts.failMode ?? 'fallback';
  const now = opts.now ?? (() => Date.now());

  return {
    async consume(scope: RateLimitScope, nowMs?: number): Promise<RateLimitDecision> {
      const timestamp = nowMs ?? now();
      let degraded = false;
      let state: RateLimitWindowState;

      try {
        state = await opts.store.hit(scope, timestamp, policy.windowMs);
      } catch (error) {
        // El `reason` es el de la taxonomía canónica (SDD.md §2):
        // `table_missing | timeout | unknown`. El store compartido ya
        // clasifica y registra el fallo con la MISMA función; la cadencia
        // de 1 log/minuto evita el doble registro.
        reportRateLimitFailure(classifyRateLimitError(error), error);
        if (failMode === 'strict') {
          throw new RateLimitUnavailableError();
        }
        state = await fallbackStore.hit(scope, timestamp, policy.windowMs);
        degraded = true;
      }

      const hits = state.hits;
      const ok = hits <= policy.limit;
      const remaining = Math.max(0, policy.limit - hits);
      const retryAfterSeconds = ok
        ? 0
        : Math.max(1, Math.ceil((state.expiresAtMs - timestamp) / 1000));

      return {
        ok,
        limit: policy.limit,
        remaining,
        retryAfterSeconds,
        resetAt: state.expiresAtMs,
        windowMs: policy.windowMs,
        scope,
        degraded,
      };
    },
  };
}
