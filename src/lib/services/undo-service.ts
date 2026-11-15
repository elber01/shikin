import { db } from '@/lib/db';
import { normalizeCategoryColor } from '@/lib/finzen/category-color';
import type { CurrencyCode } from '@/lib/finzen/currency';
import { reportError } from '@/lib/finzen/error-report';
import { issueUndoReceipt, verifyUndoReceipt } from '@/lib/services/undo-receipt';
import {
  UNDO_MAX_BATCH,
  type AccountUndoSnapshot,
  type BudgetItemUndoSnapshot,
  type CategoryUndoSnapshot,
  type ImportBatchUndoSnapshot,
  type TransactionUndoSnapshot,
  type UndoCommand,
  type UndoErrorCode,
  type UndoErrorResult,
  type UndoServiceResult,
} from '@/lib/finzen/undo';

const CURRENCY_CODES: readonly CurrencyCode[] = ['USD', 'DOP', 'EUR', 'USDT', 'BTC'];
const TRANSACTION_TYPES = ['income', 'expense', 'transfer', 'adjustment'] as const;
const ACCOUNT_TYPES = ['asset', 'liability', 'investment', 'equity', 'income', 'expense'] as const;
const CATEGORY_DIRECTIONS = ['income', 'expense', 'transfer'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isIntegerNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && CURRENCY_CODES.includes(value as CurrencyCode);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function isTransactionType(value: unknown): value is TransactionUndoSnapshot['type'] {
  return (
    typeof value === 'string' &&
    TRANSACTION_TYPES.includes(value as TransactionUndoSnapshot['type'])
  );
}

function isAccountType(value: unknown): value is string {
  return typeof value === 'string' && ACCOUNT_TYPES.includes(value as (typeof ACCOUNT_TYPES)[number]);
}

function isCategoryDirection(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    CATEGORY_DIRECTIONS.includes(value as (typeof CATEGORY_DIRECTIONS)[number])
  );
}

function parseTransactionSnapshot(value: unknown): TransactionUndoSnapshot | null {
  if (!isRecord(value)) return null;
  if (!isNonEmptyString(value.id)) return null;
  if (!isTransactionType(value.type)) return null;
  if (!isFiniteNumber(value.amount) || value.amount <= 0) return null;
  if (!isCurrencyCode(value.currency)) return null;
  if (!isNonEmptyString(value.fromAccountId) || !isNonEmptyString(value.toAccountId)) return null;
  if (!isNullableString(value.categoryId)) return null;
  if (!isNullableString(value.description)) return null;
  if (!isIsoDate(value.occurredOn)) return null;
  if (typeof value.tags !== 'string') return null;
  if (!isNullableString(value.importSource)) return null;
  if (!isIsoDate(value.createdAt) || !isIsoDate(value.updatedAt)) return null;

  return {
    id: value.id,
    type: value.type,
    amount: value.amount,
    currency: value.currency,
    fromAccountId: value.fromAccountId,
    toAccountId: value.toAccountId,
    categoryId: value.categoryId,
    description: value.description,
    occurredOn: value.occurredOn,
    tags: value.tags,
    importSource: value.importSource,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function parseAccountSnapshot(value: unknown): AccountUndoSnapshot | null {
  if (!isRecord(value)) return null;
  if (!isNonEmptyString(value.id) || value.id.startsWith('x_')) return null;
  if (!isNonEmptyString(value.name)) return null;
  if (!isAccountType(value.accountType)) return null;
  if (!isNullableString(value.subType)) return null;
  if (!isCurrencyCode(value.currency)) return null;
  if (!isFiniteNumber(value.currentBalance)) return null;
  if (!isNullableString(value.institution) || !isNullableString(value.lastFour)) return null;

  return {
    id: value.id,
    name: value.name,
    accountType: value.accountType,
    subType: value.subType,
    currency: value.currency,
    currentBalance: value.currentBalance,
    institution: value.institution,
    lastFour: value.lastFour,
  };
}

function parseCategorySnapshot(value: unknown): CategoryUndoSnapshot | null {
  if (!isRecord(value)) return null;
  if (!isNonEmptyString(value.id)) return null;
  if (!isNonEmptyString(value.name)) return null;
  if (!isNullableString(value.nameEs) || !isNullableString(value.nameEn)) return null;
  if (!isNullableString(value.icon) || !isNullableString(value.color)) return null;
  if (!isCategoryDirection(value.direction)) return null;
  if (value.isSystem !== false || !isIntegerNumber(value.sortOrder)) return null;

  return {
    id: value.id,
    name: value.name,
    nameEs: value.nameEs,
    nameEn: value.nameEn,
    icon: value.icon,
    color: value.color,
    direction: value.direction,
    isSystem: value.isSystem,
    sortOrder: value.sortOrder,
  };
}

function parseBudgetItemSnapshot(value: unknown): BudgetItemUndoSnapshot | null {
  if (!isRecord(value)) return null;
  if (!isNonEmptyString(value.id)) return null;
  if (!isNonEmptyString(value.budgetId) || !isNonEmptyString(value.categoryId)) return null;
  if (!isFiniteNumber(value.plannedAmount) || value.plannedAmount < 0) return null;
  if (
    !isIntegerNumber(value.alertThresholdPct) ||
    value.alertThresholdPct < 1 ||
    value.alertThresholdPct > 100
  ) {
    return null;
  }

  return {
    id: value.id,
    budgetId: value.budgetId,
    categoryId: value.categoryId,
    plannedAmount: value.plannedAmount,
    alertThresholdPct: value.alertThresholdPct,
  };
}

function parseImportBatchSnapshot(value: unknown): ImportBatchUndoSnapshot | null {
  if (!isRecord(value)) return null;
  if (!isNonEmptyString(value.batchId) || !Array.isArray(value.transactions)) return null;

  const transactions: ImportBatchUndoSnapshot['transactions'] = [];
  for (const row of value.transactions) {
    if (!isRecord(row)) return null;
    if (!isNonEmptyString(row.id) || !isIsoDate(row.updatedAt)) return null;
    if (typeof row.tags !== 'string') return null;
    if (row.importSource !== 'csv' && row.importSource !== 'bank') return null;
    transactions.push({
      id: row.id,
      updatedAt: row.updatedAt,
      tags: row.tags,
      importSource: row.importSource,
    });
  }

  return { batchId: value.batchId, transactions };
}

type ParsedUndoCommand =
  | { ok: true; command: UndoCommand }
  | { ok: false; error: UndoErrorCode };

function parseCommand(input: unknown): ParsedUndoCommand {
  if (
    !isRecord(input) ||
    !isNonEmptyString(input.kind) ||
    !isNonEmptyString(input.receipt)
  ) {
    return { ok: false, error: 'invalid_undo_payload' };
  }

  const receipt = input.receipt;

  switch (input.kind) {
    case 'transaction': {
      const snapshot = parseTransactionSnapshot(input.snapshot);
      return snapshot
        ? { ok: true, command: { kind: 'transaction', snapshot, receipt } }
        : { ok: false, error: 'invalid_transaction' };
    }
    case 'account': {
      const snapshot = parseAccountSnapshot(input.snapshot);
      return snapshot
        ? { ok: true, command: { kind: 'account', snapshot, receipt } }
        : { ok: false, error: 'invalid_account' };
    }
    case 'category': {
      const snapshot = parseCategorySnapshot(input.snapshot);
      return snapshot
        ? { ok: true, command: { kind: 'category', snapshot, receipt } }
        : { ok: false, error: 'invalid_category' };
    }
    case 'budget_item': {
      const snapshot = parseBudgetItemSnapshot(input.snapshot);
      return snapshot
        ? { ok: true, command: { kind: 'budget_item', snapshot, receipt } }
        : { ok: false, error: 'invalid_budget_item' };
    }
    case 'import_batch': {
      const snapshot = parseImportBatchSnapshot(input.snapshot);
      return snapshot
        ? { ok: true, command: { kind: 'import_batch', snapshot, receipt } }
        : { ok: false, error: 'invalid_undo_payload' };
    }
    default:
      return { ok: false, error: 'invalid_undo_payload' };
  }
}

function errorResult(
  error: UndoErrorCode,
  message?: string,
  extra?: Pick<UndoErrorResult, 'changedCount' | 'dependency'>
): UndoErrorResult {
  return { success: false, error, ...(message ? { message } : {}), ...extra };
}

function sameNullableString(left: string | null, right: string | null): boolean {
  return left === right;
}

function sameDate(left: Date, right: string): boolean {
  return left.getTime() === new Date(right).getTime();
}

/**
 * Una categoría solo es restaurable si pertenece al usuario de la sesión o
 * si es una categoría global real del sistema (`userId: null` + `isSystem`).
 */
async function categoryIsAvailableForUser(
  userId: string,
  categoryId: string
): Promise<boolean> {
  const category = await db.category.findUnique({
    where: { id: categoryId },
    select: { userId: true, isSystem: true },
  });

  if (!category) return false;
  return (
    category.userId === userId ||
    (category.userId === null && category.isSystem === true)
  );
}

async function restoreTransaction(
  userId: string,
  snapshot: TransactionUndoSnapshot
): Promise<UndoServiceResult> {
  const existing = await db.transaction.findUnique({ where: { id: snapshot.id } });
  if (existing) {
    const sameContent =
      existing.userId === userId &&
      existing.type === snapshot.type &&
      existing.amount === snapshot.amount &&
      existing.currency === snapshot.currency &&
      existing.fromAccountId === snapshot.fromAccountId &&
      existing.toAccountId === snapshot.toAccountId &&
      sameNullableString(existing.categoryId, snapshot.categoryId) &&
      sameNullableString(existing.description, snapshot.description) &&
      sameDate(existing.occurredOn, snapshot.occurredOn) &&
      existing.tags === snapshot.tags &&
      sameNullableString(existing.importSource, snapshot.importSource) &&
      sameDate(existing.createdAt, snapshot.createdAt) &&
      sameDate(existing.updatedAt, snapshot.updatedAt);

    if (sameContent) {
      return {
        success: true,
        kind: 'transaction',
        outcome: 'already_restored',
        restoredId: snapshot.id,
      };
    }
    return errorResult('undo_conflict', 'The transaction ID already exists with different content');
  }

  if (snapshot.fromAccountId.includes('x_undefined') || snapshot.toAccountId.includes('x_undefined')) {
    return errorResult('invalid_transaction', 'Legacy transaction has an undefined virtual category');
  }

  if (snapshot.type === 'expense' || snapshot.type === 'income') {
    if (!snapshot.categoryId) {
      return errorResult('invalid_transaction', 'A category is required for income and expense');
    }
    const expectedVirtualAccount = `x_${snapshot.categoryId}`;
    if (snapshot.type === 'expense' && snapshot.toAccountId !== expectedVirtualAccount) {
      return errorResult('invalid_transaction', 'Expense must target its category virtual account');
    }
    if (snapshot.type === 'income' && snapshot.fromAccountId !== expectedVirtualAccount) {
      return errorResult('invalid_transaction', 'Income must originate from its category virtual account');
    }
  }

  const realAccountIds =
    snapshot.type === 'expense'
      ? [snapshot.fromAccountId]
      : snapshot.type === 'income'
        ? [snapshot.toAccountId]
        : [snapshot.fromAccountId, snapshot.toAccountId];

  if (realAccountIds.some((id) => id.startsWith('x_'))) {
    return errorResult('invalid_transaction', 'Both ends of a transfer or adjustment must be real accounts');
  }

  const realAccounts = await db.account.findMany({
    where: { id: { in: realAccountIds }, userId },
    select: { id: true },
  });
  if (realAccounts.length !== realAccountIds.length) {
    const missingId = realAccountIds.find((id) => !realAccounts.some((account) => account.id === id));
    return errorResult(
      'undo_dependency_missing',
      'A real account required by the transaction no longer exists',
      missingId ? { dependency: missingId } : undefined
    );
  }

  if (snapshot.categoryId) {
    const categoryAvailable = await categoryIsAvailableForUser(
      userId,
      snapshot.categoryId
    );
    if (!categoryAvailable) {
      return errorResult(
        'undo_dependency_missing',
        'The category required by the transaction is not available to this user',
        { dependency: snapshot.categoryId }
      );
    }
  }

  await db.transaction.create({
    data: {
      id: snapshot.id,
      userId,
      type: snapshot.type,
      amount: snapshot.amount,
      currency: snapshot.currency,
      fromAccountId: snapshot.fromAccountId,
      toAccountId: snapshot.toAccountId,
      categoryId: snapshot.categoryId,
      description: snapshot.description,
      occurredOn: new Date(snapshot.occurredOn),
      tags: snapshot.tags,
      importSource: snapshot.importSource,
      createdAt: new Date(snapshot.createdAt),
      updatedAt: new Date(snapshot.updatedAt),
    },
  });

  return {
    success: true,
    kind: 'transaction',
    outcome: 'restored',
    restoredId: snapshot.id,
  };
}

async function restoreAccount(
  userId: string,
  snapshot: AccountUndoSnapshot
): Promise<UndoServiceResult> {
  const existing = await db.account.findUnique({ where: { id: snapshot.id } });
  if (existing) {
    const sameContent =
      existing.userId === userId &&
      existing.name === snapshot.name &&
      existing.accountType === snapshot.accountType &&
      sameNullableString(existing.subType, snapshot.subType) &&
      existing.currency === snapshot.currency &&
      existing.currentBalance === snapshot.currentBalance &&
      sameNullableString(existing.institution, snapshot.institution) &&
      sameNullableString(existing.lastFour, snapshot.lastFour);

    if (sameContent) {
      return {
        success: true,
        kind: 'account',
        outcome: 'already_restored',
        restoredId: snapshot.id,
      };
    }
    return errorResult('undo_conflict', 'The account ID already exists with different content');
  }

  await db.account.create({
    data: {
      id: snapshot.id,
      userId,
      name: snapshot.name,
      accountType: snapshot.accountType,
      subType: snapshot.subType,
      currency: snapshot.currency,
      currentBalance: snapshot.currentBalance,
      institution: snapshot.institution,
      lastFour: snapshot.lastFour,
    },
  });

  return {
    success: true,
    kind: 'account',
    outcome: 'restored',
    restoredId: snapshot.id,
  };
}

async function restoreCategory(
  userId: string,
  snapshot: CategoryUndoSnapshot
): Promise<UndoServiceResult> {
  const normalizedColor = normalizeCategoryColor(snapshot.color);
  const existing = await db.category.findUnique({ where: { id: snapshot.id } });
  if (existing) {
    const sameContent =
      existing.userId === userId &&
      existing.name === snapshot.name &&
      sameNullableString(existing.nameEs, snapshot.nameEs) &&
      sameNullableString(existing.nameEn, snapshot.nameEn) &&
      sameNullableString(existing.icon, snapshot.icon) &&
      existing.color === normalizedColor &&
      existing.direction === snapshot.direction &&
      existing.isSystem === snapshot.isSystem &&
      existing.sortOrder === snapshot.sortOrder;

    if (sameContent) {
      return {
        success: true,
        kind: 'category',
        outcome: 'already_restored',
        restoredId: snapshot.id,
      };
    }
    return errorResult('undo_conflict', 'The category ID already exists with different content');
  }

  await db.category.create({
    data: {
      id: snapshot.id,
      userId,
      name: snapshot.name,
      nameEs: snapshot.nameEs,
      nameEn: snapshot.nameEn,
      icon: snapshot.icon,
      color: normalizedColor,
      direction: snapshot.direction,
      isSystem: false,
      sortOrder: snapshot.sortOrder,
    },
  });

  return {
    success: true,
    kind: 'category',
    outcome: 'restored',
    restoredId: snapshot.id,
  };
}

async function restoreBudgetItem(
  userId: string,
  snapshot: BudgetItemUndoSnapshot
): Promise<UndoServiceResult> {
  const existing = await db.budgetItem.findUnique({ where: { id: snapshot.id } });
  if (existing) {
    const sameContent =
      existing.budgetId === snapshot.budgetId &&
      existing.categoryId === snapshot.categoryId &&
      existing.plannedAmount === snapshot.plannedAmount &&
      existing.alertThresholdPct === snapshot.alertThresholdPct;

    if (sameContent) {
      const budgetOwner = await db.budget.findFirst({
        where: { id: snapshot.budgetId, userId },
        select: { id: true },
      });
      if (budgetOwner) {
        return {
          success: true,
          kind: 'budget_item',
          outcome: 'already_restored',
          restoredId: snapshot.id,
        };
      }
    }
    return errorResult('undo_conflict', 'The budget item ID already exists with different content');
  }

  const budget = await db.budget.findFirst({
    where: { id: snapshot.budgetId, userId },
    select: { id: true },
  });
  if (!budget) {
    return errorResult(
      'undo_dependency_missing',
      'The budget required by the item no longer exists',
      { dependency: snapshot.budgetId }
    );
  }

  const categoryAvailable = await categoryIsAvailableForUser(
    userId,
    snapshot.categoryId
  );
  if (!categoryAvailable) {
    return errorResult(
      'undo_dependency_missing',
      'The category required by the item is not available to this user',
      { dependency: snapshot.categoryId }
    );
  }

  await db.budgetItem.create({
    data: {
      id: snapshot.id,
      budgetId: snapshot.budgetId,
      categoryId: snapshot.categoryId,
      plannedAmount: snapshot.plannedAmount,
      alertThresholdPct: snapshot.alertThresholdPct,
    },
  });

  return {
    success: true,
    kind: 'budget_item',
    outcome: 'restored',
    restoredId: snapshot.id,
  };
}

type BatchTransactionOutcome =
  | { kind: 'conflict'; changedCount: number }
  | { kind: 'removed'; deletedCount: number; skippedCount: number };

async function removeImportBatch(
  userId: string,
  snapshot: ImportBatchUndoSnapshot
): Promise<UndoServiceResult> {
  const outcome = await db.$transaction(async (tx): Promise<BatchTransactionOutcome> => {
    const ids = snapshot.transactions.map((row) => row.id);
    const existingRows = await tx.transaction.findMany({
      where: { id: { in: ids } },
      select: { id: true, userId: true, updatedAt: true, tags: true, importSource: true },
    });
    const existingById = new Map(existingRows.map((row) => [row.id, row]));
    const expectedById = new Map(snapshot.transactions.map((row) => [row.id, row]));

    let changedCount = 0;
    for (const expected of snapshot.transactions) {
      const existing = existingById.get(expected.id);
      if (!existing) continue;
      const changed =
        existing.userId !== userId ||
        !sameDate(existing.updatedAt, expected.updatedAt) ||
        existing.tags !== expected.tags ||
        existing.importSource !== expected.importSource;
      if (changed) changedCount += 1;
    }

    if (changedCount > 0) {
      return { kind: 'conflict', changedCount };
    }

    const deletableIds = snapshot.transactions
      .filter((row) => existingById.has(row.id))
      .map((row) => row.id);
    const skippedCount = snapshot.transactions.length - deletableIds.length;

    if (deletableIds.length === 0) {
      return { kind: 'removed', deletedCount: 0, skippedCount };
    }

    const deleted = await tx.transaction.deleteMany({
      where: { id: { in: deletableIds }, userId },
    });
    return {
      kind: 'removed',
      deletedCount: deleted.count,
      skippedCount: skippedCount + (deletableIds.length - deleted.count),
    };
  });

  if (outcome.kind === 'conflict') {
    return errorResult(
      'undo_batch_conflict',
      'One or more imported transactions changed after the import',
      { changedCount: outcome.changedCount }
    );
  }

  return {
    success: true,
    kind: 'import_batch',
    outcome: outcome.deletedCount > 0 ? 'removed' : 'already_removed',
    deletedCount: outcome.deletedCount,
    skippedCount: outcome.skippedCount,
  };
}

export type ImportBatchUndoReceiptResult =
  | { ok: true; receipt: string; snapshot: ImportBatchUndoSnapshot }
  | { ok: false; code: 'invalid_undo_payload'; message: string };

/**
 * Emite el recibo de un lote importado solo después de comprobar que las
 * filas existen, pertenecen al usuario y conservan sus metadatos de importación.
 */
export async function issueImportBatchUndoReceiptForUser(
  userId: string,
  input: unknown
): Promise<ImportBatchUndoReceiptResult> {
  if (!isNonEmptyString(userId) || !isRecord(input)) {
    return {
      ok: false,
      code: 'invalid_undo_payload',
      message: 'The import batch is invalid',
    };
  }

  const snapshot = parseImportBatchSnapshot(input.snapshot);
  if (
    !snapshot ||
    snapshot.transactions.length === 0 ||
    snapshot.transactions.length > UNDO_MAX_BATCH
  ) {
    return {
      ok: false,
      code: 'invalid_undo_payload',
      message: 'The import batch is invalid',
    };
  }

  const ids = snapshot.transactions.map((row) => row.id);
  if (new Set(ids).size !== ids.length) {
    return {
      ok: false,
      code: 'invalid_undo_payload',
      message: 'The import batch contains duplicate rows',
    };
  }

  const rows = await db.transaction.findMany({
    where: { id: { in: ids }, userId },
    select: { id: true, updatedAt: true, tags: true, importSource: true },
  });
  if (rows.length !== ids.length) {
    return {
      ok: false,
      code: 'invalid_undo_payload',
      message: 'The import batch does not belong to this user',
    };
  }

  const rowsById = new Map(rows.map((row) => [row.id, row]));
  for (const expected of snapshot.transactions) {
    const actual = rowsById.get(expected.id);
    const batchTags = actual?.tags.split(',').map((tag) => tag.trim()) ?? [];
    if (
      !actual ||
      !sameDate(actual.updatedAt, expected.updatedAt) ||
      actual.tags !== expected.tags ||
      actual.importSource !== expected.importSource ||
      !batchTags.includes(snapshot.batchId)
    ) {
      return {
        ok: false,
        code: 'invalid_undo_payload',
        message: 'The import batch changed before its receipt was issued',
      };
    }
  }

  return {
    ok: true,
    receipt: issueUndoReceipt(userId, 'import_batch', snapshot.batchId, snapshot),
    snapshot,
  };
}

/**
 * Restaura una eliminación previamente capturada por la UI.
 *
 * `userId` siempre procede de la sesión: el snapshot nunca decide a qué
 * usuario pertenece la fila restaurada.
 */
export async function undoForUser(userId: string, input: unknown): Promise<UndoServiceResult> {
  if (!isNonEmptyString(userId)) {
    return errorResult('unauthorized', 'A session is required');
  }

  const parsed = parseCommand(input);
  if (!parsed.ok) {
    return errorResult(parsed.error, 'The undo command is invalid');
  }
  const command = parsed.command;
  const targetId =
    command.kind === 'import_batch'
      ? command.snapshot.batchId
      : command.snapshot.id;

  // La prueba de propiedad se valida antes de cualquier lectura o escritura
  // de restauración. Un snapshot fabricado o alterado no puede crear filas.
  const receiptIsValid = verifyUndoReceipt(
    userId,
    command.kind,
    targetId,
    command.snapshot,
    command.receipt
  );
  if (!receiptIsValid) {
    return errorResult(
      'invalid_undo_payload',
      'The undo receipt is invalid or does not match the snapshot'
    );
  }

  try {
    switch (command.kind) {
      case 'transaction':
        return await restoreTransaction(userId, command.snapshot);
      case 'account':
        return await restoreAccount(userId, command.snapshot);
      case 'category':
        return await restoreCategory(userId, command.snapshot);
      case 'budget_item':
        return await restoreBudgetItem(userId, command.snapshot);
      case 'import_batch': {
        if (command.snapshot.transactions.length > UNDO_MAX_BATCH) {
          return errorResult('undo_batch_too_large', 'The imported batch is too large to undo');
        }
        if (command.snapshot.transactions.length === 0) {
          return errorResult('invalid_undo_payload', 'The imported batch is empty');
        }
        return await removeImportBatch(userId, command.snapshot);
      }
    }
  } catch (error) {
    reportError('undo', error);
    return errorResult(
      'undo_failed',
      'The undo operation could not be completed'
    );
  }
}
