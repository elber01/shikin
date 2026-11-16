#!/usr/bin/env bun
/**
 * E2E test suite for the SHARED rate limit (Fase 0 — convention 11-A0).
 *
 * Verifica, contra un servidor local:
 *   1. v1 sin key → 401 missing_api_key
 *   2. 60 × GET /api/v1/accounts → la 61ª = 429 (body + headers)
 *   3. GET /api/agent/accounts justo después → 429 (mismo cubeto, sin bypass)
 *      + headers de deprecación
 *   4. tras el Retry-After → 200
 *   5. legacy con X-API-Key → 200 + success:true + headers + shape intacto
 *   6. legacy sin key → 401
 *   7. legacy key inválida → 401
 *   8. POST /api/agent/transactions con key read-only → 403
 *
 * Usage:
 *   bun scripts/e2e-rate-limit-v1.js --base http://localhost:3000 --key fz_... --read-only-key fz_...
 *
 * Or via environment variables:
 *   E2E_BASE_URL=http://localhost:3000 FINZEN_API_KEY=fz_... FINZEN_READONLY_API_KEY=fz_...
 *
 * The API keys are NEVER logged. Cleanup runs in a finally block.
 *
 * PRODUCCIÓN: solo smoke (pasos 1, 5, 6, 7, 8). El burst (60 peticiones) NUNCA
 * se ejecuta contra un host que no sea local: contra producción se hace un
 * smoke y el burst se omite.
 *
 * Exit code: 0 if all steps pass, 1 otherwise.
 */

// ─────────────────────────────────────────────────────────────
// CLI args + config
// ─────────────────────────────────────────────────────────────

function argValue(name) {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(`--${name}`);
  if (i !== -1 && i + 1 < argv.length) return argv[i + 1];
  return undefined;
}

const BASE = (argValue('base') || process.env.E2E_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const KEY = argValue('key') || process.env.FINZEN_API_KEY;
const READ_ONLY_KEY = argValue('read-only-key') || process.env.FINZEN_READONLY_API_KEY;

if (!KEY) {
  console.error('Missing API key: pass --key fz_... or set FINZEN_API_KEY');
  process.exit(1);
}

/** ¿El destino es local? (el burst solo se permite en local). */
const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(BASE);
const RUN_BURST = IS_LOCAL || process.argv.includes('--allow-burst');

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Call. Returns { status, json, headers }. */
async function call(method, path, body, apiKey) {
  const headers = {};
  if (apiKey) headers['X-API-Key'] = apiKey;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json, headers: res.headers };
}

let passed = 0;
let failed = 0;

function check(n, name, expected, got, ok) {
  if (ok) {
    passed++;
    console.log(`✓ ${n}. ${name} — expected ${expected}, got ${got}`);
  } else {
    failed++;
    console.log(`✗ ${n}. ${name} — expected ${expected}, got ${got}`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────
// Test suite
// ─────────────────────────────────────────────────────────────

async function main() {
  // 1. v1 sin key → 401 missing_api_key
  let res = await call('GET', '/api/v1/accounts');
  check(1, 'v1 sin key', 'status 401, error missing_api_key',
    `status ${res.status}, error ${res.json?.error}`,
    res.status === 401 &&
      res.json?.success === false &&
      res.json?.error === 'missing_api_key' &&
      typeof res.json?.message === 'string');

  // 2. Burst: 60 peticiones OK, la 61ª → 429
  let retryAfter = 0;
  if (RUN_BURST) {
    let allowed = 0;
    for (let i = 0; i < 60; i++) {
      const r = await call('GET', '/api/v1/accounts', undefined, KEY);
      if (r.status === 200) allowed++;
    }
    check(2, 'burst de 60 peticiones en v1', '60 × status 200', `${allowed} × status 200`,
      allowed === 60);

    res = await call('GET', '/api/v1/accounts', undefined, KEY);
    retryAfter = Number(res.headers.get('retry-after') || 0);
    const limit = res.headers.get('x-ratelimit-limit');
    const window = res.headers.get('x-ratelimit-window');
    const remaining = res.headers.get('x-ratelimit-remaining');
    const reset = res.headers.get('x-ratelimit-reset');
    check(3, 'la 61ª petición → 429 rate_limited',
      'status 429, error rate_limited, Retry-After + headers',
      `status ${res.status}, error ${res.json?.error}, retry-after ${retryAfter}, limit ${limit}, window ${window}, remaining ${remaining}, reset ${reset}`,
      res.status === 429 &&
        res.json?.success === false &&
        res.json?.error === 'rate_limited' &&
        typeof res.json?.message === 'string' &&
        /Retry in \d+s\./.test(res.json?.message || '') &&
        retryAfter >= 1 &&
        limit === '60' &&
        window === '60s' &&
        remaining === '0' &&
        Number(reset) > 0);

    // 4. legacy justo después → 429 (mismo cubeto ⇒ sin bypass)
    res = await call('GET', '/api/agent/accounts', undefined, KEY);
    check(4, 'legacy con el cubeto agotado → 429 + headers de deprecación',
      'status 429, error rate_limited, Deprecation/Sunset/Link',
      `status ${res.status}, error ${res.json?.error}, deprecation ${res.headers.get('deprecation')}, sunset ${res.headers.get('sunset')}, link ${res.headers.get('link')}`,
      res.status === 429 &&
        res.json?.success === false &&
        res.json?.error === 'rate_limited' &&
        res.headers.get('deprecation') === 'true' &&
        res.headers.get('sunset') === 'Sun, 14 Feb 2027 00:00:00 GMT' &&
        (res.headers.get('link') || '').includes('rel="successor-version"'));

    // 5. tras el Retry-After → 200
    const waitMs = Math.max(1, retryAfter) * 1000 + 500;
    console.log(`   (esperando ${Math.round(waitMs / 1000)}s a que expire la ventana…)`);
    await sleep(waitMs);
    res = await call('GET', '/api/v1/accounts', undefined, KEY);
    check(5, 'tras el Retry-After → 200', 'status 200', `status ${res.status}`,
      res.status === 200);
  } else {
    console.log('   (host no local: se OMITE el burst — en producción solo smoke)');
  }

  // 6. legacy con X-API-Key → 200 + success:true + headers + shape intacto
  res = await call('GET', '/api/agent/accounts', undefined, KEY);
  const accounts = res.json?.accounts;
  const firstAccount = Array.isArray(accounts) ? accounts[0] : undefined;
  const shapeOk =
    Array.isArray(accounts) &&
    typeof res.json?.count === 'number' &&
    (firstAccount === undefined ||
      ['id', 'name', 'type', 'subType', 'currency', 'balance', 'institution'].every(
        (key) => Object.prototype.hasOwnProperty.call(firstAccount, key)
      ));
  check(6, 'legacy con X-API-Key → 200 + success:true + shape intacto',
    'status 200, success true, count + accounts[]',
    `status ${res.status}, success ${res.json?.success}, count ${res.json?.count}`,
    res.status === 200 &&
      res.json?.success === true &&
      shapeOk &&
      res.headers.get('deprecation') === 'true' &&
      res.headers.get('sunset') === 'Sun, 14 Feb 2027 00:00:00 GMT' &&
      (res.headers.get('link') || '').includes('/api/v1/accounts'));

  // 7. legacy sin key → 401 missing_api_key
  res = await call('GET', '/api/agent/accounts');
  check(7, 'legacy sin key', 'status 401, error missing_api_key',
    `status ${res.status}, error ${res.json?.error}`,
    res.status === 401 && res.json?.success === false && res.json?.error === 'missing_api_key');

  // 8. legacy key inválida → 401 invalid_api_key
  res = await call('GET', '/api/agent/accounts', undefined, 'fz_key_invalida_para_el_e2e');
  check(8, 'legacy key inválida', 'status 401, error invalid_api_key',
    `status ${res.status}, error ${res.json?.error}`,
    res.status === 401 && res.json?.success === false && res.json?.error === 'invalid_api_key');

  // 9. POST legacy con key read-only → 403 forbidden
  if (READ_ONLY_KEY) {
    res = await call('POST', '/api/agent/transactions', {
      type: 'expense',
      amount: 1,
      fromAccountId: 'cuenta-inexistente',
      toAccountId: 'x_categoria-inexistente',
      categoryId: 'categoria-inexistente',
    }, READ_ONLY_KEY);
    check(9, 'POST legacy con key read-only', 'status 403, error forbidden',
      `status ${res.status}, error ${res.json?.error}`,
      res.status === 403 &&
        res.json?.success === false &&
        res.json?.error === 'forbidden' &&
        res.headers.get('deprecation') === 'true');
  } else {
    console.log('   (sin --read-only-key: se omite el paso de 403)');
  }
}

try {
  await main();
} catch (err) {
  console.error('Suite crashed:', err?.message || err);
  failed++;
}

console.log(`RESULT: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log(`${failed} step(s) FAILED`);
  process.exitCode = 1;
}
