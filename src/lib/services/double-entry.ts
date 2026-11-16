/**
 * Guard de doble entrada (Fase 0 — convención 11-A0 / AGENTS.md §5).
 * ------------------------------------------------------------------
 * Módulo PURO: no importa la base de datos ni ningún módulo de Next.
 * Solo define la regla de negocio que exige que una transacción respete
 * la convención real ↔ virtual:
 *
 *   - GASTO  (`expense`):  cuenta REAL  → `x_<categoryId>`
 *   - INGRESO (`income`):  `x_<categoryId>` → cuenta REAL
 *
 * La regla vive AQUÍ (y no en el route handler) porque es lógica de
 * negocio: los handlers quedan como adaptadores delgados
 * (`agent.md` §2). El handler solo RESUELVE las cuentas de entrada
 * (`virtualAccountId`, `resolvedToAccountId`) y delega la decisión.
 *
 * La convención de string `x_<categoryId>` NUNCA se materializa como
 * fila de `Account`: es un identificador virtual.
 */

/** Violación de la convención de doble entrada (shape de error v1). */
export type DoubleEntryViolation = {
  error: 'invalid_transaction';
  message: string;
};

/** Entrada mínima que necesita el guard para decidir. */
export interface DoubleEntryInput {
  /** `expense` | `income` | `transfer` | `adjustment` | … */
  type: string;
  /** Categoría asociada (si la hay). */
  categoryId?: string | null;
  /** Cuenta origen tal y como la envió el cliente. */
  fromAccountId?: string | null;
  /** Cuenta destino tal y como la envió el cliente (puede faltar). */
  toAccountId?: string | null;
  /** `toAccountId` YA RESUELTO por el handler (destino efectivo). */
  resolvedToAccountId?: string | null;
}

/**
 * Valida la convención de doble entrada.
 *
 * Devuelve `null` cuando NO hay violación (transacción válida, caso
 * ambiguo o tipo sin doble-entry) y la violación cuando la convención
 * está rota.
 *
 * Semántica (exacta):
 * - `expense` + categoría + destino resuelto ≠ `x_<categoryId>` ⇒ violación.
 * - `income`  + categoría + `fromAccountId` ≠ `x_<categoryId>` ⇒ violación.
 * - `income`  SIN categoría ⇒ `null` (caso ambiguo: se comporta como hoy).
 * - `transfer` / `adjustment` (o cualquier otro tipo) ⇒ `null`.
 *
 * NOTA sobre datos ausentes: si la cuenta relevante NO está (destino
 * sin resolver o `fromAccountId` ausente) el guard NO puede *probar*
 * una violación ⇒ devuelve `null`. La presencia de esos campos la
 * valida el handler (`invalid_payload`), no este guard: así el guard
 * nunca bloquea una petición por un dato que no puede comprobar.
 */
export function validateDoubleEntry(input: DoubleEntryInput): DoubleEntryViolation | null {
  const categoryId = input.categoryId ?? null;
  if (!categoryId) return null;

  const virtualAccountId = `x_${categoryId}`;

  if (input.type === 'expense') {
    // El handler resuelve el destino (si falta, `x_<categoryId>`); sin
    // destino no hay nada que comprobar.
    const effectiveToAccountId = input.resolvedToAccountId ?? input.toAccountId ?? null;
    if (!effectiveToAccountId || effectiveToAccountId === virtualAccountId) return null;

    return {
      error: 'invalid_transaction',
      message: `Expense transactions must use the virtual category account '${virtualAccountId}' as toAccountId (real account → x_<categoryId>). Use POST /api/v1/expenses instead.`,
    };
  }

  if (input.type === 'income') {
    const fromAccountId = input.fromAccountId ?? null;
    if (!fromAccountId || fromAccountId === virtualAccountId) return null;

    return {
      error: 'invalid_transaction',
      message: `Income transactions must use the virtual category account '${virtualAccountId}' as fromAccountId (x_<categoryId> → real account). Use POST /api/v1/incomes instead.`,
    };
  }

  return null;
}
