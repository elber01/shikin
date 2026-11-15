import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { db } from '@/lib/db';
import { issueUndoReceipt } from '@/lib/services/undo-receipt';
import { undoForUser } from '@/lib/services/undo-service';
import type { TransactionUndoSnapshot } from '@/lib/finzen/undo';

/**
 * P3 — Servicios contra una BD REAL (SQLite TEMPORAL), no contra un fake.
 *
 * La BD de test la monta `tests/global-setup.ts`:
 * - `mkdtempSync(os.tmpdir())` → ruta temporal, BORRADA al terminar.
 * - `DATABASE_URL` del entorno se SOBREESCRIBE: ni `db/custom.db` ni Turso
 *   son alcanzables desde los tests.
 *
 * Este suite NO usa `vi.mock('@/lib/db')`: importa el cliente real (que
 * apunta al temporal thanks to `DATABASE_URL`) y comprueba que el undo
 * escribe filas de verdad — y que un recibo inválido NO escribe.
 */

const USER_ID = 'user-db-1';
const ACCOUNT_ID = 'acc-db-1';
const CATEGORY_ID = 'cat-db-1';
const TX_ID = 'tx-db-1';

function snapshot(): TransactionUndoSnapshot {
  return {
    id: TX_ID,
    type: 'expense',
    amount: 100,
    currency: 'DOP',
    fromAccountId: ACCOUNT_ID,
    toAccountId: `x_${CATEGORY_ID}`,
    categoryId: CATEGORY_ID,
    description: 'Prueba P3',
    occurredOn: '2026-11-15T12:00:00.000Z',
    tags: 'manual',
    importSource: null,
    createdAt: '2026-11-15T12:00:00.000Z',
    updatedAt: '2026-11-15T12:00:00.000Z',
  };
}

describe('servicios contra la BD temporal (P3)', () => {
  beforeAll(async () => {
    await db.user.create({
      data: {
        id: USER_ID,
        email: 'p3-test@example.invalid',
        name: 'P3 Test',
        passwordHash: 'not-a-real-hash',
      },
    });
    await db.account.create({
      data: {
        id: ACCOUNT_ID,
        userId: USER_ID,
        name: 'Cuenta P3',
        accountType: 'asset',
        currency: 'DOP',
      },
    });
    await db.category.create({
      data: {
        id: CATEGORY_ID,
        userId: USER_ID,
        name: 'Food',
        direction: 'expense',
      },
    });
  });

  afterAll(async () => {
    // Limpieza por userId (CASCADE borra cuentas, categorías y transacciones).
    await db.user.deleteMany({ where: { id: USER_ID } });
    await db.$disconnect();
    // `src/lib/db.ts` cachea el cliente en `globalThis.prisma`: si otro
    // fichero de test reutilizara el mismo worker, no debe heredar un cliente
    // ya desconectado.
    Reflect.deleteProperty(globalThis, 'prisma');
  });

  it('la BD de test es un SQLite TEMPORAL (nunca db/custom.db ni Turso)', () => {
    const url = process.env.DATABASE_URL ?? '';
    expect(url.startsWith('file:')).toBe(true);
    expect(url.startsWith('libsql:')).toBe(false);

    const dbFile = url.replace(/^file:/, '');
    expect(dbFile.startsWith(tmpdir())).toBe(true);
    expect(dbFile).not.toContain('custom.db');
    expect(dbFile).not.toContain('turso');
  });

  it('un recibo INVÁLIDO no escribe nada en la BD real', async () => {
    const before = await db.transaction.count({ where: { userId: USER_ID } });

    const result = await undoForUser(USER_ID, {
      kind: 'transaction',
      snapshot: snapshot(),
      receipt: 'recibo-fabricado',
    });

    expect(result.success).toBe(false);
    const after = await db.transaction.count({ where: { userId: USER_ID } });
    expect(after).toBe(before);
    expect(await db.transaction.findUnique({ where: { id: TX_ID } })).toBeNull();
  });

  it('un recibo VÁLIDO restaura la transacción en la BD real', async () => {
    const snap = snapshot();
    const receipt = issueUndoReceipt(USER_ID, 'transaction', snap.id, snap);

    const result = await undoForUser(USER_ID, { kind: 'transaction', snapshot: snap, receipt });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('se esperaba un resultado de éxito');

    const restored = await db.transaction.findUnique({ where: { id: TX_ID } });
    expect(restored).not.toBeNull();
    expect(restored!.userId).toBe(USER_ID);
    expect(restored!.amount).toBe(100);
    expect(restored!.type).toBe('expense');
    // Double-entry: real -> x_<categoryId>
    expect(restored!.fromAccountId).toBe(ACCOUNT_ID);
    expect(restored!.toAccountId).toBe(`x_${CATEGORY_ID}`);
  });

  it('el esquema de la BD temporal tiene las tablas de schema.prisma', async () => {
    const rows = await db.$queryRawUnsafe<Array<{ name: string }>>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );
    const tables = rows.map((r) => r.name);

    const schema = readFileSync(resolve(process.cwd(), 'prisma', 'schema.prisma'), 'utf8');
    const models = [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1]).sort();

    expect(models.length).toBeGreaterThan(0);
    expect(tables).toEqual(expect.arrayContaining(models));
  });
});
