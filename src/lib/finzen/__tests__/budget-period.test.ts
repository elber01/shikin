import { describe, expect, it } from 'vitest';
import { budgetPeriodRange } from '@/lib/finzen/budget-period';
import {
  applyTransactionFilters,
  EMPTY_TRANSACTION_FILTERS,
} from '@/lib/finzen/transaction-filters';

/**
 * A3 — Periodo del presupuesto (convención 10-U4).
 *
 * Un presupuesto puede ABARCAR varios meses. El importe gastado (`spent`) y
 * el destino del drill-down deben usar el MISMO rango (AGENTS.md §5): si el
 * número mostrado fuera el de un solo mes, la cifra engañaría al usuario.
 */

const NOW = new Date(2026, 10, 15); // 15-nov-2026 (mes 10 = noviembre)

describe('budgetPeriodRange', () => {
  it('un presupuesto MULTI-MES usa su rango COMPLETO', () => {
    expect(budgetPeriodRange('2026-09-01', '2026-11-30', NOW)).toEqual({
      from: '2026-09-01',
      to: '2026-11-30',
    });
  });

  it('un presupuesto de un solo mes usa su rango completo', () => {
    expect(budgetPeriodRange('2026-11-01', '2026-11-30', NOW)).toEqual({
      from: '2026-11-01',
      to: '2026-11-30',
    });
  });

  it('acepta fechas ISO con hora (toma la parte de calendario)', () => {
    expect(
      budgetPeriodRange('2026-09-01T04:00:00.000Z', '2026-11-30T04:00:00.000Z', NOW)
    ).toEqual({ from: '2026-09-01', to: '2026-11-30' });
  });

  it('sin endDate → fallback seguro: el mes natural de startDate', () => {
    expect(budgetPeriodRange('2026-09-15', null, NOW)).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    });
  });

  it('endDate ANTERIOR a startDate → fallback seguro: el mes de startDate', () => {
    expect(budgetPeriodRange('2026-09-01', '2026-08-31', NOW)).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    });
  });

  it('endDate inválido → fallback seguro: el mes de startDate', () => {
    expect(budgetPeriodRange('2026-09-01', 'basura', NOW)).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    });
    expect(budgetPeriodRange('2026-09-01', '2026-02-30', NOW)).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    });
  });

  it('sin startDate → el mes actual', () => {
    expect(budgetPeriodRange(null, null, NOW)).toEqual({
      from: '2026-11-01',
      to: '2026-11-30',
    });
    expect(budgetPeriodRange(undefined, undefined, NOW)).toEqual({
      from: '2026-11-01',
      to: '2026-11-30',
    });
  });
});

/** Fecha con componentes LOCALES a mediodía → `YYYY-MM-DD` estable. */
function at(year: number, month: number, day: number): string {
  return new Date(year, month, day, 12, 0, 0, 0).toISOString();
}

interface Tx {
  id: string;
  occurredOn: string;
  categoryId: string | null;
  fromAccountId: string;
  toAccountId: string;
  type: string;
  description: string;
}

const TXS: Tx[] = [
  {
    id: 'tx-sep',
    occurredOn: at(2026, 8, 10),
    categoryId: 'cat-food',
    fromAccountId: 'acc-1',
    toAccountId: 'x_cat-food',
    type: 'expense',
    description: 'Septiembre',
  },
  {
    id: 'tx-oct',
    occurredOn: at(2026, 9, 10),
    categoryId: 'cat-food',
    fromAccountId: 'acc-1',
    toAccountId: 'x_cat-food',
    type: 'expense',
    description: 'Octubre',
  },
  {
    id: 'tx-nov',
    occurredOn: at(2026, 10, 10),
    categoryId: 'cat-food',
    fromAccountId: 'acc-1',
    toAccountId: 'x_cat-food',
    type: 'expense',
    description: 'Noviembre',
  },
  {
    id: 'tx-dic',
    occurredOn: at(2026, 11, 10),
    categoryId: 'cat-food',
    fromAccountId: 'acc-1',
    toAccountId: 'x_cat-food',
    type: 'expense',
    description: 'Diciembre (fuera del presupuesto)',
  },
  {
    id: 'tx-otro',
    occurredOn: at(2026, 9, 10),
    categoryId: 'cat-fuel',
    fromAccountId: 'acc-1',
    toAccountId: 'x_cat-fuel',
    type: 'expense',
    description: 'Otra categoría',
  },
  {
    // Movimiento NO de gasto con la MISMA categoría: sin el filtro de tipo en
    // el destino entraría en el conjunto abierto (y el número mostrado —que
    // suma SOLO gastos— no cuadraría con lo que se abre).
    id: 'tx-ajuste',
    occurredOn: at(2026, 9, 15),
    categoryId: 'cat-food',
    fromAccountId: 'acc-1',
    toAccountId: 'x_cat-food',
    type: 'adjustment',
    description: 'Ajuste (no es un gasto)',
  },
];

describe('presupuesto multi-mes — el gasto y el destino comparten el rango', () => {
  const range = budgetPeriodRange('2026-09-01', '2026-11-30', NOW);

  /** Filtro del cálculo de `spent` (mismo que el del destino). */
  const budgetFilters = {
    ...EMPTY_TRANSACTION_FILTERS,
    categoryId: 'cat-food',
    type: 'expense' as const,
    from: range.from,
    to: range.to,
  };

  it('el rango completo abarca los meses intermedios (no solo el inicial)', () => {
    const spent = applyTransactionFilters(TXS, budgetFilters, {
      categoryActive: true,
      accountActive: false,
    });
    // Incluye septiembre, octubre y noviembre; excluye diciembre y otras categorías.
    expect(spent.map((t) => t.id)).toEqual(['tx-nov', 'tx-oct', 'tx-sep']);
  });

  it('el DESTINO del drill-down selecciona EXACTAMENTE los mismos movimientos', () => {
    // El destino es la vista de transacciones con `from`/`to` = rango del
    // presupuesto y `type` = 'expense' (el tipo que usa el cálculo de
    // `spent`): la igualdad de conjuntos es ESTRUCTURAL, no una convención.
    const destination = applyTransactionFilters(
      TXS,
      {
        ...EMPTY_TRANSACTION_FILTERS,
        categoryId: 'cat-food',
        type: 'expense',
        from: range.from,
        to: range.to,
      },
      { categoryActive: true, accountActive: false }
    );
    const spent = applyTransactionFilters(TXS, budgetFilters, {
      categoryActive: true,
      accountActive: false,
    });
    expect(destination.map((t) => t.id)).toEqual(spent.map((t) => t.id));
    expect(range).toEqual({ from: '2026-09-01', to: '2026-11-30' });
  });

  it('el filtro de TIPO del destino es lo que hace que los conjuntos coincidan', () => {
    // Sin `type: 'expense'` el destino abriría también el movimiento que NO
    // es un gasto de la misma categoría → el número mostrado (gastos) y el
    // conjunto abierto (gastos + ajuste) divergirían.
    const withoutType = applyTransactionFilters(
      TXS,
      {
        ...EMPTY_TRANSACTION_FILTERS,
        categoryId: 'cat-food',
        from: range.from,
        to: range.to,
      },
      { categoryActive: true, accountActive: false }
    );
    const spent = applyTransactionFilters(TXS, budgetFilters, {
      categoryActive: true,
      accountActive: false,
    });
    expect(withoutType.map((t) => t.id)).toContain('tx-ajuste');
    expect(spent.map((t) => t.id)).not.toContain('tx-ajuste');
    expect(spent.map((t) => t.id)).toEqual(['tx-nov', 'tx-oct', 'tx-sep']);
  });
});
