import type { CurrencyCode, Locale } from './currency';
import { localizedCategoryName } from './localize';

/**
 * Export de transacciones — módulo PURO (sin DOM salvo `downloadTextFile`).
 *
 * Antes de esta fase el export CSV/JSON estaba duplicado en tres componentes
 * (transactions-view, settings-view, import-view) con el mismo header, el
 * mismo escapado de comillas y el mismo Blob+`<a download>`. Aquí vive una
 * sola implementación: los componentes solo eligen qué filas exportar.
 */

export type ExportRow = {
  /** ID original de la transacción — se preserva para `POST /api/restore`. */
  id: string;
  type: string;
  amount: number;
  currency: string;
  occurredOn: string | Date;
  description?: string | null;
  categoryId?: string | null;
  fromAccountId: string;
  toAccountId: string;
  /** Tags tal cual venían en el store (CSV string o array). No se convierten. */
  tags?: string | string[] | null;
  /** Origen de la importación tal cual (puede ser null). */
  importSource?: string | null;
};

export interface ExportContext {
  categories: { id: string; name: string; nameEs?: string | null; nameEn?: string | null }[];
  accounts: { id: string; name: string }[];
  locale: Locale;
  /** Moneda base del usuario. Se conserva en el contrato para que el llamador
   *  declare explícitamente el contexto; el export mantiene la moneda
   *  original de cada transacción (no convierte) como hasta ahora. */
  baseCurrency: CurrencyCode;
}

/** Fila serializada del export JSON. */
export interface ExportedTransaction {
  /** ID original de la transacción (preservado para restaurar sin duplicar). */
  id: string;
  /** YYYY-MM-DD */
  date: string;
  type: string;
  amount: number;
  currency: string;
  description: string;
  /** Nombre de la categoría ya localizado (vacío si la tx no tiene categoría). */
  category: string;
  /** Nombre de la cuenta real (origen, o destino si el origen es virtual). */
  account: string;
  categoryId: string | null;
  fromAccountId: string;
  toAccountId: string;
  /** ISO-8601 completo de la fecha real. */
  occurredOn: string;
  /** Tags VERBATIM: string CSV o array, tal cual venían en el store. */
  tags?: string | string[] | null;
  /** `importSource` VERBATIM (null si la transacción no tiene origen de importación). */
  importSource?: string | null;
}

const CSV_HEADER = ['Date', 'Type', 'Amount', 'Currency', 'Description', 'Category', 'Account'];

/**
 * Celda CSV: siempre entrecomillada, con las comillas internas duplicadas
 * (RFC 4180). Es el formato que ya usaban los tres componentes.
 */
function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function isoDate(occurredOn: string | Date): string {
  return new Date(occurredOn).toISOString().split('T')[0];
}

function categoryNameFor(row: ExportRow, ctx: ExportContext): string {
  const cat = ctx.categories.find((c) => c.id === row.categoryId);
  return cat ? localizedCategoryName(cat, ctx.locale) : '';
}

function accountNameFor(row: ExportRow, ctx: ExportContext): string {
  const acct =
    ctx.accounts.find((a) => a.id === row.fromAccountId) ??
    ctx.accounts.find((a) => a.id === row.toAccountId);
  return acct?.name ?? '';
}

/** Filas normalizadas con categoría y cuenta resueltas (base del export JSON). */
export function buildExportRows(rows: ExportRow[], ctx: ExportContext): ExportedTransaction[] {
  return rows.map((row) => ({
    id: row.id,
    date: isoDate(row.occurredOn),
    type: row.type,
    amount: row.amount,
    currency: row.currency,
    description: row.description ?? '',
    category: categoryNameFor(row, ctx),
    account: accountNameFor(row, ctx),
    categoryId: row.categoryId ?? null,
    fromAccountId: row.fromAccountId,
    toAccountId: row.toAccountId,
    occurredOn: new Date(row.occurredOn).toISOString(),
    // Verbatim: el restore necesita los tags y el origen tal cual.
    tags: row.tags,
    importSource: row.importSource,
  }));
}

/** Export CSV (header + una línea por transacción). */
export function exportTransactionsCsv(rows: ExportRow[], ctx: ExportContext): string {
  const lines = rows.map((row) =>
    [
      isoDate(row.occurredOn),
      row.type,
      String(row.amount),
      row.currency,
      csvCell(row.description || ''),
      csvCell(categoryNameFor(row, ctx)),
      csvCell(accountNameFor(row, ctx)),
    ].join(',')
  );
  return [CSV_HEADER.join(','), ...lines].join('\n');
}

/**
 * Export JSON.
 *
 * Sin `envelope` devuelve un array con una entrada por transacción. Con
 * `envelope` devuelve `{ ...envelope, transactions: [...] }` — así Ajustes e
 * Importación conservan los metadatos que ya exportaban (cuentas, filtros).
 */
export function exportTransactionsJson(
  rows: ExportRow[],
  ctx: ExportContext,
  envelope?: Record<string, unknown>
): string {
  const transactions = buildExportRows(rows, ctx);
  const payload = envelope ? { ...envelope, transactions } : transactions;
  return JSON.stringify(payload, null, 2);
}

/**
 * Descarga un texto como archivo. Único punto del repo que toca el DOM para
 * exports (Blob + object URL + `<a download>`).
 */
export function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Nombre de archivo con la fecha del día (mismo patrón que antes). */
export function exportFilename(prefix: string, extension: 'csv' | 'json'): string {
  return `${prefix}-${new Date().toISOString().split('T')[0]}.${extension}`;
}

/** Opciones de `downloadTransactions()`. */
export interface DownloadTransactionsOptions {
  /** Filas a exportar (el llamador decide qué filas: todas o filtradas). */
  rows: ExportRow[];
  /** Contexto de localización (categorías, cuentas, locale, moneda base). */
  ctx: ExportContext;
  /** Formato del archivo. */
  format: 'csv' | 'json';
  /** Prefijo del nombre de archivo (def 'finzen-export'). */
  prefix?: string;
  /** Metadatos del JSON (solo se aplican si `format === 'json'`). */
  envelope?: Record<string, unknown>;
}

/**
 * Export + descarga en un solo paso (fase 10-U2).
 *
 * Es el ÚNICO camino de descarga de transacciones del repo: el contenido, el
 * nombre del archivo y el MIME son exactamente los que producían los tres
 * call-sites (Ajustes, Importar, Transacciones) antes de este helper.
 *
 * El toast lo pone el llamador (aquí no hay UI). Si no hay filas, el llamador
 * muestra su mensaje de "sin datos" y NO llama a este helper.
 */
export function downloadTransactions(opts: DownloadTransactionsOptions): {
  filename: string;
  count: number;
} {
  const { rows, ctx, format, prefix = 'finzen-export', envelope } = opts;
  const filename = exportFilename(prefix, format);
  const content =
    format === 'json'
      ? exportTransactionsJson(rows, ctx, envelope)
      : exportTransactionsCsv(rows, ctx);
  downloadTextFile(
    filename,
    content,
    format === 'json' ? 'application/json' : 'text/csv'
  );
  return { filename, count: rows.length };
}
