import { NextResponse } from 'next/server';
import { authenticateV1Request, hasPermission } from '@/lib/auth/v1-api';
import { LEGACY_SUCCESSOR, withLegacyDeprecation } from '@/lib/http/deprecation';
import { db } from '@/lib/db';

/**
 * GET /api/agent/accounts
 * Returns all accounts for the authenticated API key user.
 *
 * DEPRECATED (Fase 0): usa `GET /api/v1/accounts`.
 * Auth unificada (`authenticateV1Request`), rate limit compartido con v1 y
 * errores normalizados al shape v1. El shape de ÉXITO no cambia (solo se
 * añade `success: true`).
 *
 * Headers: X-API-Key: fz_xxxxx  (o Authorization: Bearer fz_xxxxx)
 */

export async function GET(req: Request) {
  const auth = await authenticateV1Request(req);
  if (!auth.ok) return withLegacyDeprecation(auth.response!, LEGACY_SUCCESSOR.accounts);
  const user = auth.user!;

  if (!hasPermission(user, 'read')) {
    return withLegacyDeprecation(
      NextResponse.json(
        { success: false, error: 'forbidden', message: 'This API key does not have read permission' },
        { status: 403 }
      ),
      LEGACY_SUCCESSOR.accounts
    );
  }

  const accounts = await db.account.findMany({
    where: { userId: user.userId },
    orderBy: { createdAt: 'asc' },
  });

  return withLegacyDeprecation(
    NextResponse.json({
      success: true,
      count: accounts.length,
      accounts: accounts.map(a => ({
        id: a.id,
        name: a.name,
        type: a.accountType,
        subType: a.subType,
        currency: a.currency,
        balance: a.currentBalance,
        institution: a.institution,
      })),
    }),
    LEGACY_SUCCESSOR.accounts
  );
}
