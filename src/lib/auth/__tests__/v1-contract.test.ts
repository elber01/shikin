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

vi.mock('@/lib/db', () => ({
  db: {
    apiKey: {
      findUnique: async () => {
        dbCalls.push('apiKey.findUnique');
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
}));

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
