import { describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Contrato público de la API v1 (10-U4).
 *
 * Este suite NO toca la base de datos:
 * - `src/lib/db.ts` REAL nunca se importa (crea un `PrismaClient` al
 *   importarse). Se sustituye por un fake con `vi.mock('@/lib/db')` que
 *   registra cada llamada para poder afirmar "0 llamadas a la BD".
 * - La petición sin API key debe fallar ANTES de `validateApiKey()`, que es
 *   lo único que consulta la tabla `ApiKey`.
 *
 * Además se hace un ESCANEO ESTÁTICO de `src/app/api/v1/**\/route.ts` para
 * comprobar que todo error público usa el shape canónico
 * `{ success: false, error: "<snake_case>", message: "..." }`.
 */

/** Registro de llamadas a la BD (fake en memoria). */
const dbCalls = vi.hoisted<string[]>(() => []);

/** Key de prueba (NUNCA una key real). */
const VALID_KEY = 'fz_test_key_for_contract';

vi.mock('@/lib/db', async () => {
  const { createHash } = await import('node:crypto');
  const validKeyHash = createHash('sha256').update('fz_test_key_for_contract').digest('hex');

  return {
    db: {
      apiKey: {
        findUnique: async (args: { where: { keyHash: string } }) => {
          dbCalls.push('apiKey.findUnique');
          if (args?.where?.keyHash === validKeyHash) {
            return {
              id: 'apikey-contract-1',
              isActive: true,
              expiresAt: null,
              permissions: 'read,write',
              user: {
                id: 'user-contract-1',
                email: 'v1-contract@example.invalid',
                name: 'V1 Contract',
              },
            };
          }
          return null;
        },
        update: async () => {
          dbCalls.push('apiKey.update');
          return null;
        },
      },
    },
    ensureDb: async () => {
      dbCalls.push('ensureDb');
    },
  };
});

const { authenticateV1Request } = await import('@/lib/auth/v1-api');

const V1_ROOT = resolve(process.cwd(), 'src', 'app', 'api', 'v1');
const SERVICES_ROOT = resolve(process.cwd(), 'src', 'lib', 'services');

/** Snake_case: minúsculas, dígitos y guiones bajos; nada más. */
const SNAKE_CASE = /^[a-z0-9_]+$/;

interface ErrorBody {
  success: boolean;
  error: string;
  message: string;
}

function collectRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === 'route.ts') {
      out.push(full);
      continue;
    }
    // `readdirSync(dir, { withFileTypes: true })` no se usa para no depender de
    // tipos de Node en el type-check; los subdirectorios son los únicos que
    // contienen `route.ts` y se detectan por el intento de lectura.
    try {
      out.push(...collectRouteFiles(full));
    } catch {
      // no es un directorio -> se ignora
    }
  }
  return out;
}

/** Quita comentarios de bloque y de línea (el código real, no la prosa). */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/**
 * Extrae los LITERALES de la forma `clave: 'x'` / `clave: "x"` /
 * `clave: \`x\`` (las tres comillas). Un valor dinámico (`error: result.code`)
 * NO se captura aquí: lo cubre el escaneo de los `code:` de los servicios.
 */
function extractKeyLiterals(src: string, key: string): string[] {
  const out: string[] = [];
  const pattern = new RegExp(`\\b${key}\\s*:\\s*(['"\`])([^'"\`]*)\\1`, 'g');
  for (const match of src.matchAll(pattern)) {
    out.push(match[2]);
  }
  return out;
}

/** Ficheros `.ts` de la capa de servicios (excluye sus `__tests__`). */
function collectServiceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === '__tests__') continue;
    const full = join(dir, entry);
    if (entry.endsWith('.ts')) {
      out.push(full);
      continue;
    }
    try {
      out.push(...collectServiceFiles(full));
    } catch {
      // no es un directorio -> se ignora
    }
  }
  return out;
}

/**
 * Extrae el primer argumento de cada llamada `NextResponse.json(...)`.
 * Devuelve un array de textos (el contenido entre paréntesis balanceados).
 */
function extractJsonArgs(src: string): string[] {
  const args: string[] = [];
  const marker = 'NextResponse.json(';
  let idx = src.indexOf(marker);
  while (idx !== -1) {
    const open = idx + marker.length - 1; // índice del '('
    let depth = 0;
    let i = open;
    let inStr: string | null = null;
    for (; i < src.length; i++) {
      const ch = src[i];
      if (inStr) {
        if (ch === '\\') {
          i++;
        } else if (ch === inStr) {
          inStr = null;
        }
        continue;
      }
      if (ch === "'" || ch === '"' || ch === '`') {
        inStr = ch;
        continue;
      }
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth === 0) {
          i++;
          break;
        }
      }
    }
    args.push(src.slice(open + 1, i - 1));
    idx = src.indexOf(marker, i);
  }
  return args;
}

describe('API v1 — contrato de errores', () => {
  it('responde 401 missing_api_key sin tocar la BD', async () => {
    dbCalls.length = 0;

    const result = await authenticateV1Request(new Request('http://localhost/api/v1/summary'));

    expect(result.ok).toBe(false);
    expect(result.response).toBeDefined();
    expect(result.response!.status).toBe(401);

    const body = (await result.response!.json()) as ErrorBody;
    expect(body.success).toBe(false);
    expect(body.error).toBe('missing_api_key');
    expect(typeof body.message).toBe('string');
    expect(body.message.length).toBeGreaterThan(0);

    // El `error` es siempre snake_case.
    expect(body.error).toMatch(SNAKE_CASE);

    // 0 llamadas a la BD: el fallo ocurre ANTES de `validateApiKey()`.
    expect(dbCalls).toEqual([]);
  });

  it('rechaza una API key inválida con invalid_api_key (401) y sin escrituras', async () => {
    dbCalls.length = 0;

    const result = await authenticateV1Request(
      new Request('http://localhost/api/v1/summary', { headers: { 'x-api-key': 'fz_not_a_real_key' } })
    );

    expect(result.ok).toBe(false);
    expect(result.response!.status).toBe(401);

    const body = (await result.response!.json()) as ErrorBody;
    expect(body.success).toBe(false);
    expect(body.error).toBe('invalid_api_key');
    expect(body.error).toMatch(SNAKE_CASE);

    // La BD real nunca se escribe: el fake solo registra, no persiste.
    expect(dbCalls.filter((c) => c === 'apiKey.update')).toEqual([]);
  });
});

describe('API v1 — rate limit compartido', () => {
  /** Request con la key de prueba válida (fake de la BD). */
  function requestWithKey(path = '/api/v1/accounts'): Request {
    return new Request(`http://localhost${path}`, { headers: { 'x-api-key': VALID_KEY } });
  }

  /** Store que siempre devuelve el cubeto por encima del límite. */
  function exhaustedStore() {
    return {
      hit: async () => ({
        hits: 61,
        windowStartMs: Date.now(),
        expiresAtMs: Date.now() + 60_000,
      }),
    };
  }

  /** Store que siempre falla (tabla ausente / Turso caído). */
  function failingStore() {
    return {
      hit: async () => {
        throw new Error('no such table: RateLimitBucket');
      },
    };
  }

  it('responde 429 rate_limited con el body y los headers obligatorios', async () => {
    const result = await authenticateV1Request(requestWithKey(), { store: exhaustedStore() });

    expect(result.ok).toBe(false);
    expect(result.response).toBeDefined();
    expect(result.response!.status).toBe(429);

    const body = (await result.response!.json()) as ErrorBody;
    expect(body.success).toBe(false);
    expect(body.error).toBe('rate_limited');
    expect(body.error).toMatch(SNAKE_CASE);
    expect(body.message).toMatch(/^Too many requests\. Retry in \d+s\.$/);

    // Headers obligatorios (los 3 previos + los 2 nuevos).
    const retryAfter = result.response!.headers.get('retry-after');
    expect(retryAfter).not.toBeNull();
    expect(Number(retryAfter)).toBeGreaterThanOrEqual(1);
    expect(result.response!.headers.get('x-ratelimit-limit')).toBe('60');
    expect(result.response!.headers.get('x-ratelimit-window')).toBe('60s');
    expect(result.response!.headers.get('x-ratelimit-remaining')).toBe('0');
    const reset = result.response!.headers.get('x-ratelimit-reset');
    expect(reset).not.toBeNull();
    expect(Number(reset)).toBeGreaterThan(0);
    // El mensaje del body concuerda con el header.
    expect(body.message).toBe(`Too many requests. Retry in ${retryAfter}s.`);
  });

  it('el 429 NO depende del store real: la decisión viene del cubeto inyectado', async () => {
    const result = await authenticateV1Request(requestWithKey('/api/v1/summary'), {
      store: exhaustedStore(),
    });
    expect(result.response!.status).toBe(429);
    expect(result.rateLimit?.ok).toBe(false);
    expect(result.rateLimit?.remaining).toBe(0);
    expect(result.rateLimit?.limit).toBe(60);
  });

  it('modo strict: si el store compartido falla, responde 503 rate_limit_unavailable', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const previous = process.env.FINZEN_RATE_LIMIT_FAIL_MODE;
    process.env.FINZEN_RATE_LIMIT_FAIL_MODE = 'strict';

    try {
      const result = await authenticateV1Request(requestWithKey(), { store: failingStore() });

      expect(result.ok).toBe(false);
      expect(result.response!.status).toBe(503);

      const body = (await result.response!.json()) as ErrorBody;
      expect(body.success).toBe(false);
      expect(body.error).toBe('rate_limit_unavailable');
      expect(body.error).toMatch(SNAKE_CASE);
      expect(body.message).toBe('Rate limiter temporarily unavailable');
    } finally {
      if (previous === undefined) delete process.env.FINZEN_RATE_LIMIT_FAIL_MODE;
      else process.env.FINZEN_RATE_LIMIT_FAIL_MODE = previous;
      spy.mockRestore();
    }
  });

  it('modo fallback (por defecto): si el store compartido falla, NO hay 5xx', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const previous = process.env.FINZEN_RATE_LIMIT_FAIL_MODE;
    delete process.env.FINZEN_RATE_LIMIT_FAIL_MODE;

    try {
      const result = await authenticateV1Request(requestWithKey(), { store: failingStore() });

      expect(result.ok).toBe(true);
      expect(result.response).toBeUndefined();
      expect(result.rateLimit?.degraded).toBe(true);
      expect(result.rateLimit?.ok).toBe(true);
    } finally {
      if (previous !== undefined) process.env.FINZEN_RATE_LIMIT_FAIL_MODE = previous;
      spy.mockRestore();
    }
  });
});

describe('API v1 — escaneo estático de las rutas', () => {
  const routeFiles = collectRouteFiles(V1_ROOT);
  const serviceFiles = collectServiceFiles(SERVICES_ROOT);

  it('encuentra las rutas públicas de la API v1', () => {
    expect(routeFiles.length).toBeGreaterThan(0);
    expect(routeFiles.map((f) => f.replace(V1_ROOT, '').replace(/\\/g, '/'))).toContain('/summary/route.ts');
  });

  it('encuentra la capa de servicios que alimenta las rutas v1', () => {
    expect(serviceFiles.length).toBeGreaterThan(0);
    expect(serviceFiles.map((f) => f.replace(SERVICES_ROOT, '').replace(/\\/g, '/'))).toContain(
      '/accounts-service.ts'
    );
  });

  it('todo literal error: es snake_case (comillas simples, dobles y backticks)', () => {
    const offenders: string[] = [];
    const found = new Set<string>();
    for (const file of routeFiles) {
      const src = stripComments(readFileSync(file, 'utf8'));
      const rel = file.replace(V1_ROOT, '').replace(/\\/g, '/');
      for (const value of extractKeyLiterals(src, 'error')) {
        found.add(value);
        if (!SNAKE_CASE.test(value)) offenders.push(`${rel} -> error: '${value}'`);
      }
    }
    expect(offenders).toEqual([]);
    // Guarda contra un escaneo vacío: los códigos públicos deben estar todos.
    expect([...found].sort()).toEqual([
      'account_not_found',
      'forbidden',
      'invalid_amount',
      'invalid_currency',
      'invalid_date',
      'invalid_json',
      'invalid_month',
      'no_account',
      'not_found',
    ]);
  });

  it('todo literal code: de las rutas v1 y de los servicios es snake_case', () => {
    const offenders: string[] = [];
    const found = new Set<string>();
    let checked = 0;
    for (const file of [...routeFiles, ...serviceFiles]) {
      const src = stripComments(readFileSync(file, 'utf8'));
      const rel = file.replace(process.cwd(), '').replace(/\\/g, '/');
      // Códigos literales (`code: 'not_found'`, `code: "x"`, `code: \`x\``).
      for (const value of extractKeyLiterals(src, 'code')) {
        checked++;
        found.add(value);
        if (!SNAKE_CASE.test(value)) offenders.push(`${rel} -> code: '${value}'`);
      }
      // Tipos `*ErrorCode`: declaran el mismo dominio de códigos públicos.
      for (const match of src.matchAll(/\b\w*ErrorCode\b\s*=\s*([^;]+);/g)) {
        for (const literal of match[1].matchAll(/(['"`])([^'"`]*)\1/g)) {
          checked++;
          found.add(literal[2]);
          if (!SNAKE_CASE.test(literal[2])) {
            offenders.push(`${rel} -> ErrorCode: '${literal[2]}'`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
    // Guarda contra un escaneo vacío: hay códigos que auditar.
    expect(checked).toBeGreaterThan(10);
  });

  it('los errores DINÁMICOS (`error: result.code`) vienen de un servicio con códigos snake_case', () => {
    const dynamicRoutes: string[] = [];
    for (const file of routeFiles) {
      const src = stripComments(readFileSync(file, 'utf8'));
      const rel = file.replace(V1_ROOT, '').replace(/\\/g, '/');
      for (const match of src.matchAll(/\berror\s*:\s*([\w$.]+)\.code\b/g)) {
        dynamicRoutes.push(rel);
        // El código dinámico lo produce la CAPA DE SERVICIOS (escaneada
        // arriba): sin ese import, el código no está garantizado.
        expect(src, `${rel}: el error dinámico debe venir de @/lib/services/`).toContain(
          "from '@/lib/services/"
        );
      }
    }
    // Guarda contra un escaneo vacío: hay respuestas con error dinámico.
    expect(dynamicRoutes.length).toBeGreaterThan(0);
  });

  it('toda respuesta de error incluye success:false y message', () => {
    const offenders: string[] = [];
    let errorResponses = 0;
    for (const file of routeFiles) {
      const src = stripComments(readFileSync(file, 'utf8'));
      const rel = file.replace(V1_ROOT, '').replace(/\\/g, '/');
      for (const arg of extractJsonArgs(src)) {
        if (!/error\s*:/.test(arg)) continue;
        errorResponses++;
        if (!/success\s*:\s*false/.test(arg)) offenders.push(`${rel} -> sin success:false`);
        if (!/message\s*:/.test(arg)) offenders.push(`${rel} -> sin message`);
      }
    }
    expect(offenders).toEqual([]);
    // Guarda contra un escaneo vacío: hay respuestas de error que auditar.
    expect(errorResponses).toBeGreaterThanOrEqual(30);
  });

  it('toda respuesta de éxito declara success:true', () => {
    const offenders: string[] = [];
    for (const file of routeFiles) {
      const src = stripComments(readFileSync(file, 'utf8'));
      const rel = file.replace(V1_ROOT, '').replace(/\\/g, '/');
      for (const arg of extractJsonArgs(src)) {
        if (/error\s*:/.test(arg)) continue;
        if (!/success\s*:\s*true/.test(arg)) offenders.push(`${rel} -> sin success:true`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Rutas LEGACY `/api/agent/*` (deprecadas en Fase 0)
// ─────────────────────────────────────────────────────────────────────────────

const LEGACY_ROOT = resolve(process.cwd(), 'src', 'app', 'api', 'agent');

/**
 * Auditoría de una ruta legacy: devuelve la lista de infracciones.
 * Se usa con las rutas reales (debe salir vacía) y con el fixture del
 * CÓDIGO VIEJO (control negativo: debe listar infracciones).
 */
function auditLegacyRoute(src: string): string[] {
  const offenders: string[] = [];

  // 1. Auth unificada: `authenticateV1Request` (nunca `validateApiKey`).
  if (!src.includes('authenticateV1Request')) offenders.push('sin authenticateV1Request');
  if (src.includes('validateApiKey(')) offenders.push('usa validateApiKey( (auth no unificada)');

  // 2. Headers de deprecación en TODAS las respuestas.
  if (!src.includes('withLegacyDeprecation')) offenders.push('sin withLegacyDeprecation');
  if (/return\s+NextResponse\.json\(/.test(src)) {
    offenders.push('devuelve NextResponse.json sin envolver en withLegacyDeprecation');
  }

  // 3. Errores con el shape v1: success:false + error snake_case + message.
  for (const arg of extractJsonArgs(src)) {
    if (!/error\s*:/.test(arg)) continue;
    if (!/success\s*:\s*false/.test(arg)) offenders.push('respuesta de error sin success:false');
    if (!/message\s*:/.test(arg)) offenders.push('respuesta de error sin message');
  }
  for (const value of extractKeyLiterals(src, 'error')) {
    if (!SNAKE_CASE.test(value)) offenders.push(`error no snake_case: '${value}'`);
  }

  return offenders;
}

describe('API legacy — contrato de deprecación y normalización', () => {
  const legacyFiles = collectRouteFiles(LEGACY_ROOT);

  it('encuentra las 4 rutas legacy deprecadas', () => {
    const rel = legacyFiles.map((f) => f.replace(LEGACY_ROOT, '').replace(/\\/g, '/')).sort();
    expect(rel).toEqual([
      '/accounts/route.ts',
      '/categories/route.ts',
      '/summary/route.ts',
      '/transactions/route.ts',
    ]);
  });

  it('toda ruta legacy usa la auth unificada y los headers de deprecación', () => {
    const offenders: string[] = [];
    for (const file of legacyFiles) {
      const src = stripComments(readFileSync(file, 'utf8'));
      const rel = file.replace(LEGACY_ROOT, '').replace(/\\/g, '/');
      for (const issue of auditLegacyRoute(src)) {
        offenders.push(`${rel} -> ${issue}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('ninguna ruta legacy contiene `validateApiKey(`', () => {
    for (const file of legacyFiles) {
      const src = readFileSync(file, 'utf8');
      expect(src, file).not.toContain('validateApiKey(');
    }
  });

  it('CONTROL NEGATIVO: el escaneo detecta el código VIEJO (sin normalizar)', () => {
    const oldRoute = `
      import { validateApiKey, hasPermission } from '@/lib/auth/api-key';
      export async function GET(req: Request) {
        const authHeader = req.headers.get('authorization');
        const user = await validateApiKey(authHeader);
        if (!user) {
          return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 });
        }
        if (!hasPermission(user, 'read')) {
          return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }
      }
    `;

    const offenders = auditLegacyRoute(oldRoute);

    expect(offenders.length).toBeGreaterThan(0);
    expect(offenders).toContain('sin authenticateV1Request');
    expect(offenders).toContain('usa validateApiKey( (auth no unificada)');
    expect(offenders).toContain('sin withLegacyDeprecation');
    expect(offenders).toContain('devuelve NextResponse.json sin envolver en withLegacyDeprecation');
    expect(offenders).toContain('respuesta de error sin success:false');
    expect(offenders).toContain('respuesta de error sin message');
    expect(offenders).toContain("error no snake_case: 'Invalid or missing API key'");
  });

  it('las rutas legacy comparten el cubeto con v1 (misma auth → mismo scope)', () => {
    // El cubeto se calcula DENTRO de `authenticateV1Request` (`apiKeyScope`),
    // así que v1 y legacy usan el MISMO scope por construcción.
    const v1Source = readFileSync(resolve(process.cwd(), 'src', 'lib', 'auth', 'v1-api.ts'), 'utf8');
    expect(v1Source).toContain('apiKeyScope(keyHash)');

    for (const file of legacyFiles) {
      const src = readFileSync(file, 'utf8');
      expect(src, file).toContain('authenticateV1Request(req)');
      // Ninguna ruta legacy calcula su propio cubeto (ni su propio Map).
      expect(src, file).not.toContain('new Map');
      expect(src, file).not.toContain('apiKeyScope');
    }
  });
});
