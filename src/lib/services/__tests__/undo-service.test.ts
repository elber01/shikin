import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UNDO_MAX_BATCH, type TransactionUndoSnapshot } from '@/lib/finzen/undo';

/**
 * P0 — `undo-service` (restauración de eliminaciones).
 *
 * El snapshot viene del CLIENTE: la única prueba de propiedad es el recibo
 * HMAC. Este suite comprueba, sobre un fake de BD EN MEMORIA, que:
 * - un snapshot sin recibo válido NO escribe nada (0 escrituras),
 * - la doble entrada se respeta (real ↔ `x_<categoryId>`),
 * - el ownership es estricto (categoría ajena → `undo_dependency_missing`),
 * - la importación masiva es todo o nada (lote cambiado → 0 borrados).
 *
 * `src/lib/db.ts` REAL nunca se importa: el módulo se sustituye por un fake
 * con `vi.mock('@/lib/db')` → ni `db/custom.db` ni Turso se tocan.
 */
vi.mock('@/lib/db', async () => {
  const { fakeDb } = await import('./fake-db');
  return { db: fakeDb };
});

const { issueUndoReceipt } = await import('@/lib/services/undo-receipt');
const { undoForUser } = await import('@/lib/services/undo-service');
const { fakeDb } = await import('./fake-db');

const USER = 'user-1';
const OTHER_USER = 'user-2';
const CATEGORY = 'cat-1';
const ACCOUNT = 'acc-1';

function txSnapshot(overrides: Partial<TransactionUndoSnapshot> = {}): TransactionUndoSnapshot {
  return {
    id: 'tx-1',
    type: 'expense',
    amount: 100,
    currency: 'DOP',
    fromAccountId: ACCOUNT,
    toAccountId: `x_${CATEGORY}`,
    categoryId: CATEGORY,
    description: 'Cena',
    occurredOn: '2026-11-15T10:00:00.000Z',
    tags: 'manual',
    importSource: null,
    createdAt: '2026-11-15T10:00:00.000Z',
    updatedAt: '2026-11-15T10:00:00.000Z',
    ...overrides,
  };
}

/** Snapshot + recibo válidos (la firma es la prueba de propiedad). */
function signedTransaction(snapshot: TransactionUndoSnapshot) {
  return {
    kind: 'transaction' as const,
    snapshot,
    receipt: issueUndoReceipt(USER, 'transaction', snapshot.id, snapshot),
  };
}

function seedHappyPath() {
  fakeDb.accounts.set(ACCOUNT, {
    id: ACCOUNT,
    userId: USER,
    name: 'Cuenta corriente',
    accountType: 'asset',
    subType: 'checking',
    currency: 'DOP',
    currentBalance: 1000,
    institution: null,
    lastFour: null,
  });
  fakeDb.categories.set(CATEGORY, {
    id: CATEGORY,
    userId: null,
    name: 'Comida',
    nameEs: 'Comida',
    nameEn: 'Food',
    icon: '🍽️',
    color: 'cat-1',
    direction: 'expense',
    isSystem: true,
    sortOrder: 1,
  });
}

beforeEach(() => {
  fakeDb.reset();
  seedHappyPath();
});

describe('guardarraíl de la base de datos', () => {
  it('NO carga el db real: el módulo @/lib/db está sustituido por el fake', async () => {
    const dbModule = await import('@/lib/db');
    expect(dbModule.db).toBe(fakeDb);
    // Si el módulo real se hubiera evaluado, existiría un PrismaClient real
    // (y su constructor tocaría db/custom.db o Turso al inicializarse).
    expect(dbModule.db).not.toHaveProperty('user');
    expect(dbModule.db).not.toHaveProperty('apiKey');
  });
});

describe('undo-service — doble entrada y validaciones', () => {
  it('restaura un gasto real → x_<categoryId> preservando id y campos', async () => {
    const snapshot = txSnapshot();
    const result = await undoForUser(USER, signedTransaction(snapshot));

    expect(result.success).toBe(true);
    if (result.success && result.kind === 'transaction') {
      expect(result.outcome).toBe('restored');
      expect(result.restoredId).toBe('tx-1');
    }
    expect(fakeDb.writeCount).toBe(1);
    expect(fakeDb.transactions.get('tx-1')?.toAccountId).toBe(`x_${CATEGORY}`);
  });

  it('restaura un ingreso x_<categoryId> → real preservando id y campos', async () => {
    // La otra mitad de la doble entrada: el ingreso sale de la cuenta virtual
    // de la categoría y entra en una cuenta REAL del usuario.
    const snapshot = txSnapshot({
      id: 'tx-income-1',
      type: 'income',
      amount: 250,
      fromAccountId: `x_${CATEGORY}`,
      toAccountId: ACCOUNT,
    });
    const result = await undoForUser(USER, signedTransaction(snapshot));

    expect(result.success).toBe(true);
    if (result.success && result.kind === 'transaction') {
      expect(result.outcome).toBe('restored');
      expect(result.restoredId).toBe('tx-income-1');
    }
    // 1 escritura (create) y el par de cuentas es exactamente x_<cat> → real.
    expect(fakeDb.writeCount).toBe(1);
    expect(fakeDb.writes[0]?.op).toBe('create');
    const restored = fakeDb.transactions.get('tx-income-1');
    expect(restored).toBeDefined();
    expect(restored?.type).toBe('income');
    expect(restored?.fromAccountId).toBe(`x_${CATEGORY}`);
    expect(restored?.toAccountId).toBe(ACCOUNT);
    expect(restored?.categoryId).toBe(CATEGORY);
    expect(restored?.amount).toBe(250);
  });

  it('rechaza un gasto que NO apunta a x_<categoryId> → invalid_transaction', async () => {
    const snapshot = txSnapshot({ toAccountId: 'otra-cuenta' });
    const result = await undoForUser(USER, signedTransaction(snapshot));

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('invalid_transaction');
    expect(fakeDb.writeCount).toBe(0);
  });

  it('rechaza un ingreso que NO sale de x_<categoryId> → invalid_transaction', async () => {
    const snapshot = txSnapshot({
      type: 'income',
      fromAccountId: 'otra-cuenta',
      toAccountId: ACCOUNT,
    });
    const result = await undoForUser(USER, signedTransaction(snapshot));

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('invalid_transaction');
    expect(fakeDb.writeCount).toBe(0);
  });

  it('rechaza una transferencia con una cuenta virtual x_* → invalid_transaction', async () => {
    const snapshot = txSnapshot({
      type: 'transfer',
      fromAccountId: `x_${CATEGORY}`,
      toAccountId: ACCOUNT,
    });
    const result = await undoForUser(USER, signedTransaction(snapshot));

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('invalid_transaction');
    expect(fakeDb.writeCount).toBe(0);
  });

  it('rechaza una cuenta con id virtual x_* → invalid_account', async () => {
    const snapshot = {
      id: 'x_cat-1',
      name: 'Cuenta virtual',
      accountType: 'asset',
      subType: null,
      currency: 'DOP',
      currentBalance: 0,
      institution: null,
      lastFour: null,
    };
    const result = await undoForUser(USER, {
      kind: 'account',
      snapshot,
      receipt: issueUndoReceipt(USER, 'account', 'x_cat-1', snapshot),
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('invalid_account');
    expect(fakeDb.writeCount).toBe(0);
  });

  it('rechaza una categoría con isSystem !== false → invalid_category', async () => {
    const snapshot = {
      id: 'cat-nueva',
      name: 'Nueva',
      nameEs: null,
      nameEn: null,
      icon: null,
      color: null,
      direction: 'expense',
      isSystem: true,
      sortOrder: 9,
    };
    const result = await undoForUser(USER, {
      kind: 'category',
      snapshot,
      receipt: issueUndoReceipt(USER, 'category', 'cat-nueva', snapshot),
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('invalid_category');
    expect(fakeDb.writeCount).toBe(0);
  });
});

describe('undo-service — ownership y dependencias', () => {
  it('sin recibo válido NO escribe nada → invalid_undo_payload', async () => {
    const snapshot = txSnapshot();
    const result = await undoForUser(USER, {
      kind: 'transaction',
      snapshot,
      receipt: 'recibo-falso. firma-falsa',
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('invalid_undo_payload');
    expect(fakeDb.writeCount).toBe(0);
  });

  it('un snapshot ALTERADO con el recibo original NO escribe nada', async () => {
    const snapshot = txSnapshot();
    const receipt = issueUndoReceipt(USER, 'transaction', snapshot.id, snapshot);
    const result = await undoForUser(USER, {
      kind: 'transaction',
      snapshot: { ...snapshot, amount: 5000 },
      receipt,
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('invalid_undo_payload');
    expect(fakeDb.writeCount).toBe(0);
  });

  it('una cuenta real ausente → undo_dependency_missing con 0 escrituras', async () => {
    fakeDb.accounts.delete(ACCOUNT);
    const snapshot = txSnapshot();
    const result = await undoForUser(USER, signedTransaction(snapshot));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('undo_dependency_missing');
      expect(result.dependency).toBe(ACCOUNT);
    }
    expect(fakeDb.writeCount).toBe(0);
  });

  it('una categoría AJENA (isSystem:true de otro usuario) → undo_dependency_missing con 0 escrituras', async () => {
    fakeDb.categories.set(CATEGORY, {
      id: CATEGORY,
      userId: OTHER_USER,
      name: 'Comida',
      nameEs: null,
      nameEn: null,
      icon: null,
      color: null,
      direction: 'expense',
      isSystem: true,
      sortOrder: 1,
    });
    const snapshot = txSnapshot();
    const result = await undoForUser(USER, signedTransaction(snapshot));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('undo_dependency_missing');
      expect(result.dependency).toBe(CATEGORY);
    }
    expect(fakeDb.writeCount).toBe(0);
  });
});

describe('undo-service — conflictos de id', () => {
  it('una fila existente DISTINTA → undo_conflict sin sobrescribir', async () => {
    const snapshot = txSnapshot();
    fakeDb.transactions.set('tx-1', {
      ...snapshot,
      userId: USER,
      occurredOn: new Date(snapshot.occurredOn),
      createdAt: new Date(snapshot.createdAt),
      updatedAt: new Date(snapshot.updatedAt),
      amount: 999,
    });

    const result = await undoForUser(USER, signedTransaction(snapshot));

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('undo_conflict');
    expect(fakeDb.writeCount).toBe(0);
    expect(fakeDb.transactions.get('tx-1')?.amount).toBe(999);
  });

  it('una fila existente IDÉNTICA → already_restored sin escribir', async () => {
    const snapshot = txSnapshot();
    fakeDb.transactions.set('tx-1', {
      ...snapshot,
      userId: USER,
      occurredOn: new Date(snapshot.occurredOn),
      createdAt: new Date(snapshot.createdAt),
      updatedAt: new Date(snapshot.updatedAt),
    });

    const result = await undoForUser(USER, signedTransaction(snapshot));

    expect(result.success).toBe(true);
    if (result.success) expect(result.outcome).toBe('already_restored');
    expect(fakeDb.writeCount).toBe(0);
  });
});

describe('undo-service — importación masiva (todo o nada)', () => {
  function batchSnapshot(rows: Array<{ id: string; updatedAt: string }>) {
    return {
      batchId: 'batch-1',
      transactions: rows.map((row) => ({
        id: row.id,
        updatedAt: row.updatedAt,
        tags: 'batch-1',
        importSource: 'csv' as const,
      })),
    };
  }

  function seedImportedTx(id: string, updatedAt: string) {
    fakeDb.transactions.set(id, {
      id,
      userId: USER,
      type: 'expense',
      amount: 10,
      currency: 'DOP',
      fromAccountId: ACCOUNT,
      toAccountId: `x_${CATEGORY}`,
      categoryId: CATEGORY,
      description: 'Importada',
      occurredOn: new Date('2026-11-01T10:00:00.000Z'),
      tags: 'batch-1',
      importSource: 'csv',
      createdAt: new Date('2026-11-01T10:00:00.000Z'),
      updatedAt: new Date(updatedAt),
    });
  }

  it('un lote con UNA fila cambiada → undo_batch_conflict con 0 borrados', async () => {
    seedImportedTx('tx-a', '2026-11-01T10:00:00.000Z');
    seedImportedTx('tx-b', '2026-11-02T10:00:00.000Z');
    const snapshot = batchSnapshot([
      { id: 'tx-a', updatedAt: '2026-11-01T10:00:00.000Z' },
      { id: 'tx-b', updatedAt: '2026-11-02T11:00:00.000Z' }, // CAMBIADA
    ]);

    const result = await undoForUser(USER, {
      kind: 'import_batch',
      snapshot,
      receipt: issueUndoReceipt(USER, 'import_batch', snapshot.batchId, snapshot),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('undo_batch_conflict');
      expect(result.changedCount).toBe(1);
    }
    expect(fakeDb.writeCount).toBe(0);
    expect(fakeDb.transactions.has('tx-a')).toBe(true);
    expect(fakeDb.transactions.has('tx-b')).toBe(true);
  });

  it('un lote OK → deleteMany con los ids correctos', async () => {
    seedImportedTx('tx-a', '2026-11-01T10:00:00.000Z');
    seedImportedTx('tx-b', '2026-11-02T10:00:00.000Z');
    const snapshot = batchSnapshot([
      { id: 'tx-a', updatedAt: '2026-11-01T10:00:00.000Z' },
      { id: 'tx-b', updatedAt: '2026-11-02T10:00:00.000Z' },
    ]);

    const result = await undoForUser(USER, {
      kind: 'import_batch',
      snapshot,
      receipt: issueUndoReceipt(USER, 'import_batch', snapshot.batchId, snapshot),
    });

    expect(result.success).toBe(true);
    if (result.success && result.kind === 'import_batch') {
      expect(result.outcome).toBe('removed');
      expect(result.deletedCount).toBe(2);
    }
    const deleteWrite = fakeDb.writes.find((w) => w.op === 'deleteMany');
    expect(deleteWrite).toBeDefined();
    expect(deleteWrite?.payload).toEqual({
      id: { in: ['tx-a', 'tx-b'] },
      userId: USER,
    });
    expect(fakeDb.transactions.size).toBe(0);
  });

  it('un lote reintentado (ya borrado) → already_removed sin borrados', async () => {
    const snapshot = batchSnapshot([
      { id: 'tx-a', updatedAt: '2026-11-01T10:00:00.000Z' },
    ]);

    const result = await undoForUser(USER, {
      kind: 'import_batch',
      snapshot,
      receipt: issueUndoReceipt(USER, 'import_batch', snapshot.batchId, snapshot),
    });

    expect(result.success).toBe(true);
    if (result.success && result.kind === 'import_batch') {
      expect(result.outcome).toBe('already_removed');
      expect(result.deletedCount).toBe(0);
      expect(result.skippedCount).toBe(1);
    }
    expect(fakeDb.writeCount).toBe(0);
  });

  it('un lote con MÁS de UNDO_MAX_BATCH filas → undo_batch_too_large', async () => {
    const rows = Array.from({ length: UNDO_MAX_BATCH + 1 }, (_, index) => ({
      id: `tx-${index}`,
      updatedAt: '2026-11-01T10:00:00.000Z',
    }));
    const snapshot = batchSnapshot(rows);

    const result = await undoForUser(USER, {
      kind: 'import_batch',
      snapshot,
      receipt: issueUndoReceipt(USER, 'import_batch', snapshot.batchId, snapshot),
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe('undo_batch_too_large');
    expect(fakeDb.writeCount).toBe(0);
  });
});
