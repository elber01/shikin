import { describe, expect, it } from 'vitest';
import {
  computeDelta,
  computeMonthlyFlows,
  computeNetWorth,
  computeNetWorthHistory,
  computeTotalAssets,
  computeTotalLiabilities,
} from '@/lib/finzen/finance';

/**
 * P1 — Dominio financiero (convención 10-U0).
 *
 * `computeMonthlyFlows` es la ÚNICA fuente de verdad de los flujos por mes
 * (gráfico y tarjetas de totales usan el mismo periodo) y el net worth excluye
 * las cuentas virtuales `income`/`expense`.
 */
describe('computeMonthlyFlows', () => {
  const tx = (
    type: string,
    amount: number,
    occurredOn: string,
    currency = 'USD'
  ) => ({ type, amount, currency, occurredOn });

  it('crea un bucket por mes de la ventana, en orden', () => {
    // `endMonth` es 0-11: 10 = noviembre → la ventana de 3 meses es sep-oct-nov.
    const flows = computeMonthlyFlows([], 'USD', 3, 2026, 10);
    expect(flows.map((f) => f.key)).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(flows.every((f) => f.income === 0 && f.expenses === 0)).toBe(true);
  });

  it('agrega ingresos y gastos en su mes', () => {
    const flows = computeMonthlyFlows(
      [
        tx('income', 100, '2026-11-02T10:00:00.000Z'),
        tx('income', 50, '2026-11-20T10:00:00.000Z'),
        tx('expense', 30, '2026-11-05T10:00:00.000Z'),
        tx('expense', 20, '2026-12-01T10:00:00.000Z'),
      ],
      'USD',
      2,
      2026,
      11
    );
    const nov = flows.find((f) => f.key === '2026-11');
    const dec = flows.find((f) => f.key === '2026-12');
    expect(nov?.income).toBe(150);
    expect(nov?.expenses).toBe(30);
    expect(nov?.net).toBe(120);
    expect(dec?.income).toBe(0);
    expect(dec?.expenses).toBe(20);
    expect(dec?.net).toBe(-20);
  });

  it('ignora las transacciones fuera de la ventana', () => {
    const flows = computeMonthlyFlows(
      [tx('expense', 999, '2026-01-01T10:00:00.000Z')],
      'USD',
      2,
      2026,
      11
    );
    expect(flows.reduce((sum, f) => sum + f.expenses, 0)).toBe(0);
  });

  it('ignora las transferencias (no alteran el net worth)', () => {
    const flows = computeMonthlyFlows(
      [tx('transfer', 500, '2026-11-05T10:00:00.000Z')],
      'USD',
      1,
      2026,
      10
    );
    expect(flows[0].income).toBe(0);
    expect(flows[0].expenses).toBe(0);
    expect(flows[0].net).toBe(0);
  });

  it('convierte a la moneda base', () => {
    const flows = computeMonthlyFlows(
      [tx('expense', 60.5, '2026-11-05T10:00:00.000Z', 'DOP')],
      'USD',
      1,
      2026,
      10
    );
    expect(flows[0].expenses).toBeCloseTo(1, 10);
  });
});

describe('computeNetWorth', () => {
  const account = (accountType: string, currentBalance: number, currency = 'USD') => ({
    accountType,
    currentBalance,
    currency,
  });

  it('asset + investment + equity suman', () => {
    expect(
      computeNetWorth(
        [
          account('asset', 1000),
          account('investment', 500),
          account('equity', 250),
        ],
        'USD'
      )
    ).toBe(1750);
  });

  it('liability resta (en valor absoluto)', () => {
    expect(computeNetWorth([account('asset', 1000), account('liability', 300)], 'USD')).toBe(700);
    expect(computeNetWorth([account('liability', -300)], 'USD')).toBe(-300);
  });

  it('las cuentas virtuales income/expense NO cuentan', () => {
    expect(
      computeNetWorth(
        [account('asset', 1000), account('income', 9999), account('expense', 9999)],
        'USD'
      )
    ).toBe(1000);
  });

  it('los totales de activos y pasivos son consistentes', () => {
    const accounts = [account('asset', 1000), account('investment', 200), account('liability', 300)];
    expect(computeTotalAssets(accounts, 'USD')).toBe(1200);
    expect(computeTotalLiabilities(accounts, 'USD')).toBe(300);
  });

  it('convierte a la moneda base', () => {
    expect(computeNetWorth([account('asset', 60.5, 'DOP')], 'USD')).toBeCloseTo(1, 10);
  });
});

describe('computeNetWorthHistory', () => {
  it('reconstruye la historia hacia atrás restando los flujos netos', () => {
    const history = computeNetWorthHistory(1000, [
      { key: '2026-10', year: 2026, month: 9, income: 100, expenses: 50, net: 50 },
      { key: '2026-11', year: 2026, month: 10, income: 200, expenses: 100, net: 100 },
    ]);
    expect(history).toEqual([900, 1000]);
  });
});

describe('computeDelta', () => {
  it('devuelve undefined sin base de comparación (no hay "+0%" inventado)', () => {
    expect(computeDelta(100, 0)).toBeUndefined();
    expect(computeDelta(0, 0)).toBeUndefined();
  });

  it('calcula la variación porcentual', () => {
    expect(computeDelta(150, 100)).toBeCloseTo(50, 10);
    expect(computeDelta(50, 100)).toBeCloseTo(-50, 10);
  });
});
