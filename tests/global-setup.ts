import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

/**
 * Global setup de Vitest (10-U4, P3) — BASE DE DATOS TEMPORAL.
 *
 * Garantías de AISLAMIENTO (AGENTS.md §5 — "Tests automatizados"):
 * - La BD de test es un SQLite TEMPORAL en `os.tmpdir()`, created con
 *   `mkdtempSync` y BORRADO al terminar (`teardown`).
 * - `DATABASE_URL` del ENTORNO NUNCA se usa: se SOBREESCRIBE con la ruta del
 *   temporal, así que ni `db/custom.db` ni Turso son alcanzables.
 * - `db/custom.db` no se lee, no se copia y no se escribe.
 *
 * El DDL sale de `prisma/schema.prisma` con
 * `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`
 * (fuente de verdad). Si el CLI no está disponible, se usa `db/schema.sql`
 * (el mismo DDL versionado en el repo) y el test de deriva
 * (`services.db.test.ts`) avisa si divergen.
 */

const REPO_ROOT = process.cwd();
const SCHEMA_PATH = resolve(REPO_ROOT, 'prisma', 'schema.prisma');
const FALLBACK_DDL_PATH = resolve(REPO_ROOT, 'db', 'schema.sql');

/** Ruta de la BD temporal (la exports `tests/setup.ts` lee de `process.env`). */
export const TEST_DB_ENV_VAR = 'FINZEN_TEST_DATABASE_URL';

let tempDir: string | null = null;
let dbPath: string | null = null;
let client: PrismaClient | null = null;
/** `DATABASE_URL` original del entorno (se restaura al terminar). */
let originalDatabaseUrl: string | undefined;

/** Genera el DDL desde `prisma/schema.prisma` (fuente de verdad). */
function ddlFromPrismaSchema(): string | null {
  try {
    const bin = resolve(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'prisma.cmd' : 'prisma');
    return execFileSync(
      bin,
      ['migrate', 'diff', '--from-empty', '--to-schema-datamodel', SCHEMA_PATH, '--script'],
      { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    );
  } catch {
    return null;
  }
}

/** DDL de respaldo: `db/schema.sql` (versionado en el repo). */
function ddlFromSchemaSql(): string {
  return readFileSync(FALLBACK_DDL_PATH, 'utf8');
}

/** Divide el DDL en sentencias ejecutables (SQLite: una por `;`). */
function splitStatements(ddl: string): string[] {
  return ddl
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export async function setup(): Promise<void> {
  tempDir = mkdtempSync(join(tmpdir(), 'shikin-vitest-'));
  dbPath = join(tempDir, 'test.db');
  const url = `file:${dbPath}`;

  const ddl = ddlFromPrismaSchema() ?? ddlFromSchemaSql();

  client = new PrismaClient({ datasources: { db: { url } } });
  for (const statement of splitStatements(ddl)) {
    await client.$executeRawUnsafe(statement);
  }
  await client.$disconnect();
  client = null;

  // Se SOBREESCRIBE cualquier valor ambiente: la BD de test es SIEMPRE el
  // temporal (nunca `db/custom.db`, nunca Turso).
  originalDatabaseUrl = process.env.DATABASE_URL;
  process.env[TEST_DB_ENV_VAR] = url;
  process.env.DATABASE_URL = url;
}

export async function teardown(): Promise<void> {
  if (client) {
    await client.$disconnect();
    client = null;
  }
  delete process.env[TEST_DB_ENV_VAR];
  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
  } else {
    process.env.DATABASE_URL = originalDatabaseUrl;
  }
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
  dbPath = null;
}
