/**
 * Fake de base de datos EN MEMORIA para los tests del `undo-service` (10-U4).
 *
 * Reglas duras (AGENTS.md §5 — "Tests automatizados"):
 * - El test NUNCA importa `src/lib/db.ts` real (crearía un `PrismaClient` al
 *   importarse y tocaría `db/custom.db` o Turso). Este fake lo sustituye con
 *   `vi.mock('@/lib/db')`.
 * - Registra TODAS las escrituras (`create` / `deleteMany`) para poder
 *   afirmar "0 escrituras" en los caminos de error del undo.
 *
 * No es un simulacro de Prisma: implementa solo el subconjunto de operaciones
 * que usa `undo-service.ts`, con la misma forma de argumentos.
 */

export interface FakeTransactionRow {
  id: string;
  userId: string;
  type: string;
  amount: number;
  currency: string;
  fromAccountId: string;
  toAccountId: string;
  categoryId: string | null;
  description: string | null;
  occurredOn: Date;
  tags: string;
  importSource: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FakeAccountRow {
  id: string;
  userId: string;
  name: string;
  accountType: string;
  subType: string | null;
  currency: string;
  currentBalance: number;
  institution: string | null;
  lastFour: string | null;
}

export interface FakeCategoryRow {
  id: string;
  userId: string | null;
  name: string;
  nameEs: string | null;
  nameEn: string | null;
  icon: string | null;
  color: string | null;
  direction: string;
  isSystem: boolean;
  sortOrder: number;
}

export interface FakeBudgetRow {
  id: string;
  userId: string;
  period: string;
}

export interface FakeBudgetItemRow {
  id: string;
  budgetId: string;
  categoryId: string;
  plannedAmount: number;
  alertThresholdPct: number;
}

/** Una escritura registrada por el fake. */
export interface FakeWrite {
  op: 'create' | 'deleteMany';
  model: 'transaction' | 'account' | 'category' | 'budgetItem';
  payload: unknown;
}

interface IdFilter {
  id?: { in: string[] };
  userId?: string;
}

interface FindManyArgs {
  where?: IdFilter;
}

export class FakeDb {
  readonly writes: FakeWrite[] = [];
  readonly transactions = new Map<string, FakeTransactionRow>();
  readonly accounts = new Map<string, FakeAccountRow>();
  readonly categories = new Map<string, FakeCategoryRow>();
  readonly budgets = new Map<string, FakeBudgetRow>();
  readonly budgetItems = new Map<string, FakeBudgetItemRow>();

  /** Vacía el fake (entre tests) y devuelve el nº de escrituras registradas. */
  reset(): void {
    this.writes.length = 0;
    this.transactions.clear();
    this.accounts.clear();
    this.categories.clear();
    this.budgets.clear();
    this.budgetItems.clear();
  }

  /** Nº de escrituras registradas (crear filas o borrar lotes). */
  get writeCount(): number {
    return this.writes.length;
  }

  private matches(row: { id: string; userId?: string }, where?: IdFilter): boolean {
    if (!where) return true;
    if (where.id?.in && !where.id.in.includes(row.id)) return false;
    if (where.userId !== undefined && 'userId' in row && row.userId !== where.userId) {
      return false;
    }
    return true;
  }

  readonly transaction = {
    findUnique: async ({ where }: { where: { id: string } }) =>
      this.transactions.get(where.id) ?? null,
    findMany: async ({ where }: FindManyArgs) =>
      Array.from(this.transactions.values()).filter((row) =>
        this.matches(row as { id: string; userId?: string }, where)
      ),
    create: async ({ data }: { data: FakeTransactionRow }) => {
      this.writes.push({ op: 'create', model: 'transaction', payload: data });
      this.transactions.set(data.id, data);
      return data;
    },
    deleteMany: async ({ where }: { where: { id: { in: string[] }; userId: string } }) => {
      this.writes.push({ op: 'deleteMany', model: 'transaction', payload: where });
      let count = 0;
      for (const id of where.id.in) {
        const row = this.transactions.get(id);
        if (row && row.userId === where.userId) {
          this.transactions.delete(id);
          count += 1;
        }
      }
      return { count };
    },
  };

  readonly account = {
    findUnique: async ({ where }: { where: { id: string } }) =>
      this.accounts.get(where.id) ?? null,
    findMany: async ({ where }: FindManyArgs) =>
      Array.from(this.accounts.values()).filter((row) =>
        this.matches(row as { id: string; userId?: string }, where)
      ),
    create: async ({ data }: { data: FakeAccountRow }) => {
      this.writes.push({ op: 'create', model: 'account', payload: data });
      this.accounts.set(data.id, data);
      return data;
    },
  };

  readonly category = {
    findUnique: async ({ where }: { where: { id: string } }) =>
      this.categories.get(where.id) ?? null,
    findMany: async ({ where }: FindManyArgs) =>
      Array.from(this.categories.values()).filter((row) =>
        this.matches(row as { id: string; userId?: string }, where)
      ),
    create: async ({ data }: { data: FakeCategoryRow }) => {
      this.writes.push({ op: 'create', model: 'category', payload: data });
      this.categories.set(data.id, data);
      return data;
    },
  };

  readonly budget = {
    findFirst: async ({ where }: { where: { id: string; userId: string } }) => {
      const row = this.budgets.get(where.id);
      if (!row || row.userId !== where.userId) return null;
      return { id: row.id };
    },
    findUnique: async ({ where }: { where: { id: string } }) =>
      this.budgets.get(where.id) ?? null,
  };

  readonly budgetItem = {
    findUnique: async ({ where }: { where: { id: string } }) =>
      this.budgetItems.get(where.id) ?? null,
    create: async ({ data }: { data: FakeBudgetItemRow }) => {
      this.writes.push({ op: 'create', model: 'budgetItem', payload: data });
      this.budgetItems.set(data.id, data);
      return data;
    },
  };

  /**
   * El servicio usa `$transaction` con un callback. El fake no simula rollback
   * (el servicio ya evita las escrituras parciales por diseño), pero registra
   * las escrituras para poder afirmar "0 borrados" en los conflictos.
   */
  async $transaction<T>(fn: (tx: FakeDb) => Promise<T>): Promise<T> {
    return fn(this);
  }
}

/** Instancia única compartida entre el mock y el test. */
export const fakeDb = new FakeDb();
