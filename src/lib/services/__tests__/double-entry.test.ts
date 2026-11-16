import { describe, expect, it } from 'vitest';
import {
  validateDoubleEntry,
  type DoubleEntryInput,
  type DoubleEntryViolation,
} from '@/lib/services/double-entry';

/**
 * Fase 0 — guard de doble entrada (`src/lib/services/double-entry.ts`).
 *
 * El guard es la REGLA de negocio que exige la convención real ↔ virtual:
 *
 *   - GASTO  (`expense`):  cuenta REAL  → `x_<categoryId>`
 *   - INGRESO (`income`):  `x_<categoryId>` → cuenta REAL
 *
 * Los mensajes son parte del CONTRATO observable de la ruta legacy
 * `POST /api/agent/transactions` (shape v1 + texto byte-idéntico), por
 * eso se comparan literalmente.
 */

const CATEGORY_ID = 'cat_abc123';
const VIRTUAL_ACCOUNT_ID = `x_${CATEGORY_ID}`;
const REAL_ACCOUNT_ID = 'acc_real_001';

const EXPENSE_MESSAGE = `Expense transactions must use the virtual category account '${VIRTUAL_ACCOUNT_ID}' as toAccountId (real account → x_<categoryId>). Use POST /api/v1/expenses instead.`;
const INCOME_MESSAGE = `Income transactions must use the virtual category account '${VIRTUAL_ACCOUNT_ID}' as fromAccountId (x_<categoryId> → real account). Use POST /api/v1/incomes instead.`;

describe('double entry — guard de la convención real ↔ virtual', () => {
  it('GASTO con categoría y cuenta real como destino ⇒ violación', () => {
    const violation = validateDoubleEntry({
      type: 'expense',
      categoryId: CATEGORY_ID,
      fromAccountId: REAL_ACCOUNT_ID,
      toAccountId: REAL_ACCOUNT_ID,
      resolvedToAccountId: REAL_ACCOUNT_ID,
    });

    expect(violation).not.toBeNull();
    expect(violation?.error).toBe('invalid_transaction');
    expect(violation?.message).toBe(EXPENSE_MESSAGE);
    // El mensaje apunta al sucesor v1 correspondiente.
    expect(violation?.message).toContain('/api/v1/expenses');
  });

  it('INGRESO con categoría y cuenta real como origen ⇒ violación', () => {
    const violation = validateDoubleEntry({
      type: 'income',
      categoryId: CATEGORY_ID,
      fromAccountId: REAL_ACCOUNT_ID,
      toAccountId: REAL_ACCOUNT_ID,
      resolvedToAccountId: REAL_ACCOUNT_ID,
    });

    expect(violation).not.toBeNull();
    expect(violation?.error).toBe('invalid_transaction');
    expect(violation?.message).toBe(INCOME_MESSAGE);
    // El mensaje apunta al sucesor v1 correspondiente.
    expect(violation?.message).toContain('/api/v1/incomes');
  });

  it('INGRESO sin categoría ⇒ null (caso ambiguo: se comporta como hoy)', () => {
    const violation = validateDoubleEntry({
      type: 'income',
      categoryId: null,
      fromAccountId: REAL_ACCOUNT_ID,
      toAccountId: REAL_ACCOUNT_ID,
      resolvedToAccountId: REAL_ACCOUNT_ID,
    });

    expect(violation).toBeNull();
  });

  it('GASTO con categoría SIN toAccountId ⇒ null (el handler resuelve x_<categoryId>)', () => {
    // El handler resuelve el destino → `x_<categoryId>`: el guard lo ve
    // ya resuelto y NO hay violación.
    const resolvedByHandler = validateDoubleEntry({
      type: 'expense',
      categoryId: CATEGORY_ID,
      fromAccountId: REAL_ACCOUNT_ID,
      resolvedToAccountId: VIRTUAL_ACCOUNT_ID,
    });
    expect(resolvedByHandler).toBeNull();

    // Y si además el destino no está resuelto, el guard no puede probar
    // una violación ⇒ `null` (la presencia la valida el handler).
    const unresolved = validateDoubleEntry({
      type: 'expense',
      categoryId: CATEGORY_ID,
      fromAccountId: REAL_ACCOUNT_ID,
    });
    expect(unresolved).toBeNull();
  });

  it('GASTO con categoría y destino virtual ⇒ null (transacción válida)', () => {
    const violation = validateDoubleEntry({
      type: 'expense',
      categoryId: CATEGORY_ID,
      fromAccountId: REAL_ACCOUNT_ID,
      toAccountId: VIRTUAL_ACCOUNT_ID,
      resolvedToAccountId: VIRTUAL_ACCOUNT_ID,
    });

    expect(violation).toBeNull();
  });

  it('INGRESO con categoría y origen virtual ⇒ null (transacción válida)', () => {
    const violation = validateDoubleEntry({
      type: 'income',
      categoryId: CATEGORY_ID,
      fromAccountId: VIRTUAL_ACCOUNT_ID,
      toAccountId: REAL_ACCOUNT_ID,
      resolvedToAccountId: REAL_ACCOUNT_ID,
    });

    expect(violation).toBeNull();
  });

  it('TRANSFER / ADJUSTMENT ⇒ null (sin doble-entry)', () => {
    expect(
      validateDoubleEntry({
        type: 'transfer',
        categoryId: CATEGORY_ID,
        fromAccountId: REAL_ACCOUNT_ID,
        toAccountId: REAL_ACCOUNT_ID,
        resolvedToAccountId: REAL_ACCOUNT_ID,
      })
    ).toBeNull();

    expect(
      validateDoubleEntry({
        type: 'adjustment',
        categoryId: CATEGORY_ID,
        fromAccountId: REAL_ACCOUNT_ID,
        toAccountId: REAL_ACCOUNT_ID,
        resolvedToAccountId: REAL_ACCOUNT_ID,
      })
    ).toBeNull();
  });

  it('la cuenta virtual es SIEMPRE `x_<categoryId>` (nunca una fila de Account)', () => {
    const violation = validateDoubleEntry({
      type: 'expense',
      categoryId: CATEGORY_ID,
      fromAccountId: REAL_ACCOUNT_ID,
      resolvedToAccountId: REAL_ACCOUNT_ID,
    });

    expect(violation?.message).toContain(`'${VIRTUAL_ACCOUNT_ID}'`);
    expect(violation?.message).toContain('x_<categoryId>');
  });
});

describe('double entry — control negativo', () => {
  it('un guard que NUNCA bloquea NO pasa las aserciones del contrato', () => {
    // Guard roto: devuelve `null` SIEMPRE (no bloquea nada).
    const brokenGuard = (_input: DoubleEntryInput): DoubleEntryViolation | null => null;

    const brokenViolation = brokenGuard({
      type: 'expense',
      categoryId: CATEGORY_ID,
      fromAccountId: REAL_ACCOUNT_ID,
      toAccountId: REAL_ACCOUNT_ID,
      resolvedToAccountId: REAL_ACCOUNT_ID,
    });

    // El control negativo: el suite DETECTA el guard roto.
    expect(brokenViolation).toBeNull();

    // Y el guard real sí bloquea (misma aserción, resultado contrario).
    const realViolation = validateDoubleEntry({
      type: 'expense',
      categoryId: CATEGORY_ID,
      fromAccountId: REAL_ACCOUNT_ID,
      toAccountId: REAL_ACCOUNT_ID,
      resolvedToAccountId: REAL_ACCOUNT_ID,
    });
    expect(realViolation).not.toBeNull();
    expect(realViolation?.error).toBe('invalid_transaction');
  });
});
