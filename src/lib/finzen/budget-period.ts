import { toLocalDateString } from '@/lib/finzen/date-utils';
import { isIsoDate, monthKeyRange } from '@/lib/finzen/transaction-filters';

/**
 * Periodo de un presupuesto (convención 10-U4).
 *
 * Un presupuesto puede ABARCAR varios meses (`startDate` … `endDate`). El
 * importe gastado (`spent`) y el destino del drill-down deben usar SIEMPRE
 * el MISMO rango: si el número mostrado fuera el de un solo mes y el destino
 * el de todo el presupuesto, el usuario vería cifras que no cuadran
 * (AGENTS.md §5 — "Presupuestos: el destino usa el mismo periodo que el
 * cálculo del gasto mostrado").
 *
 * Módulo PURO: sin React, sin DOM, sin Next, sin Prisma.
 */

/** Rango inclusivo de fechas (`YYYY-MM-DD`). */
export interface BudgetPeriodRange {
  /** Límite inferior (inclusivo). */
  from: string;
  /** Límite superior (inclusivo). */
  to: string;
}

/**
 * Extrae la FECHA DE CALENDARIO (`YYYY-MM-DD`) de un valor de fecha.
 *
 * Se usa la parte de calendario del valor guardado (los presupuestos se
 * guardan como `YYYY-MM-DD` o como ISO con hora): el periodo de un
 * presupuesto es un rango de DÍAS, no un instante.
 */
function calendarDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const iso = `${match[1]}-${match[2]}-${match[3]}`;
  return isIsoDate(iso) ? iso : null;
}

/**
 * Rango (inclusivo) que ABARCA el presupuesto.
 *
 * - `startDate` y `endDate` válidos y coherentes (`endDate >= startDate`) →
 *   rango COMPLETO (un presupuesto multi-mes muestra el gasto de todo su
 *   periodo, no solo el del primer mes).
 * - `endDate` ausente, inválido o anterior a `startDate` → fallback SEGURO:
 *   el mes natural de `startDate`.
 * - sin `startDate` (o inválido) → el mes natural de `now`.
 */
export function budgetPeriodRange(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  now: Date
): BudgetPeriodRange {
  const from = calendarDate(startDate);
  const to = calendarDate(endDate);

  // Rango completo: el presupuesto abarca varios meses (o uno).
  if (from && to && to >= from) return { from, to };

  // Fallback: el mes natural del inicio (mismo comportamiento que antes).
  if (from) {
    const month = monthKeyRange(from.slice(0, 7));
    if (month) return month;
  }

  // Fallback final: el mes actual.
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const month = monthKeyRange(monthKey);
  return month ?? { from: toLocalDateString(now), to: toLocalDateString(now) };
}
