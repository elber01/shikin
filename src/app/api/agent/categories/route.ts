import { NextResponse } from 'next/server';
import { authenticateV1Request, hasPermission } from '@/lib/auth/v1-api';
import { LEGACY_SUCCESSOR, withLegacyDeprecation } from '@/lib/http/deprecation';
import { db } from '@/lib/db';

/**
 * GET /api/agent/categories
 * Returns all categories for the authenticated API key user.
 * Useful for AI agents to know what categories exist before creating transactions.
 *
 * DEPRECATED (Fase 0): no existe sucesor v1 todavía (pendiente de Fase 1).
 * Auth unificada (`authenticateV1Request`), rate limit compartido con v1 y
 * errores normalizados al shape v1. El shape de ÉXITO no cambia (solo se
 * añade `success: true`).
 *
 * Headers: X-API-Key: fz_xxxxx  (o Authorization: Bearer fz_xxxxx)
 */

export async function GET(req: Request) {
  const auth = await authenticateV1Request(req);
  if (!auth.ok) return withLegacyDeprecation(auth.response!, LEGACY_SUCCESSOR.categories);
  const user = auth.user!;

  if (!hasPermission(user, 'read')) {
    return withLegacyDeprecation(
      NextResponse.json(
        { success: false, error: 'forbidden', message: 'This API key does not have read permission' },
        { status: 403 }
      ),
      LEGACY_SUCCESSOR.categories
    );
  }

  const categories = await db.category.findMany({
    where: { userId: user.userId },
    orderBy: { sortOrder: 'asc' },
  });

  return withLegacyDeprecation(
    NextResponse.json({
      success: true,
      count: categories.length,
      categories: categories.map(c => ({
        id: c.id,
        name: c.name,
        nameEs: c.nameEs,
        nameEn: c.nameEn,
        icon: c.icon,
        color: c.color,
        direction: c.direction, // income | expense | transfer
        isSystem: c.isSystem,
      })),
    }),
    LEGACY_SUCCESSOR.categories
  );
}
