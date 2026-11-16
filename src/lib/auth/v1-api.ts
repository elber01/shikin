/**
 * v1 Public API — API key authentication + shared rate limiting
 * ------------------------------------------------------------------
 * These helpers are used by all /api/v1/* endpoints AND by the legacy
 * /api/agent/* endpoints (deprecated, but still operating).
 *
 * Unlike the in-app routes (which use NextAuth sessions), the v1 routes
 * authenticate via API key. The key is sent in either:
 *   - `X-API-Key: fz_<...>`        (preferred)
 *   - `Authorization: Bearer fz_<...>`  (accepted)
 *
 * The key is validated against the ApiKey table (SHA-256 hash), and the
 * associated userId is returned so the endpoint can scope all queries
 * to that user — exactly as if the user were logged in.
 *
 * SECURITY RULES ENFORCED HERE:
 * 1. The API key string is NEVER logged. We only log the keyPrefix for audit.
 * 2. Rate limiting: 60 requests/minute per key over the SHARED store
 *    (Turso/libSQL — `src/lib/services/rate-limit-store.ts`). If the shared
 *    store is unavailable, the limiter degrades to the in-memory counter
 *    (never a 5xx); with `FINZEN_RATE_LIMIT_FAIL_MODE=strict` it answers
 *    503 `rate_limit_unavailable` instead.
 * 3. Expired or deactivated keys → 401 Unauthorized.
 * 4. Keys without `write` permission cannot mutate data (403).
 */

import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { validateApiKey, hasPermission, type ApiKeyUser } from './api-key';
import {
  apiKeyScope,
  createRateLimiter,
  DEFAULT_RATE_LIMIT_POLICY,
  InMemoryRateLimitStore,
  RateLimitUnavailableError,
  type RateLimitDecision,
  type RateLimitFailMode,
  type RateLimitPolicy,
  type RateLimitStore,
} from '@/lib/services/rate-limit';
import { createSharedRateLimitStore } from '@/lib/services/rate-limit-store';

// ─────────────────────────────────────────────────────────────
// Rate limiter — store compartido (Turso/libSQL) + fallback en memoria
// ─────────────────────────────────────────────────────────────

/**
 * Store COMPARTIDO: la autoridad del cubeto (tabla `RateLimitBucket`).
 * Un `Map` en memoria NUNCA es la autoridad (AGENTS.md §5 — 11-A0).
 */
const sharedRateLimitStore: RateLimitStore = createSharedRateLimitStore();

/** Fallback degradado (contador en memoria del proceso). */
const fallbackRateLimitStore = new InMemoryRateLimitStore();

// ─────────────────────────────────────────────────────────────
// Public helper: authenticate + rate-limit a v1 request
// ─────────────────────────────────────────────────────────────

export interface V1AuthResult {
  ok: boolean;
  user?: ApiKeyUser;
  /** Hash of the key — used as the rate-limit identifier (never logged raw) */
  keyHash?: string;
  response?: NextResponse;
  /** Decisión del limitador (presente cuando la key es válida). */
  rateLimit?: RateLimitDecision;
}

/** Opciones de `authenticateV1Request` (inyección para tests). */
export interface V1AuthOptions {
  /** Store alternativo (tests). Por defecto: el store compartido. */
  store?: RateLimitStore;
  /** Política alternativa (tests). Por defecto: 60 req/min. */
  policy?: RateLimitPolicy;
}

function extractApiKey(req: Request): string | null {
  // 1. X-API-Key header (preferred)
  const xKey = req.headers.get('x-api-key');
  if (xKey) return xKey.trim();

  // 2. Authorization: Bearer fz_...
  const auth = req.headers.get('authorization');
  if (auth) {
    return auth.replace(/^Bearer\s+/i, '').trim();
  }

  return null;
}

/** Modo de fallo del limitador (env). Por defecto: degradar a memoria. */
function resolveFailMode(): RateLimitFailMode {
  return process.env.FINZEN_RATE_LIMIT_FAIL_MODE === 'strict' ? 'strict' : 'fallback';
}

/**
 * Consume un hit del cubeto de la key.
 * El scope es `key:<sha256>`: **idéntico** en v1 y en las rutas legacy.
 */
async function consumeRateLimit(keyHash: string, opts: V1AuthOptions): Promise<RateLimitDecision> {
  const limiter = createRateLimiter({
    store: opts.store ?? sharedRateLimitStore,
    fallbackStore: fallbackRateLimitStore,
    policy: opts.policy ?? DEFAULT_RATE_LIMIT_POLICY,
    failMode: resolveFailMode(),
  });
  return limiter.consume(apiKeyScope(keyHash));
}

/**
 * Authenticate a v1 request and apply rate limiting.
 * Returns `ok: true` with the user info if valid; otherwise returns
 * `ok: false` with a ready-to-send error `response`.
 */
export async function authenticateV1Request(
  req: Request,
  opts: V1AuthOptions = {}
): Promise<V1AuthResult> {
  const rawKey = extractApiKey(req);

  if (!rawKey) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'missing_api_key', message: 'Provide an API key via X-API-Key or Authorization: Bearer' },
        { status: 401 }
      ),
    };
  }

  // Validate against DB
  const user = await validateApiKey(rawKey);
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'invalid_api_key', message: 'API key is invalid, expired, or revoked' },
        { status: 401 }
      ),
    };
  }

  // Compute hash for rate-limit identifier (never log the raw key)
  const keyHash = createHash('sha256').update(rawKey).digest('hex');

  // Rate limit (store compartido; degrada a memoria si el store falla)
  let decision: RateLimitDecision;
  try {
    decision = await consumeRateLimit(keyHash, opts);
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) {
      return {
        ok: false,
        response: NextResponse.json(
          { success: false, error: 'rate_limit_unavailable', message: 'Rate limiter temporarily unavailable' },
          { status: 503 }
        ),
      };
    }
    throw error;
  }

  if (!decision.ok) {
    return {
      ok: false,
      rateLimit: decision,
      response: NextResponse.json(
        { success: false, error: 'rate_limited', message: `Too many requests. Retry in ${decision.retryAfterSeconds}s.` },
        {
          status: 429,
          headers: {
            'Retry-After': String(decision.retryAfterSeconds),
            'X-RateLimit-Limit': String(decision.limit),
            'X-RateLimit-Window': `${Math.round(decision.windowMs / 1000)}s`,
            'X-RateLimit-Remaining': String(decision.remaining),
            'X-RateLimit-Reset': String(Math.floor(decision.resetAt / 1000)),
          },
        }
      ),
    };
  }

  return { ok: true, user, keyHash, rateLimit: decision };
}

export { hasPermission };
