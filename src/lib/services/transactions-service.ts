import { db } from '@/lib/db';
import type { CurrencyCode } from '@/lib/finzen/currency';
import type { TransactionUndoSnapshot } from '@/lib/finzen/undo';
import { issueUndoReceipt } from '@/lib/services/undo-receipt';

const TRANSACTION_TYPES = ['income', 'expense', 'transfer', 'adjustment'] as const;
const CURRENCY_CODES = ['USD', 'DOP', 'EUR', 'USDT', 'BTC'] as const;

export type DeleteTransactionErrorCode = 'not_found' | 'invalid_transaction';

export type DeleteTransactionResult =
  | { ok: true; deleted: TransactionUndoSnapshot; undoReceipt: string }
  | { ok: false; code: DeleteTransactionErrorCode; message: string };

function isTransactionType(value: string): value is TransactionUndoSnapshot['type'] {
  return TRANSACTION_TYPES.includes(value as TransactionUndoSnapshot['type']);
}

function isCurrencyCode(value: string): value is CurrencyCode {
  return CURRENCY_CODES.includes(value as CurrencyCode);
}

/**
 * Elimina una transacción del usuario y devuelve el snapshot autoritativo
 * necesario para deshacer el borrado sin perder su ID ni sus campos.
 */
export async function deleteTransactionForUser(
  userId: string,
  id: string
): Promise<DeleteTransactionResult> {
  const existing = await db.transaction.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    return {
      ok: false,
      code: 'not_found',
      message: 'Transaction not found or not owned by your user',
    };
  }

  if (!isTransactionType(existing.type) || !isCurrencyCode(existing.currency)) {
    return {
      ok: false,
      code: 'invalid_transaction',
      message: 'The transaction contains unsupported legacy values',
    };
  }

  const deleted: TransactionUndoSnapshot = {
    id: existing.id,
    type: existing.type,
    amount: existing.amount,
    currency: existing.currency,
    fromAccountId: existing.fromAccountId,
    toAccountId: existing.toAccountId,
    categoryId: existing.categoryId,
    description: existing.description,
    occurredOn: existing.occurredOn.toISOString(),
    tags: existing.tags,
    importSource: existing.importSource,
    createdAt: existing.createdAt.toISOString(),
    updatedAt: existing.updatedAt.toISOString(),
  };

  const undoReceipt = issueUndoReceipt(
    userId,
    'transaction',
    existing.id,
    deleted
  );

  await db.transaction.delete({ where: { id: existing.id } });

  return { ok: true, deleted, undoReceipt };
}
