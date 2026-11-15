'use client';

import { toast } from 'sonner';
import { translations, type TranslationKey } from '@/lib/finzen/i18n';
import { reportError } from '@/lib/finzen/error-report';
import {
  UNDO_WINDOW_MS,
  type UndoCommand,
  type UndoErrorCode,
} from '@/lib/finzen/undo';
import { useFinZenStore, type PendingUndo } from '@/store/finzen-store';

const UNDO_ERROR_MESSAGES: Record<UndoErrorCode, TranslationKey> = {
  unauthorized: 'undo.error.unauthorized',
  invalid_undo_payload: 'undo.error.invalid_undo_payload',
  not_found: 'undo.error.not_found',
  invalid_transaction: 'undo.error.invalid_transaction',
  invalid_account: 'undo.error.invalid_account',
  invalid_category: 'undo.error.invalid_category',
  invalid_budget_item: 'undo.error.invalid_budget_item',
  undo_batch_too_large: 'undo.error.undo_batch_too_large',
  undo_conflict: 'undo.error.undo_conflict',
  undo_dependency_missing: 'undo.error.undo_dependency_missing',
  undo_batch_conflict: 'undo.error.undo_batch_conflict',
  undo_failed: 'undo.error.undo_failed',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUndoErrorCode(value: unknown): value is UndoErrorCode {
  return typeof value === 'string' && value in UNDO_ERROR_MESSAGES;
}

function createUndoId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `undo_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Ofrece el único undo pendiente de la aplicación.
 *
 * El snapshot vive únicamente en el store Zustand (memoria). Una eliminación
 * nueva reemplaza el anterior; recargar o cerrar sesión lo descarta.
 */
export function useUndo(): {
  offerUndo: (command: UndoCommand, successMessage: string) => void;
  undoPending: () => Promise<void>;
  clearPendingUndo: () => void;
} {
  const locale = useFinZenStore((state) => state.locale);
  const t = translations[locale];

  function clearPendingUndo(): void {
    const pending = useFinZenStore.getState().pendingUndo;
    if (pending) toast.dismiss(pending.toastId);
    useFinZenStore.getState().setPendingUndo(null);
  }

  function isCurrentPending(id: string): boolean {
    const pending = useFinZenStore.getState().pendingUndo;
    return pending?.id === id && pending.status === 'ready';
  }

  function scheduleExpiry(id: string, expiresAt: number): void {
    setTimeout(() => {
      const current = useFinZenStore.getState().pendingUndo;
      if (
        current?.id === id &&
        current.status === 'ready' &&
        current.expiresAt <= Date.now()
      ) {
        toast.dismiss(current.toastId);
        useFinZenStore.getState().setPendingUndo(null);
      }
    }, Math.max(0, expiresAt - Date.now()));
  }

  function offerUndo(command: UndoCommand, successMessage: string): void {
    const store = useFinZenStore.getState();
    const previous = store.pendingUndo;
    if (previous) toast.dismiss(previous.toastId);

    const id = createUndoId();
    const toastId = toast.success(successMessage, {
      description: t['undo.windowHint'],
      action: {
        label: t['undo.action'],
        onClick: () => {
          if (isCurrentPending(id)) void undoPending();
        },
      },
      duration: UNDO_WINDOW_MS,
    });

    const expiresAt = Date.now() + UNDO_WINDOW_MS;
    store.setPendingUndo({
      id,
      command,
      toastId,
      expiresAt,
      status: 'ready',
    });
    scheduleExpiry(id, expiresAt);
  }

  async function undoPending(): Promise<void> {
    const store = useFinZenStore.getState();
    const pending = store.pendingUndo;
    if (!pending || pending.status === 'restoring') return;

    if (pending.expiresAt <= Date.now()) {
      toast.dismiss(pending.toastId);
      store.setPendingUndo(null);
      toast.error(t['undo.expired']);
      return;
    }

    // Mark before the request: a rapid double click must not send two restores.
    store.setPendingUndo({ ...pending, status: 'restoring' });

    try {
      const response = await fetch('/api/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pending.command),
      });

      if (!response.ok) {
        const raw: unknown = await response.json().catch(() => ({}));
        const code = isRecord(raw) && isUndoErrorCode(raw.error) ? raw.error : 'undo_failed';
        throw new Error(code);
      }

      const synced = await store.loadData();
      const current = useFinZenStore.getState().pendingUndo;
      if (current?.id !== pending.id) return;

      if (synced) {
        store.setPendingUndo(null);
        toast.dismiss(pending.toastId);
        toast.success(t['undo.restored']);
        return;
      }

      // The server restored the row, but the client could not refresh it.
      // Keep the command armed: the next attempt is idempotent.
      const rearmed = rearmPending(pending.id);
      if (!rearmed) return;
      showRetryError(t['undo.syncFailed'], rearmed.id);
      return;
    } catch (error) {
      reportError('undo', error);
      const code =
        error instanceof Error && isUndoErrorCode(error.message)
          ? error.message
          : 'undo_failed';
      const rearmed = rearmPending(pending.id);
      if (!rearmed) return;
      showRetryError(t[UNDO_ERROR_MESSAGES[code]], rearmed.id);
    }
  }

  function rearmPending(id: string): PendingUndo | null {
    const current = useFinZenStore.getState().pendingUndo;
    if (!current || current.id !== id) return null;
    const rearmed: PendingUndo = {
      ...current,
      status: 'ready',
      expiresAt: Date.now() + UNDO_WINDOW_MS,
    };
    useFinZenStore.getState().setPendingUndo(rearmed);
    scheduleExpiry(rearmed.id, rearmed.expiresAt);
    return rearmed;
  }

  function showRetryError(message: string, pendingId: string): void {
    const current = useFinZenStore.getState().pendingUndo;
    if (!current || current.id !== pendingId) return;
    toast.dismiss(current.toastId);
    const toastId = toast.error(message, {
      action: {
        label: t['undo.action'],
        onClick: () => {
          if (isCurrentPending(pendingId)) void undoPending();
        },
      },
      duration: UNDO_WINDOW_MS,
    });
    useFinZenStore.getState().setPendingUndo({ ...current, toastId });
  }

  return { offerUndo, undoPending, clearPendingUndo };
}
