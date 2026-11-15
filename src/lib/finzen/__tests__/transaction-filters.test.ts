import { describe, expect, it } from 'vitest';
import {
  EMPTY_TRANSACTION_FILTERS,
  applyTransactionFilters,
  buildTransactionQuery,
  hasActiveFilters,
  isIsoDate,
  monthKeyRange,
  parseTransactionFilters,
  presetToRange,
  resolveDatePreset,
  resolveFilterActivation,
  resolveSelectFilterValue,
  serializeTransactionFilters,
  type TransactionFilters,
} from '@/lib/finzen/transaction-filters';
import { buildViewHref, replaceViewParamInSearch } from '@/lib/finzen/view-href';

/**
 * P1 — Núcleo puro del drill-down (convención 10-U4).
 *
 * La URL es la fuente de verdad de los filtros: el parseo es TOTAL (nunca
 * lanza) y la serialización es CANÓNICA (mismo filtro → misma URL).
 */

/**NOW fijo para las pruebas de presets (evita depender del reloj). */
const NOW = new Date(2026, 10, 15); // 15-nov-2026 (mes 10 = noviembre)

function parse(query: string): TransactionFilters {
  return parseTransactionFilters(new URLSearchParams(query));
}

describe('parseTransactionFilters', () => {
  it('devuelve filtros vacíos si no hay params', () => {
    expect(parse('')).toEqual(EMPTY_TRANSACTION_FILTERS);
  });

  it('parsea todos los filtros válidos', () => {
    expect(parse('category=abc&account=acc_1&type=expense&from=2026-11-01&to=2026-11-30&q=cena')).toEqual({
      categoryId: 'abc',
      accountId: 'acc_1',
      type: 'expense',
      from: '2026-11-01',
      to: '2026-11-30',
      query: 'cena',
    });
  });

  it('descarta un type fuera del enum', () => {
    expect(parse('type=banana').type).toBeNull();
    expect(parse('type=').type).toBeNull();
    expect(parse('type=income').type).toBe('income');
  });

  it('descarta fechas que NO existen', () => {
    expect(parse('from=2026-13-45').from).toBeNull();
    expect(parse('to=2026-02-30').to).toBeNull();
    expect(parse('from=2026-1-1').from).toBeNull();
    expect(parse('from=ayer').from).toBeNull();
    expect(parse('from=2026-11-01').from).toBe('2026-11-01');
  });

  it('descarta ids malformados', () => {
    expect(parse('category=').categoryId).toBeNull();
    expect(parse('category=abc%20def').categoryId).toBeNull();
    expect(parse('category=abc/def').categoryId).toBeNull();
    expect(parse(`category=${'a'.repeat(65)}`).categoryId).toBeNull();
    expect(parse(`category=${'a'.repeat(64)}`).categoryId).toBe('a'.repeat(64));
  });

  it('intercambia from > to (normalización del rango)', () => {
    const filters = parse('from=2026-11-30&to=2026-11-01');
    expect(filters.from).toBe('2026-11-01');
    expect(filters.to).toBe('2026-11-30');
  });

  it('el query se recorta y se normaliza con trim', () => {
    expect(parse('q=%20%20cena%20%20').query).toBe('cena');
    expect(parse('q=').query).toBe('');
    const long = 'x'.repeat(250);
    expect(parse(`q=${long}`).query).toHaveLength(200);
  });

  it('nunca lanza con params basura', () => {
    expect(() => parse('?&&=&category=%%%&from=NaN')).not.toThrow();
  });
});

describe('serializeTransactionFilters / buildTransactionQuery', () => {
  it('round-trip parse ↔ serialize', () => {
    const original = parse('category=abc&account=acc_1&type=transfer&from=2026-11-01&to=2026-11-30&q=cena');
    const serialized = serializeTransactionFilters(original);
    const roundTrip = parseTransactionFilters(new URLSearchParams(serialized));
    expect(roundTrip).toEqual(original);
  });

  it('el orden canónico es category, account, type, from, to, q', () => {
    const filters: TransactionFilters = {
      categoryId: 'c',
      accountId: 'a',
      type: 'expense',
      from: '2026-01-01',
      to: '2026-01-31',
      query: 'texto',
    };
    expect(Object.keys(serializeTransactionFilters(filters))).toEqual([
      'category',
      'account',
      'type',
      'from',
      'to',
      'q',
    ]);
    expect(buildTransactionQuery(filters)).toBe(
      'category=c&account=a&type=expense&from=2026-01-01&to=2026-01-31&q=texto'
    );
  });

  it('sin filtros la query está vacía', () => {
    expect(buildTransactionQuery(EMPTY_TRANSACTION_FILTERS)).toBe('');
    expect(hasActiveFilters(EMPTY_TRANSACTION_FILTERS)).toBe(false);
  });

  it('hasActiveFilters detecta cada filtro', () => {
    expect(hasActiveFilters({ ...EMPTY_TRANSACTION_FILTERS, categoryId: 'c' })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_TRANSACTION_FILTERS, query: 'x' })).toBe(true);
    expect(hasActiveFilters({ ...EMPTY_TRANSACTION_FILTERS, type: 'expense' })).toBe(true);
  });
});

describe('isIsoDate', () => {
  it('acepta fechas reales y rechaza las inexistentes', () => {
    expect(isIsoDate('2026-11-01')).toBe(true);
    expect(isIsoDate('2024-02-29')).toBe(true);
    expect(isIsoDate('2026-02-29')).toBe(false);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('2026-00-10')).toBe(false);
    expect(isIsoDate('2026-11-31')).toBe(false);
    expect(isIsoDate('26-11-01')).toBe(false);
    expect(isIsoDate('')).toBe(false);
  });
});

describe('presetToRange / resolveDatePreset', () => {
  it('all → sin rango', () => {
    expect(presetToRange('all', NOW)).toEqual({ from: null, to: null });
  });

  it('this_month → el mes actual', () => {
    expect(presetToRange('this_month', NOW)).toEqual({ from: '2026-11-01', to: '2026-11-30' });
  });

  it('last_month → el mes anterior', () => {
    expect(presetToRange('last_month', NOW)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
  });

  it('this_quarter → el trimestre actual', () => {
    expect(presetToRange('this_quarter', NOW)).toEqual({ from: '2026-10-01', to: '2026-12-31' });
  });

  it('this_year / last_year → el año natural', () => {
    expect(presetToRange('this_year', NOW)).toEqual({ from: '2026-01-01', to: '2026-12-31' });
    expect(presetToRange('last_year', NOW)).toEqual({ from: '2025-01-01', to: '2025-12-31' });
  });

  it('resolveDatePreset reconoce el preset que corresponde al rango', () => {
    const forPreset = (preset: Exclude<ReturnType<typeof resolveDatePreset>, 'custom' | 'all'>) => {
      const range = presetToRange(preset, NOW);
      return resolveDatePreset(
        { ...EMPTY_TRANSACTION_FILTERS, from: range.from, to: range.to },
        NOW
      );
    };
    expect(forPreset('this_month')).toBe('this_month');
    expect(forPreset('last_month')).toBe('last_month');
    expect(forPreset('this_quarter')).toBe('this_quarter');
    expect(forPreset('this_year')).toBe('this_year');
    expect(forPreset('last_year')).toBe('last_year');
  });

  it('resolveDatePreset: sin rango → all; rango arbitrario → custom', () => {
    expect(resolveDatePreset(EMPTY_TRANSACTION_FILTERS, NOW)).toBe('all');
    expect(
      resolveDatePreset(
        { ...EMPTY_TRANSACTION_FILTERS, from: '2026-01-05', to: '2026-01-09' },
        NOW
      )
    ).toBe('custom');
  });
});

describe('monthKeyRange', () => {
  it('devuelve el primer y el último día del mes', () => {
    expect(monthKeyRange('2026-11')).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(monthKeyRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(monthKeyRange('2024-02')).toEqual({ from: '2024-02-01', to: '2024-02-29' });
  });

  it('devuelve null para claves inválidas', () => {
    expect(monthKeyRange('basura')).toBeNull();
    expect(monthKeyRange('2026-13')).toBeNull();
    expect(monthKeyRange('2026-1')).toBeNull();
    expect(monthKeyRange('')).toBeNull();
  });
});

describe('buildViewHref', () => {
  const filters: TransactionFilters = {
    categoryId: 'abc',
    accountId: null,
    type: null,
    from: '2026-11-01',
    to: '2026-11-30',
    query: '',
  };

  it('construye la URL de transacciones con filtros', () => {
    expect(buildViewHref('transactions', filters)).toBe(
      '/?view=transactions&category=abc&from=2026-11-01&to=2026-11-30'
    );
  });

  it('sin filtros: solo la vista', () => {
    expect(buildViewHref('transactions')).toBe('/?view=transactions');
    expect(buildViewHref('transactions', EMPTY_TRANSACTION_FILTERS)).toBe('/?view=transactions');
  });

  it('IGNORA los filtros si la vista no es transacciones', () => {
    expect(buildViewHref('dashboard', filters)).toBe('/?view=dashboard');
    expect(buildViewHref('reports', filters)).toBe('/?view=reports');
  });
});

describe('replaceViewParamInSearch', () => {
  it('sustituye el param view preservando el resto', () => {
    expect(replaceViewParamInSearch('?view=reports&category=abc', 'transactions')).toBe(
      '?view=transactions&category=abc'
    );
  });

  it('preserva el orden de los demás params', () => {
    expect(
      replaceViewParamInSearch('?view=reports&category=abc&type=expense&from=2026-11-01', 'transactions')
    ).toBe('?view=transactions&category=abc&type=expense&from=2026-11-01');
  });

  it('añade el param view si no estaba', () => {
    expect(replaceViewParamInSearch('', 'dashboard')).toBe('?view=dashboard');
    expect(replaceViewParamInSearch('?category=abc', 'dashboard')).toBe('?view=dashboard&category=abc');
  });

  it('no deja el param view duplicado', () => {
    const result = replaceViewParamInSearch('?view=reports&view=accounts', 'transactions');
    expect(result.match(/view=/g)).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────
// Aplicación de los filtros — EVIDENCIA de carga fría
// ─────────────────────────────────────────────────────────────

interface Tx {
  id: string;
  occurredOn: string;
  categoryId: string | null;
  fromAccountId: string;
  toAccountId: string;
  type: string;
  description: string;
}

/**
 * Fecha con componentes LOCALES a mediodía → el `YYYY-MM-DD` local es el
 * mismo en cualquier zona horaria del runner (nunca se desplaza de día).
 */
function at(year: number, month: number, day: number): string {
  return new Date(year, month, day, 12, 0, 0, 0).toISOString();
}

const TXS: Tx[] = [
  {
    id: 'tx-1',
    occurredOn: at(2026, 10, 3),
    categoryId: 'cat-food',
    fromAccountId: 'acc-1',
    toAccountId: 'x_cat-food',
    type: 'expense',
    description: 'Supermercado',
  },
  {
    id: 'tx-2',
    occurredOn: at(2026, 10, 20),
    categoryId: 'cat-food',
    fromAccountId: 'acc-1',
    toAccountId: 'x_cat-food',
    type: 'expense',
    description: 'Cena',
  },
  {
    id: 'tx-3',
    occurredOn: at(2026, 10, 25),
    categoryId: 'cat-fuel',
    fromAccountId: 'acc-2',
    toAccountId: 'x_cat-fuel',
    type: 'expense',
    description: 'Gasolina',
  },
  {
    id: 'tx-4',
    occurredOn: at(2026, 10, 28),
    categoryId: 'x_cat-salary',
    fromAccountId: 'x_cat-salary',
    toAccountId: 'acc-1',
    type: 'income',
    description: 'Salario',
  },
  {
    id: 'tx-5',
    occurredOn: at(2026, 9, 15),
    categoryId: 'cat-food',
    fromAccountId: 'acc-1',
    toAccountId: 'x_cat-food',
    type: 'expense',
    description: 'Octubre viejo',
  },
];

const EXISTING_CATEGORIES = ['cat-food', 'cat-fuel', 'x_cat-salary'];
const EXISTING_ACCOUNTS = ['acc-1', 'acc-2'];

/**
 * Reproduce la activación del componente con la FUNCIÓN DE PRODUCCIÓN: un
 * filtro está ACTIVO solo si apunta a algo que EXISTE (si no, está colgante →
 * inactivo). Con los datos ya cargados (`loading: false`).
 */
function activationFor(filters: TransactionFilters) {
  const resolved = resolveFilterActivation(filters, {
    categories: EXISTING_CATEGORIES.map((id) => ({ id })),
    accounts: EXISTING_ACCOUNTS.map((id) => ({ id })),
    loading: false,
  });
  return {
    categoryActive: resolved.categoryActive,
    accountActive: resolved.accountActive,
  };
}

/** Atajo: parsea la query de la URL y aplica los filtros (carga fría). */
function applyQuery(query: string, override?: { categoryActive?: boolean; accountActive?: boolean }) {
  const filters = parse(query);
  const activation = activationFor(filters);
  return applyTransactionFilters(TXS, filters, {
    categoryActive: override?.categoryActive ?? activation.categoryActive,
    accountActive: override?.accountActive ?? activation.accountActive,
  });
}

describe('applyTransactionFilters — carga fría desde la URL', () => {
  it('filtra por categoría + rango de fechas al cargar en frío', () => {
    // URL: /?view=transactions&category=cat-food&from=2026-11-01&to=2026-11-30
    const result = applyQuery('category=cat-food&from=2026-11-01&to=2026-11-30');
    expect(result.map((t) => t.id)).toEqual(['tx-2', 'tx-1']);
  });

  it('el rango de fechas es inclusivo', () => {
    const result = applyQuery('from=2026-11-03&to=2026-11-20');
    expect(result.map((t) => t.id)).toEqual(['tx-2', 'tx-1']);
  });

  it('filtra por tipo (ingresos/gastos)', () => {
    expect(applyQuery('type=income').map((t) => t.id)).toEqual(['tx-4']);
    expect(applyQuery('type=expense').map((t) => t.id)).toEqual([
      'tx-3',
      'tx-2',
      'tx-1',
      'tx-5',
    ]);
  });

  it('filtra por cuenta (origen O destino)', () => {
    expect(applyQuery('account=acc-2').map((t) => t.id)).toEqual(['tx-3']);
    // `acc-1` aparece como origen en varias y como destino en el ingreso.
    expect(applyQuery('account=acc-1').map((t) => t.id)).toEqual([
      'tx-4',
      'tx-2',
      'tx-1',
      'tx-5',
    ]);
  });

  it('la búsqueda por texto ignora mayúsculas y minúsculas', () => {
    expect(applyQuery('q=SUPERMERCADO').map((t) => t.id)).toEqual(['tx-1']);
  });

  it('ordena de más reciente a más antigua', () => {
    const result = applyQuery('');
    expect(result.map((t) => t.id)).toEqual(['tx-4', 'tx-3', 'tx-2', 'tx-1', 'tx-5']);
  });

  it('params INVÁLIDOS no rompen la vista (el filtro se descarta)', () => {
    // type=banana y from=2026-13-45 → ambos filtros quedan inactivos.
    const filters = parse('type=banana&from=2026-13-45&to=2026-02-30');
    expect(filters.type).toBeNull();
    expect(filters.from).toBeNull();
    expect(filters.to).toBeNull();

    const result = applyTransactionFilters(TXS, filters, activationFor(filters));
    expect(result).toHaveLength(TXS.length);
  });

  it('from > to se normaliza invirtiendo el rango', () => {
    const filters = parse('from=2026-11-30&to=2026-11-01');
    expect(filters.from).toBe('2026-11-01');
    expect(filters.to).toBe('2026-11-30');

    const result = applyTransactionFilters(TXS, filters, activationFor(filters));
    // Rango normalizado = noviembre completo (sin filtro de categoría).
    expect(result.map((t) => t.id)).toEqual(['tx-4', 'tx-3', 'tx-2', 'tx-1']);
  });

  it('un filtro COLGANTE está inactivo: no deja la vista vacía', () => {
    // La categoría `cat-fantasma` no existe → el filtro NO acota.
    const filters = parse('category=cat-fantasma&from=2026-11-01&to=2026-11-30');
    expect(activationFor(filters).categoryActive).toBe(false);

    const result = applyTransactionFilters(TXS, filters, activationFor(filters));
    // Solo acota el rango de fechas: tx-1..tx-4 (noviembre).
    expect(result.map((t) => t.id)).toEqual(['tx-4', 'tx-3', 'tx-2', 'tx-1']);
  });
});

// ─────────────────────────────────────────────────────────────
// Filtros colgantes vs. estado de carga (deep-link en frío)
// ─────────────────────────────────────────────────────────────

describe('resolveFilterActivation — filtro colgante y carga', () => {
  const CATEGORIES = [{ id: 'cat-food' }];
  const ACCOUNTS = [{ id: 'acc-1' }];

  it('MIENTRAS CARGA no hay aviso de filtro colgante (deep-link válido)', () => {
    const filters = parse('category=cat-food');
    const resolved = resolveFilterActivation(filters, {
      categories: CATEGORIES,
      accounts: ACCOUNTS,
      loading: true,
    });
    expect(resolved.hasDanglingFilter).toBe(false);
    // El filtro se aplica con normalidad (no se descarta).
    expect(resolved.categoryActive).toBe(true);
  });

  it('MIENTRAS CARGA el filtro sigue activo aunque el catálogo aún no exista', () => {
    // Catálogo vacío (datos aún no llegados) + filtro en la URL.
    const filters = parse('category=cat-food&account=acc-1');
    const resolved = resolveFilterActivation(filters, {
      categories: [],
      accounts: [],
      loading: true,
    });
    expect(resolved.hasDanglingFilter).toBe(false);
    expect(resolved.categoryActive).toBe(true);
    expect(resolved.accountActive).toBe(true);
    expect(resolved.categoryExists).toBe(false);
    expect(resolved.accountExists).toBe(false);
  });

  it('CON DATOS CARGADOS un id inexistente → filtro colgante (aviso + inactivo)', () => {
    const filters = parse('category=cat-fantasma');
    const resolved = resolveFilterActivation(filters, {
      categories: CATEGORIES,
      accounts: ACCOUNTS,
      loading: false,
    });
    expect(resolved.hasDanglingFilter).toBe(true);
    expect(resolved.categoryActive).toBe(false);
    expect(resolved.categoryExists).toBe(false);
  });

  it('CON DATOS CARGADOS un id existente → filtro válido (sin aviso, activo)', () => {
    const filters = parse('category=cat-food&account=acc-1');
    const resolved = resolveFilterActivation(filters, {
      categories: CATEGORIES,
      accounts: ACCOUNTS,
      loading: false,
    });
    expect(resolved.hasDanglingFilter).toBe(false);
    expect(resolved.categoryActive).toBe(true);
    expect(resolved.accountActive).toBe(true);
    expect(resolved.categoryExists).toBe(true);
    expect(resolved.accountExists).toBe(true);
  });

  it('una cuenta colgante también se detecta (y se marca inactiva)', () => {
    const filters = parse('account=acc-fantasma');
    const resolved = resolveFilterActivation(filters, {
      categories: CATEGORIES,
      accounts: ACCOUNTS,
      loading: false,
    });
    expect(resolved.hasDanglingFilter).toBe(true);
    expect(resolved.accountActive).toBe(false);
  });

  it('sin filtros en la URL no hay nada colgante ni activo', () => {
    const resolved = resolveFilterActivation(EMPTY_TRANSACTION_FILTERS, {
      categories: CATEGORIES,
      accounts: ACCOUNTS,
      loading: false,
    });
    expect(resolved.hasDanglingFilter).toBe(false);
    expect(resolved.categoryActive).toBe(false);
    expect(resolved.accountActive).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// El `value` del Select durante la carga (P2 — pulido)
// ─────────────────────────────────────────────────────────────

describe('resolveSelectFilterValue — el desplegable nunca contradice a la lista', () => {
  it('MIENTRAS CARGA refleja el filtro de la URL (aunque el catálogo esté vacío)', () => {
    // El filtro SÍ se aplica durante la carga → el desplegable no puede
    // afirmar "todas" (el usuario vería una lista filtrada + "todas").
    expect(resolveSelectFilterValue('cat-food', false, true)).toBe('cat-food');
    expect(resolveSelectFilterValue('acc-1', false, true)).toBe('acc-1');
  });

  it('MIENTRAS CARGA sin filtro en la URL → "todas"', () => {
    expect(resolveSelectFilterValue(null, false, true)).toBe('all');
  });

  it('TRAS CARGAR, si el elemento existe → su id', () => {
    expect(resolveSelectFilterValue('cat-food', true, false)).toBe('cat-food');
    expect(resolveSelectFilterValue('acc-1', true, false)).toBe('acc-1');
  });

  it('TRAS CARGAR, si el elemento NO existe → "todas" (el filtro queda inactivo)', () => {
    expect(resolveSelectFilterValue('cat-fantasma', false, false)).toBe('all');
    expect(resolveSelectFilterValue('acc-fantasma', false, false)).toBe('all');
  });

  it('TRAS CARGAR sin filtro en la URL → "todas"', () => {
    expect(resolveSelectFilterValue(null, false, false)).toBe('all');
  });
});
