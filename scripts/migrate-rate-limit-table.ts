#!/usr/bin/env bun
/**
 * migrate-rate-limit-table.ts — Fase 0: crea la tabla `RateLimitBucket`.
 *
 * El limitador compartido (Fase 0 — convención 11-A0) guarda 1 fila por
 * principal en la tabla `RateLimitBucket`. El código es desplegable ANTES
 * de migrar: si la tabla no existe, el limitador degrada al contador en
 * memoria (nunca 5xx) y registra un log saneado (`table_missing`).
 *
 * ── Uso ──────────────────────────────────────────────────────────────────────
 *   bun run scripts/migrate-rate-limit-table.ts             # dry-run (por defecto)
 *   bun run scripts/migrate-rate-limit-table.ts --dry-run   # dry-run explícito
 *   bun run scripts/migrate-rate-limit-table.ts --apply     # crea tabla + índice
 *   bun run scripts/migrate-rate-limit-table.ts --verify    # comprueba el estado
 *   bun run scripts/migrate-rate-limit-table.ts --rollback db/rate-limit-table.<ts>.backup
 *
 * ── Conexión ─────────────────────────────────────────────────────────────────
 * `DATABASE_URL` si está definida (Turso `libsql://` → `@prisma/adapter-libsql`;
 * `file:` → SQLite local). Sin `DATABASE_URL`, en dev usa `file:db/custom.db`.
 * NO importa `src/lib/db.ts` a propósito: ese módulo hace fail-fast en
 * producción y copiaría la BD de seed; aquí la conexión es explícita.
 *
 * ── Garantías ───────────────────────────────────────────────────────────────
 * - **Dry-run por defecto**: sin `--apply` no se escribe NADA.
 * - **Backup** antes de escribir: `db/rate-limit-table.<timestamp>.backup`
 *   (ignorado por git vía `db/*.backup`).
 * - **Idempotente**: `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS`.
 * - **Rollback**: `--rollback <archivo>` devuelve la BD al estado previo
 *   (si la tabla no existía, la borra; si existía, restaura las filas).
 * - **Producción**: cualquier operación (dry-run, `--apply`, `--verify` o
 *   `--rollback`) contra un destino Turso exige `--allow-production`; sin la
 *   flag el script aborta ANTES de abrir conexión (la ejecución en
 *   producción la autoriza el dueño por separado).
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';

type Mode = 'dry-run' | 'apply' | 'verify' | 'rollback';

interface CliOptions {
  mode: Mode;
  rollbackFile?: string;
  allowProduction: boolean;
}

/** Fila de `RateLimitBucket` (los tiempos son epoch-ms). */
interface BucketRow {
  id: string;
  hits: number;
  windowStartMs: number;
  expiresAtMs: number;
  updatedAtMs: number;
}

/** Contenido del backup (estado previo a la migración). */
interface BackupFile {
  createdAt: string;
  table: string;
  tableExistedBefore: boolean;
  indexExistedBefore: boolean;
  rows: BucketRow[];
}

const TABLE_NAME = 'RateLimitBucket';
const INDEX_NAME = 'RateLimitBucket_expiresAtMs_idx';
const DEFAULT_FILE_URL = 'file:db/custom.db';
const BACKUP_DIR = 'db';

/**
 * DDL espejo de `prisma/schema.prisma` (modelo `RateLimitBucket`).
 * Los tiempos son epoch-ms: `BIGINT` en SQLite (afinidad INTEGER) porque
 * epoch-ms NO cabe en Int32 (el conector SQLite de Prisma lo rechaza en
 * columnas `Int`).
 */
const CREATE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS "RateLimitBucket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "windowStartMs" BIGINT NOT NULL,
    "expiresAtMs" BIGINT NOT NULL,
    "updatedAtMs" BIGINT NOT NULL
)`;

const CREATE_INDEX_SQL = `CREATE INDEX IF NOT EXISTS "${INDEX_NAME}" ON "${TABLE_NAME}"("expiresAtMs")`;

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): CliOptions {
  let mode: Mode = 'dry-run';
  let rollbackFile: string | undefined;
  let allowProduction = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      mode = 'dry-run';
    } else if (arg === '--apply') {
      mode = 'apply';
    } else if (arg === '--verify') {
      mode = 'verify';
    } else if (arg === '--rollback') {
      mode = 'rollback';
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        throw new Error('--rollback requiere la ruta del archivo de backup');
      }
      rollbackFile = next;
      i++;
    } else if (arg === '--allow-production') {
      allowProduction = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(
        [
          'migrate-rate-limit-table — Fase 0 (rate limit compartido)',
          '',
          '  (sin flags)         dry-run: informa del estado, no escribe',
          '  --dry-run           dry-run explícito',
          '  --apply             crea la tabla + índice (idempotente, con backup)',
          '  --verify            comprueba que la tabla + índice existen',
          '  --rollback <file>   devuelve la BD al estado previo (backup)',
          '  --allow-production  requerido para CUALQUIER operación contra Turso',
        ].join('\n')
      );
      process.exit(0);
    } else {
      throw new Error(`Argumento desconocido: ${arg}`);
    }
  }

  return { mode, rollbackFile, allowProduction };
}

// ─────────────────────────────────────────────────────────────────────────────
// Conexión
// ─────────────────────────────────────────────────────────────────────────────

/** Convierte un `file:` relativo en absoluto (Prisma los resuelve contra el schema). */
function resolveFileUrl(url: string): string {
  if (!url.startsWith('file:')) return url;
  const rest = url.slice('file:'.length);
  const pathPart = rest.split('?')[0];
  if (!pathPart || isAbsolute(pathPart)) return url;
  const absolute = resolve(process.cwd(), pathPart).replace(/\\/g, '/');
  return `file:${absolute}${rest.slice(pathPart.length)}`;
}

/** Descripción legible del destino — NUNCA imprime el token de Turso. */
function describeTarget(url: string): string {
  if (url.startsWith('libsql:')) {
    try {
      const parsed = new URL(url);
      parsed.searchParams.delete('authToken');
      parsed.username = '';
      parsed.password = '';
      return `Turso/libSQL → ${parsed.toString()}`;
    } catch {
      return 'Turso/libSQL → (URL no parseable, oculta)';
    }
  }
  return `SQLite local → ${url}`;
}

function createPrisma(url: string): PrismaClient {
  if (url.startsWith('libsql:')) {
    const parsed = new URL(url);
    const authToken = parsed.searchParams.get('authToken') ?? undefined;
    parsed.searchParams.delete('authToken');
    const adapter = new PrismaLibSQL({ url: parsed.toString(), authToken });
    return new PrismaClient({ adapter });
  }
  return new PrismaClient({ datasources: { db: { url } } });
}

// ─────────────────────────────────────────────────────────────────────────────
// Estado de la tabla
// ─────────────────────────────────────────────────────────────────────────────

async function tableExists(prisma: PrismaClient): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
    TABLE_NAME
  );
  return rows.length > 0;
}

async function indexExists(prisma: PrismaClient): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    "SELECT name FROM sqlite_master WHERE type='index' AND name = ?",
    INDEX_NAME
  );
  return rows.length > 0;
}

async function readRows(prisma: PrismaClient): Promise<BucketRow[]> {
  const rows = await prisma.$queryRawUnsafe<BucketRow[]>(
    `SELECT "id", "hits", "windowStartMs", "expiresAtMs", "updatedAtMs" FROM "${TABLE_NAME}"`
  );
  return rows.map((row) => ({
    id: String(row.id),
    hits: Number(row.hits),
    windowStartMs: Number(row.windowStartMs),
    expiresAtMs: Number(row.expiresAtMs),
    updatedAtMs: Number(row.updatedAtMs),
  }));
}

function timestampSlug(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

// ─────────────────────────────────────────────────────────────────────────────
// Operaciones
// ─────────────────────────────────────────────────────────────────────────────

async function writeBackup(prisma: PrismaClient, tableExisted: boolean, indexExisted: boolean): Promise<string> {
  const backupDir = join(process.cwd(), BACKUP_DIR);
  if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });
  const backupPath = join(backupDir, `rate-limit-table.${timestampSlug()}.backup`);

  const backup: BackupFile = {
    createdAt: new Date().toISOString(),
    table: TABLE_NAME,
    tableExistedBefore: tableExisted,
    indexExistedBefore: indexExisted,
    rows: tableExisted ? await readRows(prisma) : [],
  };
  writeFileSync(backupPath, `${JSON.stringify(backup, null, 2)}\n`, 'utf-8');
  console.log(`[migrate-rate-limit-table] backup escrito: ${backupPath}`);
  return backupPath;
}

async function applyChanges(prisma: PrismaClient): Promise<string> {
  const tableExisted = await tableExists(prisma);
  const indexExisted = await indexExists(prisma);

  // 1. Backup ANTES de escribir.
  const backupPath = await writeBackup(prisma, tableExisted, indexExisted);

  // 2. DDL idempotente.
  await prisma.$executeRawUnsafe(CREATE_TABLE_SQL);
  await prisma.$executeRawUnsafe(CREATE_INDEX_SQL);

  console.log(
    `[migrate-rate-limit-table] tabla "${TABLE_NAME}": ${tableExisted ? 'ya existía' : 'creada'} · índice "${INDEX_NAME}": ${indexExisted ? 'ya existía' : 'creado'}`
  );
  console.log(
    `[migrate-rate-limit-table] rollback: bun run scripts/migrate-rate-limit-table.ts --rollback "${backupPath}"`
  );
  return backupPath;
}

async function rollback(prisma: PrismaClient, backupPath: string): Promise<void> {
  const absolute = isAbsolute(backupPath) ? backupPath : resolve(process.cwd(), backupPath);
  if (!existsSync(absolute)) {
    throw new Error(`No existe el backup: ${absolute}`);
  }
  const parsed: unknown = JSON.parse(readFileSync(absolute, 'utf-8'));
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`Backup con formato inválido: ${absolute}`);
  }
  const backup = parsed as BackupFile;

  if (!backup.tableExistedBefore) {
    // Estado previo: la tabla NO existía → se elimina (índice incluido).
    await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "${INDEX_NAME}"`);
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${TABLE_NAME}"`);
    console.log('[migrate-rate-limit-table] rollback: tabla eliminada (no existía antes)');
    return;
  }

  // Estado previo: la tabla existía → se restauran sus filas.
  await prisma.$executeRawUnsafe(CREATE_TABLE_SQL);
  await prisma.$executeRawUnsafe(CREATE_INDEX_SQL);
  await prisma.$executeRawUnsafe(`DELETE FROM "${TABLE_NAME}"`);
  for (const row of backup.rows) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "${TABLE_NAME}" ("id","hits","windowStartMs","expiresAtMs","updatedAtMs") VALUES (?, ?, ?, ?, ?)`,
      row.id,
      row.hits,
      row.windowStartMs,
      row.expiresAtMs,
      row.updatedAtMs
    );
  }
  console.log(
    `[migrate-rate-limit-table] rollback: ${backup.rows.length} fila(s) restauradas desde ${absolute}`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  const rawUrl = process.env.DATABASE_URL?.trim() || DEFAULT_FILE_URL;
  const url = resolveFileUrl(rawUrl);
  const isProductionTarget = url.startsWith('libsql:');

  console.log(`[migrate-rate-limit-table] destino: ${describeTarget(url)}`);
  console.log(`[migrate-rate-limit-table] modo: ${options.mode}`);

  if (isProductionTarget) {
    console.warn(
      '[migrate-rate-limit-table] ⚠️  DESTINO DE PRODUCCIÓN (Turso). La ejecución la autoriza el dueño.'
    );
    // Gate ANTES de `createPrisma()`: sin la flag no se abre NINGUNA conexión
    // contra Turso — tampoco en dry-run (que solo lee, pero ya abre sesión).
    if (!options.allowProduction) {
      throw new Error(
        `Refusando ${options.mode} contra un destino de producción: ` +
          'añade --allow-production si el dueño lo autorizó.'
      );
    }
  }

  const prisma = createPrisma(url);

  try {
    if (options.mode === 'rollback') {
      if (!options.rollbackFile) {
        throw new Error('--rollback requiere la ruta del archivo de backup');
      }
      await rollback(prisma, options.rollbackFile);
      return;
    }

    const tableExisted = await tableExists(prisma);
    const indexExisted = await indexExists(prisma);
    const rowCount = tableExisted ? (await readRows(prisma)).length : 0;

    console.log(
      `[migrate-rate-limit-table] tabla "${TABLE_NAME}": ${tableExisted ? 'existe' : 'NO existe'} · índice "${INDEX_NAME}": ${indexExisted ? 'existe' : 'NO existe'} · filas: ${rowCount}`
    );

    if (options.mode === 'verify') {
      if (!tableExisted || !indexExisted) {
        console.error(
          '[migrate-rate-limit-table] VERIFY FALLIDO: falta la tabla o el índice. Usa --apply.'
        );
        process.exitCode = 1;
        return;
      }
      console.log('[migrate-rate-limit-table] VERIFY OK: la tabla y el índice existen.');
      return;
    }

    if (options.mode === 'dry-run') {
      console.log(
        '[migrate-rate-limit-table] DRY-RUN: no se escribió nada. Usa --apply para aplicar.'
      );
      return;
    }

    await applyChanges(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('[migrate-rate-limit-table] ERROR:', error instanceof Error ? error.message : error);
  process.exit(1);
});
