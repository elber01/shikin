'use client';

import { create } from 'zustand';
import { toast } from 'sonner';
import type { Locale, CurrencyCode } from '@/lib/finzen/currency';
import type { ViewKey } from '@/lib/finzen/views';
import type {
  AccountUndoSnapshot,
  BudgetItemUndoSnapshot,
  CategoryUndoSnapshot,
  TransactionUndoSnapshot,
  UndoCommand,
  UndoDeletion,
  ImportBatchUndoSnapshot,
} from '@/lib/finzen/undo';

// La fuente de verdad del union de vistas es `src/lib/finzen/views.ts`
// (convención 10-U2). Aquí solo se re-exporta para no romper los imports
// existentes (`@/store/finzen-store`).
export type { ViewKey } from '@/lib/finzen/views';

export type TransactionType = 'income' | 'expense' | 'transfer' | 'adjustment';

// Types matching the database schema
// NOTE: `loadData` asigna JSON crudo de la API (unknown), por eso estos
// interfaces son la frontera de tipos del cliente — mantenerlos
// sincronizados con prisma/schema.prisma.
export interface Category {
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

export interface Account {
  id: string;
  name: string;
  accountType: string;
  subType: string | null;
  currency: CurrencyCode;
  currentBalance: number;
  institution: string | null;
  lastFour: string | null;
}

export interface Transaction {
  id: string;
  type: TransactionType;
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
  category?: Category | null;
  fromAccount?: { id: string; name: string } | null;
  toAccount?: { id: string; name: string } | null;
}

export interface BudgetItem {
  id: string;
  categoryId: string;
  plannedAmount: number;
  alertThresholdPct: number;
  category?: Category | null;
}

export interface Budget {
  id: string;
  name: string;
  period: string;
  startDate: string;
  endDate: string;
  items: BudgetItem[];
}

export interface TransactionInput {
  type: TransactionType;
  amount: number;
  currency: CurrencyCode;
  fromAccountId: string;
  toAccountId: string;
  categoryId?: string | null;
  description?: string | null;
  occurredOn: string;
  tags?: string | string[];
  importSource?: string | null;
}

export type TransactionPatch = Partial<Omit<TransactionInput, 'type'>> & {
  type?: TransactionType;
};

type NormalizedTransactionPatch = Omit<TransactionPatch, 'tags'> & { tags?: string };

export interface AccountInput {
  name: string;
  accountType?: string;
  subType?: string | null;
  currency?: CurrencyCode;
  currentBalance?: number;
  institution?: string | null;
  lastFour?: string | null;
}

export type AccountPatch = Partial<AccountInput>;

export interface CategoryInput {
  name?: string | null;
  nameEs?: string | null;
  nameEn?: string | null;
  icon?: string | null;
  color?: string | null;
  direction?: string | null;
}

export type CategoryPatch = CategoryInput;

export interface BudgetItemPatch {
  plannedAmount?: number;
  alertThresholdPct?: number;
}

export interface UserPreferences {
  preferredLang?: Locale;
  baseCurrency?: CurrencyCode;
  theme?: 'light' | 'dark' | 'system';
}

export interface PendingUndo {
  id: string;
  command: UndoCommand;
  toastId: string | number;
  expiresAt: number;
  status: 'ready' | 'restoring';
}

interface FinZenState {
  // User settings
  locale: Locale;
  baseCurrency: CurrencyCode;
  themePref: 'light' | 'dark' | 'system';

  // UI state
  activeView: ViewKey;
  addSheetOpen: boolean;
  sidebarCollapsed: boolean;
  editingTransactionId: string | null;
  loading: boolean;
  /** Command palette (⌘K / Ctrl+K) — UI pura, sin contrato de API. */
  commandPaletteOpen: boolean;
  /** Diálogo de ayuda de atajos — UI pura. */
  shortcutsDialogOpen: boolean;
  /** Único undo pendiente; solo vive en memoria. */
  pendingUndo: PendingUndo | null;

  // Server data
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  budget: Budget | null;

  // Actions
  setLocale: (l: Locale) => void;
  setBaseCurrency: (c: CurrencyCode) => void;
  setThemePref: (t: 'light' | 'dark' | 'system') => void;
  setActiveView: (v: ViewKey) => void;
  setAddSheetOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setEditingTransactionId: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setShortcutsDialogOpen: (open: boolean) => void;
  setPendingUndo: (pendingUndo: PendingUndo | null) => void;

  // Data actions (server-synced)
  loadData: () => Promise<boolean>;
  addTransaction: (tx: TransactionInput) => Promise<Transaction>;
  updateTransaction: (id: string, patch: TransactionPatch) => Promise<void>;
  deleteTransaction: (id: string) => Promise<UndoDeletion<TransactionUndoSnapshot>>;
  addAccount: (account: AccountInput) => Promise<Account>;
  updateAccount: (id: string, patch: AccountPatch) => Promise<void>;
  deleteAccount: (id: string) => Promise<UndoDeletion<AccountUndoSnapshot>>;
  addBudgetItem: (item: {
    categoryId: string;
    plannedAmount: number;
    alertThresholdPct?: number;
  }) => Promise<void>;
  updateBudgetItem: (
    budgetId: string,
    itemId: string,
    patch: BudgetItemPatch
  ) => Promise<void>;
  deleteBudgetItem: (id: string) => Promise<UndoDeletion<BudgetItemUndoSnapshot>>;
  addCategory: (cat: CategoryInput) => Promise<Category>;
  updateCategory: (id: string, patch: CategoryPatch) => Promise<void>;
  deleteCategory: (id: string) => Promise<UndoDeletion<CategoryUndoSnapshot>>;
  issueImportBatchUndoReceipt: (
    snapshot: ImportBatchUndoSnapshot
  ) => Promise<string>;
  updatePreferences: (prefs: UserPreferences) => Promise<void>;
  resetStore: () => void;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Body de error que devuelve la API interna. */
interface ApiErrorBody {
  error?: string;
  message?: string;
  code?: string;
  transactionCount?: number;
}

/**
 * Error de API con el código snake_case del servidor y sus datos extra
 * (p. ej. el 409 `account_has_transactions` con el número de transacciones).
 * La UI decide qué mensaje mostrar según `code`, no según el texto del
 * servidor (que siempre viene en inglés).
 */
export class ApiError extends Error {
  readonly code?: string;
  readonly transactionCount?: number;

  constructor(message: string, code?: string, transactionCount?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.transactionCount = transactionCount;
  }
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const raw: unknown = await res.json().catch(() => ({}));
    const body: ApiErrorBody = isRecord(raw)
      ? {
          error: typeof raw.error === 'string' ? raw.error : undefined,
          message: typeof raw.message === 'string' ? raw.message : undefined,
          code: typeof raw.code === 'string' ? raw.code : undefined,
          transactionCount:
            typeof raw.transactionCount === 'number' ? raw.transactionCount : undefined,
        }
      : {};
    const inferredCode =
      body.error && /^[a-z0-9_]+$/.test(body.error) ? body.error : undefined;
    throw new ApiError(
      body.message || body.error || 'Request failed',
      body.code || inferredCode,
      body.transactionCount
    );
  }
  return (await res.json()) as T;
}

function isLocale(value: unknown): value is Locale {
  return value === 'es' || value === 'en';
}

function isCurrencyCode(value: unknown): value is CurrencyCode {
  return (
    value === 'USD' ||
    value === 'DOP' ||
    value === 'EUR' ||
    value === 'USDT' ||
    value === 'BTC'
  );
}

function isTheme(value: unknown): value is 'light' | 'dark' | 'system' {
  return value === 'light' || value === 'dark' || value === 'system';
}

function normalizeTags(tags: string | string[] | undefined): string {
  if (Array.isArray(tags)) return tags.join(',');
  return tags ?? '';
}

interface MeResponse {
  preferredLang?: string;
  baseCurrency?: string;
  theme?: string;
}

interface DeleteEnvelope<T> {
  success: true;
  deleted: T;
  undoReceipt: string;
}

interface ImportBatchReceiptEnvelope {
  success: true;
  undoReceipt: string;
}

export const useFinZenStore = create<FinZenState>((set, get) => ({
  // Settings
  locale: 'es',
  baseCurrency: 'USD',
  themePref: 'system',

  // UI
  activeView: 'dashboard',
  addSheetOpen: false,
  sidebarCollapsed: false,
  editingTransactionId: null,
  // [UX] Empieza en true: cubre desde el primer render hasta que loadData
  // resuelve — evita el flash de "¡Bienvenido! $0.00" con datos existentes.
  loading: true,
  commandPaletteOpen: false,
  shortcutsDialogOpen: false,
  pendingUndo: null,

  // Data
  transactions: [],
  accounts: [],
  categories: [],
  budget: null,

  // UI Actions
  setLocale: (l) => set({ locale: l }),
  setBaseCurrency: (c) => set({ baseCurrency: c }),
  setThemePref: (t) => set({ themePref: t }),
  setActiveView: (v) => set({ activeView: v }),
  setAddSheetOpen: (open) => set({ addSheetOpen: open }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setEditingTransactionId: (id) => set({ editingTransactionId: id }),
  setLoading: (loading) => set({ loading }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setShortcutsDialogOpen: (open) => set({ shortcutsDialogOpen: open }),
  setPendingUndo: (pendingUndo) => set({ pendingUndo }),

  // Load all data from API
  loadData: async () => {
    set({ loading: true });
    try {
      const [accounts, transactions, categories, budgets, me] = await Promise.all([
        apiFetch<Account[]>('/api/accounts'),
        apiFetch<Transaction[]>('/api/transactions'),
        apiFetch<Category[]>('/api/categories'),
        apiFetch<Budget[]>('/api/budgets'),
        apiFetch<MeResponse>('/api/me'),
      ]);

      set({
        accounts,
        transactions,
        categories,
        budget: budgets[0] || null,
        locale: isLocale(me.preferredLang) ? me.preferredLang : 'es',
        baseCurrency: isCurrencyCode(me.baseCurrency) ? me.baseCurrency : 'USD',
        themePref: isTheme(me.theme) ? me.theme : 'system',
        loading: false,
      });
      return true;
    } catch (err) {
      console.error(
        'Failed to load data:',
        err instanceof Error ? err.name : 'UnknownError'
      );
      set({ loading: false });
      return false;
    }
  },

  // Transaction CRUD
  addTransaction: async (tx) => {
    // Optimistic: add to local state immediately.
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const optimistic: Transaction = {
      id: tempId,
      type: tx.type,
      amount: tx.amount,
      currency: tx.currency,
      fromAccountId: tx.fromAccountId,
      toAccountId: tx.toAccountId,
      categoryId: tx.categoryId ?? null,
      description: tx.description ?? null,
      occurredOn: tx.occurredOn,
      tags: normalizeTags(tx.tags),
      importSource: tx.importSource ?? 'manual',
      createdAt: now,
      updatedAt: now,
    };
    set((s) => ({ transactions: [optimistic, ...s.transactions] }));
    try {
      const created = await apiFetch<Transaction>('/api/transactions', {
        method: 'POST',
        body: JSON.stringify(tx),
      });
      // Replace temp with the authoritative server row.
      set((s) => ({
        transactions: s.transactions.map((t) => (t.id === tempId ? created : t)),
      }));
      return created;
    } catch (err) {
      // Rollback
      set((s) => ({ transactions: s.transactions.filter((t) => t.id !== tempId) }));
      throw err;
    }
  },

  updateTransaction: async (id, patch) => {
    const { tags, ...patchWithoutTags } = patch;
    const normalizedPatch: NormalizedTransactionPatch = {
      ...patchWithoutTags,
      ...(tags !== undefined ? { tags: normalizeTags(tags) } : {}),
    };
    // Optimistic: update local state immediately
    const prev = get().transactions.find((t) => t.id === id);
    if (prev) {
      set((s) => ({
        transactions: s.transactions.map((t) =>
          t.id === id ? { ...t, ...normalizedPatch } : t
        ),
      }));
    }
    try {
      const updated = await apiFetch<Transaction>(`/api/transactions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(normalizedPatch),
      });
      set((s) => ({
        transactions: s.transactions.map((t) => (t.id === id ? { ...t, ...updated } : t)),
      }));
    } catch (err) {
      // Rollback
      if (prev) {
        set((s) => ({ transactions: s.transactions.map((t) => (t.id === id ? prev : t)) }));
      }
      throw err;
    }
  },

  deleteTransaction: async (id) => {
    // Optimistic: remove from local state immediately
    const prev = get().transactions.find((t) => t.id === id);
    set((s) => ({
      transactions: s.transactions.filter((t) => t.id !== id),
      editingTransactionId: s.editingTransactionId === id ? null : s.editingTransactionId,
    }));
    try {
      const result = await apiFetch<DeleteEnvelope<TransactionUndoSnapshot>>(
        `/api/transactions/${id}`,
        { method: 'DELETE' }
      );
      return {
        snapshot: result.deleted,
        undoReceipt: result.undoReceipt,
      };
    } catch (err) {
      // Rollback: re-add the transaction
      if (prev) {
        set((s) => ({ transactions: [prev, ...s.transactions] }));
      }
      throw err;
    }
  },

  // Account CRUD
  addAccount: async (account) => {
    const created = await apiFetch<Account>('/api/accounts', {
      method: 'POST',
      body: JSON.stringify(account),
    });
    set((s) => ({ accounts: [...s.accounts, created] }));
    return created;
  },

  updateAccount: async (id, patch) => {
    const updated = await apiFetch<Account>(`/api/accounts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    set((s) => ({
      accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...updated } : a)),
    }));
  },

  deleteAccount: async (id) => {
    const result = await apiFetch<DeleteEnvelope<AccountUndoSnapshot>>(
      `/api/accounts/${id}`,
      { method: 'DELETE' }
    );
    set((s) => ({
      accounts: s.accounts.filter((a) => a.id !== id),
      transactions: s.transactions.filter(
        (t) => t.fromAccountId !== id && t.toAccountId !== id
      ),
    }));
    return {
      snapshot: result.deleted,
      undoReceipt: result.undoReceipt,
    };
  },

  // Budget CRUD (simplified — creates a budget with items if none exists)
  addBudgetItem: async (item) => {
    const state = get();
    if (!state.budget) {
      // Create a new budget first
      const now = new Date();
      const budget = await apiFetch<Budget>('/api/budgets', {
        method: 'POST',
        body: JSON.stringify({
          name: now.toLocaleString('en', { month: 'long', year: 'numeric' }),
          period: 'monthly',
          startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
          endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString(),
          items: [item],
        }),
      });
      set({ budget });
    } else {
      // Add a line to the EXISTING budget: it has to hit the server, otherwise
      // the line only lived in memory and vanished on the next reload.
      const created = await apiFetch<BudgetItem>(
        `/api/budgets/${state.budget.id}/items`,
        {
          method: 'POST',
          body: JSON.stringify({
            categoryId: item.categoryId,
            plannedAmount: Number(item.plannedAmount),
            alertThresholdPct: item.alertThresholdPct,
          }),
        }
      );
      set((s) => ({
        budget: s.budget
          ? {
              ...s.budget,
              items: [...s.budget.items, created],
            }
          : null,
      }));
    }
  },

  deleteBudgetItem: async (id) => {
    const state = get();
    if (!state.budget) {
      throw new ApiError('Budget not found', 'not_found');
    }
    const result = await apiFetch<DeleteEnvelope<BudgetItemUndoSnapshot>>(
      `/api/budgets/${state.budget.id}/items/${id}`,
      { method: 'DELETE' }
    );
    set((s) => ({
      budget: s.budget
        ? {
            ...s.budget,
            items: s.budget.items.filter((i) => i.id !== id),
          }
        : null,
    }));
    return {
      snapshot: result.deleted,
      undoReceipt: result.undoReceipt,
    };
  },

  updateBudgetItem: async (budgetId, itemId, patch) => {
    await apiFetch<BudgetItem>(`/api/budgets/${budgetId}/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    set((s) => ({
      budget: s.budget
        ? {
            ...s.budget,
            items: s.budget.items.map((i) =>
              i.id === itemId ? { ...i, ...patch } : i
            ),
          }
        : null,
    }));
  },

  // Category CRUD
  addCategory: async (cat) => {
    const created = await apiFetch<Category>('/api/categories', {
      method: 'POST',
      body: JSON.stringify(cat),
    });
    set((s) => ({ categories: [...s.categories, created] }));
    return created;
  },

  updateCategory: async (id, patch) => {
    const updated = await apiFetch<Category>(`/api/categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    set((s) => ({
      categories: s.categories.map((c) => (c.id === id ? { ...c, ...updated } : c)),
    }));
  },

  deleteCategory: async (id) => {
    const result = await apiFetch<DeleteEnvelope<CategoryUndoSnapshot>>(
      `/api/categories/${id}`,
      { method: 'DELETE' }
    );
    set((s) => ({
      categories: s.categories.filter((c) => c.id !== id),
    }));
    return {
      snapshot: result.deleted,
      undoReceipt: result.undoReceipt,
    };
  },

  issueImportBatchUndoReceipt: async (snapshot) => {
    const result = await apiFetch<ImportBatchReceiptEnvelope>(
      '/api/undo/import-batch-receipt',
      {
        method: 'POST',
        body: JSON.stringify({ snapshot }),
      }
    );
    return result.undoReceipt;
  },

  // Update user preferences
  updatePreferences: async (prefs) => {
    await apiFetch<MeResponse>('/api/me', {
      method: 'PATCH',
      body: JSON.stringify(prefs),
    });
    if (prefs.preferredLang) set({ locale: prefs.preferredLang });
    if (prefs.baseCurrency) set({ baseCurrency: prefs.baseCurrency });
    if (prefs.theme) set({ themePref: prefs.theme });
  },

  // Reset store on logout — clears all user data from memory
  resetStore: () => {
    const pending = get().pendingUndo;
    if (pending) toast.dismiss(pending.toastId);

    set({
      transactions: [],
      accounts: [],
      categories: [],
      budget: null,
      activeView: 'dashboard',
      addSheetOpen: false,
      editingTransactionId: null,
      loading: false,
      commandPaletteOpen: false,
      shortcutsDialogOpen: false,
      pendingUndo: null,
      // Keep locale, baseCurrency, themePref — they'll be reloaded on next login
    });
  },
}));
