import { describe, expect, it } from 'vitest';
import {
  buildExportRows,
  exportTransactionsCsv,
  exportTransactionsJson,
  type ExportContext,
  type ExportRow,
} from '@/lib/finzen/export';

/**
 * P1 — Export de transacciones (convención 10-U0).
 *
 * El CSV conserva el header histórico y el escapado RFC 4180; el JSON de
 * respaldo conserva `id`, `tags` e `importSource` VERBATIM (los usa
 * `POST /api/restore`).
 */
const CTX: ExportContext = {
  categories: [{ id: 'cat-1', name: 'Comida', nameEs: 'Comida', nameEn: 'Food' }],
  accounts: [{ id: 'acc-1', name: 'Cuenta corriente' }],
  locale: 'es',
  baseCurrency: 'DOP',
};

function row(overrides: Partial<ExportRow> = {}): ExportRow {
  return {
    id: 'tx-1',
    type: 'expense',
    amount: 100,
    currency: 'DOP',
    occurredOn: '2026-11-15T10:00:00.000Z',
    description: 'Cena',
    categoryId: 'cat-1',
    fromAccountId: 'acc-1',
    toAccountId: 'x_cat-1',
    tags: 'manual,extra',
    importSource: 'csv',
    ...overrides,
  };
}

describe('exportTransactionsCsv', () => {
  it('emite el header exacto', () => {
    const csv = exportTransactionsCsv([row()], CTX);
    expect(csv.split('\n')[0]).toBe(
      'Date,Type,Amount,Currency,Description,Category,Account'
    );
  });

  it('serializa una fila con las celdas de texto entrecomilladas', () => {
    const csv = exportTransactionsCsv([row()], CTX);
    expect(csv.split('\n')[1]).toBe(
      '2026-11-15,expense,100,DOP,"Cena","Comida","Cuenta corriente"'
    );
  });

  it('escapa las comillas internas según RFC 4180 ("" doubling)', () => {
    const csv = exportTransactionsCsv([row({ description: 'Cafe "El Rincon"' })], CTX);
    expect(csv).toContain('"Cafe ""El Rincon"""');
  });

  it('una celda con comas y saltos de línea no rompe las columnas', () => {
    const csv = exportTransactionsCsv([row({ description: 'a,b\nc"d' })], CTX);
    const lines = csv.split('\n');
    // cabecera + 1 línea física (la celda multilínea va entrecomillada)
    expect(lines[0]).toBe('Date,Type,Amount,Currency,Description,Category,Account');
    expect(csv).toContain('"a,b\nc""d"');
  });

  it('sin categoría o cuenta deja la celda vacía', () => {
    const csv = exportTransactionsCsv(
      [row({ categoryId: null, fromAccountId: 'x_cat-9', toAccountId: 'x_cat-9' })],
      CTX
    );
    expect(csv.split('\n')[1]).toBe('2026-11-15,expense,100,DOP,"Cena","",""');
  });
});

describe('exportTransactionsJson', () => {
  it('conserva id, tags e importSource VERBATIM (compatibilidad con /api/restore)', () => {
    const json = exportTransactionsJson([row()], CTX);
    const parsed = JSON.parse(json) as Array<Record<string, unknown>>;
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe('tx-1');
    expect(parsed[0].tags).toBe('manual,extra');
    expect(parsed[0].importSource).toBe('csv');
  });

  it('preserva un array de tags tal cual (sin convertirlo a CSV)', () => {
    const json = exportTransactionsJson([row({ tags: ['a', 'b'] })], CTX);
    const parsed = JSON.parse(json) as Array<Record<string, unknown>>;
    expect(parsed[0].tags).toEqual(['a', 'b']);
  });

  it('preserva importSource null', () => {
    const json = exportTransactionsJson([row({ importSource: null })], CTX);
    const parsed = JSON.parse(json) as Array<Record<string, unknown>>;
    expect(parsed[0].importSource).toBeNull();
  });

  it('con envelope, los metadatos quedan junto a las transacciones', () => {
    const json = exportTransactionsJson([row()], CTX, {
      exportedAt: '2026-11-15T00:00:00.000Z',
      filterApplied: { dateFilter: 'all', categoryFilter: 'all', search: '' },
    });
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(parsed.exportedAt).toBe('2026-11-15T00:00:00.000Z');
    expect(parsed.filterApplied).toEqual({
      dateFilter: 'all',
      categoryFilter: 'all',
      search: '',
    });
    expect(Array.isArray(parsed.transactions)).toBe(true);
  });
});

describe('buildExportRows', () => {
  it('resuelve la categoría y la cuenta por nombre localizado', () => {
    const rows = buildExportRows([row()], CTX);
    expect(rows[0].category).toBe('Comida');
    expect(rows[0].account).toBe('Cuenta corriente');
    expect(rows[0].date).toBe('2026-11-15');
  });
});
