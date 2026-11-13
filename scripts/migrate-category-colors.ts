#!/usr/bin/env bun
/**
 * migrate-category-colors.ts — migración de datos de la fase 10-U1.
 *
 * Convierte `Category.color` de HEX heredado a CLAVE de token (`cat-1`..`cat-12`).
 * El render ya resuelve el token (ver `src/lib/finzen/category-color.ts`), así que
 * esta migración es ADITIVA: el código es desplegable antes de migrar los datos.
 *
 * ── Uso ──────────────────────────────────────────────────────────────────────
 *   bun run scripts/migrate-category-colors.ts            # dry-run (por defecto)
 *   bun run scripts/migrate-category-colors.ts --dry-run  # dry-run explícito
 *   bun run scripts/migrate-category-colors.ts --apply    # escribe (con backup)
 *   bun run scripts/migrate-category-colors.ts --rollback db/category-colors.<ts>.backup
 *
 * ── Conexión ─────────────────────────────────────────────────────────────────
 * `DATABASE_URL` si está definida (Turso `libsql://` → `@prisma/adapter-libsql`;
 * `file:` → SQLite local). Sin `DATABASE_URL`, en dev usa `file:db/custom.db`.
 * NO importa `src/lib/db.ts` a propósito: ese módulo hace fail-fast en
 * producción y copiaría la BD de seed; aquí la conexión es explícita.
 *
 * ── Garantías ───────────────────────────────────────────────────────────────
 * - **Dry-run por defecto**: sin `--apply` no se escribe NADA.
 * - **Backup** antes de escribir: `db/category-colors.<timestamp>.backup`
 *   (formato `[{ id, oldColor }]`; ignorado por git vía `db/*.backup`).
 * - **Idempotente**: las filas ya en `cat-N` se saltan y `color IS NULL` se
 *   dejan intactas (la vista resuelve el fallback `cat-12`).
 * - **Rollback**: `--rollback <archivo>` restaura los colores anteriores.
 * - **Producción**: cualquier operación (dry-run, `--apply` o `--rollback`)
 *   contra un destino Turso exige `--allow-production`; sin la flag el script
 *   aborta ANTES de abrir conexión (la ejecución en producción la autoriza el
 *   dueño por separado).
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { isCategoryColorKey, normalizeCategoryColor } from '../src/lib/finzen/category-color';

type Mode = 'dry-run' | 'apply' | 'rollback';

interface CliOptions {
  mode: Mode;
  rollbackFile?: string;
  allowProduction: boolean;
}

interface CategoryRow {
  id: string;
  color: string | null;
}

interface BackupEntry {
  id: string;
  oldColor: string | null;
}

interface PendingRow {
  id: string;
  oldColor: string;
  newColor: string;
}

const BATCH_SIZE = 100;
const DEFAULT_FILE_URL = 'file:db/custom.db';
const BACKUP_DIR = 'db';

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
          'migrate-category-colors — fase 10-U1',
          '',
          '  (sin flags)         dry-run: lista los cambios, no escribe',
          '  --dry-run           dry-run explícito',
          '  --apply             escribe los cambios (crea un backup antes)',
          '  --rollback <file>   restaura los colores de un backup',
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
// Migración
// ─────────────────────────────────────────────────────────────────────────────

/** Divide un array en lotes de `size`. */
function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function timestampSlug(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function collectPending(prisma: PrismaClient): Promise<{
  pending: PendingRow[];
  alreadyToken: number;
  nullColor: number;
  total: number;
}> {
  const rows = await prisma.category.findMany({
    select: { id: true, color: true },
  });

  const pending: PendingRow[] = [];
  let alreadyToken = 0;
  let nullColor = 0;

  for (const row of rows as CategoryRow[]) {
    if (row.color === null || row.color === undefined) {
      nullColor++;
      continue;
    }
    if (isCategoryColorKey(row.color)) {
      alreadyToken++;
      continue;
    }
    pending.push({
      id: row.id,
      oldColor: row.color,
      newColor: normalizeCategoryColor(row.color),
    });
  }

  return { pending, alreadyToken, nullColor, total: rows.length };
}

async function applyChanges(prisma: PrismaClient, pending: PendingRow[]): Promise<string> {
  // 1. Backup ANTES de escribir.
  const backupDir = join(process.cwd(), BACKUP_DIR);
  if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });
  const backupPath = join(
    backupDir,
    `category-colors.${timestampSlug()}.backup`
  );
  const backup: BackupEntry[] = pending.map((row) => ({ id: row.id, oldColor: row.oldColor }));
  writeFileSync(backupPath, `${JSON.stringify(backup, null, 2)}\n`, 'utf-8');
  console.log(`[migrate-category-colors] backup escrito: ${backupPath}`);

  // 2. UPDATE en lotes de 100, cada lote dentro de una transacción.
  let written = 0;
  for (const batch of chunk(pending, BATCH_SIZE)) {
    await prisma.$transaction(
      batch.map((row) =>
        prisma.category.update({ where: { id: row.id }, data: { color: row.newColor } })
      )
    );
    written += batch.length;
    console.log(`[migrate-category-colors] ${written}/${pending.length} filas actualizadas`);
  }

  console.log(
    `[migrate-category-colors] rollback: bun run scripts/migrate-category-colors.ts --rollback "${backupPath}"`
  );
  return backupPath;
}

async function rollback(prisma: PrismaClient, backupPath: string): Promise<void> {
  const absolute = isAbsolute(backupPath) ? backupPath : resolve(process.cwd(), backupPath);
  if (!existsSync(absolute)) {
    throw new Error(`No existe el backup: ${absolute}`);
  }
  const parsed: unknown = JSON.parse(readFileSync(absolute, 'utf-8'));
  if (!Array.isArray(parsed)) {
    throw new Error(`Backup con formato inválido: ${absolute}`);
  }
  const entries = parsed as BackupEntry[];

  let restored = 0;
  for (const batch of chunk(entries, BATCH_SIZE)) {
    await prisma.$transaction(
      batch.map((entry) =>
        prisma.category.update({
          where: { id: entry.id },
          data: { color: entry.oldColor },
        })
      )
    );
    restored += batch.length;
    console.log(`[migrate-category-colors] ${restored}/${entries.length} filas restauradas`);
  }
  console.log(`[migrate-category-colors] rollback completado desde ${absolute}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  const rawUrl = process.env.DATABASE_URL?.trim() || DEFAULT_FILE_URL;
  const url = resolveFileUrl(rawUrl);
  const isProductionTarget = url.startsWith('libsql:');

  console.log(`[migrate-category-colors] destino: ${describeTarget(url)}`);
  console.log(`[migrate-category-colors] modo: ${options.mode}`);

  if (isProductionTarget) {
    console.warn(
      '[migrate-category-colors] ⚠️  DESTINO DE PRODUCCIÓN (Turso). La ejecución la autoriza el dueño.'
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

    const { pending, alreadyToken, nullColor, total } = await collectPending(prisma);

    console.log(
      `[migrate-category-colors] categorías: ${total} · ya en token: ${alreadyToken} · sin color (intactas): ${nullColor} · a migrar: ${pending.length}`
    );

    if (pending.length === 0) {
      console.log('[migrate-category-colors] nada que migrar — la base ya está normalizada.');
      return;
    }

    for (const row of pending) {
      console.log(`  ${row.id} · ${row.oldColor} → ${row.newColor}`);
    }

    if (options.mode === 'dry-run') {
      console.log(
        '[migrate-category-colors] DRY-RUN: no se escribió nada. Usa --apply para aplicar.'
      );
      return;
    }

    await applyChanges(prisma, pending);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('[migrate-category-colors] ERROR:', error instanceof Error ? error.message : error);
  process.exit(1);
});
