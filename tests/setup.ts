/**
 * Setup global de Vitest (10-U4).
 *
 * Solo variables de entorno de PRUEBAS. Nunca secretos reales, nunca la BD de
 * desarrollo (`db/custom.db`) ni Turso: los tests que necesitan BD usan un
 * SQLite temporal (ver `tests/global-setup.ts`, fase P3) o un fake en memoria
 * con `vi.mock('@/lib/db')`.
 */

/** Secreto de pruebas para los recibos HMAC del undo (NO es un valor de producción). */
process.env.NEXTAUTH_SECRET ??= 'shikin-test-secret-not-a-production-value';

/** `NODE_ENV=test` evita que cualquier módulo caiga en modo producción (fail-fast de BD). */
if (!process.env.NODE_ENV) {
  // `process.env.NODE_ENV` es `readonly` en los tipos de Next
  // (`next/types/global.d.ts`): `Reflect.set` lo fija sin `as any`.
  Reflect.set(process.env, 'NODE_ENV', 'test');
}

/**
 * GUARDARRAÍL DE AISLAMIENTO (fail-fast).
 *
 * `tests/global-setup.ts` monta un SQLite TEMPORAL y publica su URL en
 * `FINZEN_TEST_DATABASE_URL` (y la sobreescribe en `DATABASE_URL`). Si este
 * setup se ejecuta sin ese globalSetup, los tests NO deben seguir: podrían
 * tocar `db/custom.db` o Turso.
 */
const testDbUrl = process.env.FINZEN_TEST_DATABASE_URL;
if (!testDbUrl || !testDbUrl.startsWith('file:')) {
  throw new Error(
    '[vitest] Sin BD temporal: `tests/global-setup.ts` no se ejecutó. ' +
      'Se aborta para no tocar `db/custom.db` ni Turso.'
  );
}
