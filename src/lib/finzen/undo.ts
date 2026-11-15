import type { CurrencyCode } from './currency';

/** Tipos de eliminación que pueden deshacerse desde la UI. */
export type UndoKind = 'transaction' | 'account' | 'category' | 'budget_item' | 'import_batch';

/** Ventana de deshacer visible para el usuario. */
export const UNDO_WINDOW_MS = 10_000;

/** Cota máxima de filas que puede revertir una importación masiva. */
export const UNDO_MAX_BATCH = 500;

export interface TransactionUndoSnapshot {
  id: string;
  type: 'income' | 'expense' | 'transfer' | 'adjustment';
  amount: number;
  currency: CurrencyCode;
  fromAccountId: string;
  toAccountId: string;
  categoryId: string | null;
  description: string | null;
  occurredOn: string;
  tags: string;
  importSource: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccountUndoSnapshot {
  id: string;
  name: string;
  accountType: string;
  subType: string | null;
  currency: CurrencyCode;
  currentBalance: number;
  institution: string | null;
  lastFour: string | null;
}

export interface CategoryUndoSnapshot {
  id: string;
  name: string;
  nameEs: string | null;
  nameEn: string | null;
  icon: string | null;
  color: string | null;
  direction: string;
  isSystem: boolean;
  sortOrder: number;
}

export interface BudgetItemUndoSnapshot {
  id: string;
  budgetId: string;
  categoryId: string;
  plannedAmount: number;
  alertThresholdPct: number;
}

export interface ImportBatchUndoSnapshot {
  batchId: string;
  transactions: Array<{
    id: string;
    updatedAt: string;
    tags: string;
    importSource: 'csv' | 'bank';
  }>;
}

export type UndoCommand =
  | { kind: 'transaction'; snapshot: TransactionUndoSnapshot; receipt: string }
  | { kind: 'account'; snapshot: AccountUndoSnapshot; receipt: string }
  | { kind: 'category'; snapshot: CategoryUndoSnapshot; receipt: string }
  | { kind: 'budget_item'; snapshot: BudgetItemUndoSnapshot; receipt: string }
  | { kind: 'import_batch'; snapshot: ImportBatchUndoSnapshot; receipt: string };

export interface UndoDeletion<TSnapshot> {
  snapshot: TSnapshot;
  undoReceipt: string;
}

export type UndoErrorCode =
  | 'unauthorized'
  | 'invalid_undo_payload'
  | 'not_found'
  | 'invalid_transaction'
  | 'invalid_account'
  | 'invalid_category'
  | 'invalid_budget_item'
  | 'undo_batch_too_large'
  | 'undo_conflict'
  | 'undo_dependency_missing'
  | 'undo_batch_conflict'
  | 'undo_failed';

export interface UndoEntitySuccessResult {
  success: true;
  kind: 'transaction' | 'account' | 'category' | 'budget_item';
  outcome: 'restored' | 'already_restored';
  restoredId: string;
}

export interface UndoImportBatchSuccessResult {
  success: true;
  kind: 'import_batch';
  outcome: 'removed' | 'already_removed';
  deletedCount: number;
  skippedCount: number;
}

export interface UndoErrorResult {
  success: false;
  error: UndoErrorCode;
  message?: string;
  changedCount?: number;
  dependency?: string;
}

export type UndoServiceResult =
  | UndoEntitySuccessResult
  | UndoImportBatchSuccessResult
  | UndoErrorResult;
