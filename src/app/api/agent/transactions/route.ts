import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { authenticateV1Request, hasPermission } from '@/lib/auth/v1-api';
import { LEGACY_SUCCESSOR, withLegacyDeprecation } from '@/lib/http/deprecation';
import { validateDoubleEntry } from '@/lib/services/double-entry';
import { db } from '@/lib/db';

/**
 * GET /api/agent/transactions
 * Returns transactions for the authenticated API key user.
 *
 * DEPRECATED (Fase 0): usa `POST/GET /api/v1/expenses` o `/api/v1/incomes`.
 * Auth unificada (`authenticateV1Request`), rate limit compartido con v1 y
 * errores normalizados al shape v1. El shape de ÉXITO no cambia (solo se
 * añade `success: true`).
 *
 * Headers: X-API-Key: fz_xxxxx  (o Authorization: Bearer fz_xxxxx)
 *
 * Query params:
 *   - limit: number (default 50, max 500)
 *   - type: income | expense | transfer
 *   - categoryId: string
 *   - fromDate: YYYY-MM-DD
 *   - toDate: YYYY-MM-DD
 *   - search: string (searches description)
 *
 * POST /api/agent/transactions
 * Creates a new transaction.
 *
 * Body:
 *   - type: income | expense | transfer (required)
 *   - amount: number (required)
 *   - currency: string (default: user's base currency)
 *   - fromAccountId: string (required)
 *   - toAccountId: string (required for transfer, or x_<categoryId> for expense)
 *   - categoryId: string (optional)
 *   - description: string
 *   - date: YYYY-MM-DD (default: today)
 *   - tags: string[]
 */

export async function GET(req: Request) {
  const auth = await authenticateV1Request(req);
  if (!auth.ok) return withLegacyDeprecation(auth.response!, LEGACY_SUCCESSOR.transactions);
  const user = auth.user!;

  if (!hasPermission(user, 'read')) {
    return withLegacyDeprecation(
      NextResponse.json(
        { success: false, error: 'forbidden', message: 'This API key does not have read permission' },
        { status: 403 }
      ),
      LEGACY_SUCCESSOR.transactions
    );
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 500);
  const type = searchParams.get('type');
  const categoryId = searchParams.get('categoryId');
  const fromDate = searchParams.get('fromDate');
  const toDate = searchParams.get('toDate');
  const search = searchParams.get('search');

  const where: Prisma.TransactionWhereInput = { userId: user.userId };
  if (type) where.type = type;
  if (categoryId) where.categoryId = categoryId;
  if (fromDate || toDate) {
    where.occurredOn = {};
    if (fromDate) where.occurredOn.gte = new Date(fromDate + 'T12:00:00');
    if (toDate) where.occurredOn.lte = new Date(toDate + 'T23:59:59');
  }
  if (search) where.description = { contains: search };

  const transactions = await db.transaction.findMany({
    where,
    include: {
      category: { select: { id: true, name: true, nameEs: true, icon: true, color: true } },
    },
    orderBy: { occurredOn: 'desc' },
    take: limit,
  });

  return withLegacyDeprecation(
    NextResponse.json({
      success: true,
      count: transactions.length,
      transactions: transactions.map(tx => ({
        id: tx.id,
        type: tx.type,
        amount: tx.amount,
        currency: tx.currency,
        description: tx.description,
        date: tx.occurredOn.toISOString().split('T')[0],
        categoryId: tx.categoryId,
        category: tx.category ? {
          name: tx.category.name,
          nameEs: tx.category.nameEs,
          icon: tx.category.icon,
          color: tx.category.color,
        } : null,
        tags: tx.tags ? tx.tags.split(',') : [],
        importSource: tx.importSource,
      })),
    }),
    LEGACY_SUCCESSOR.transactions
  );
}

export async function POST(req: Request) {
  const auth = await authenticateV1Request(req);
  if (!auth.ok) return withLegacyDeprecation(auth.response!, LEGACY_SUCCESSOR.transactions);
  const user = auth.user!;

  if (!hasPermission(user, 'write')) {
    return withLegacyDeprecation(
      NextResponse.json(
        { success: false, error: 'forbidden', message: 'This API key does not have write permission' },
        { status: 403 }
      ),
      LEGACY_SUCCESSOR.transactions
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return withLegacyDeprecation(
      NextResponse.json(
        { success: false, error: 'invalid_json', message: 'Request body must be valid JSON' },
        { status: 400 }
      ),
      LEGACY_SUCCESSOR.transactions
    );
  }

  if (typeof body !== 'object' || body === null) {
    return withLegacyDeprecation(
      NextResponse.json(
        { success: false, error: 'invalid_payload', message: 'type, amount and fromAccountId are required' },
        { status: 400 }
      ),
      LEGACY_SUCCESSOR.transactions
    );
  }

  const {
    type,
    amount,
    currency,
    fromAccountId,
    toAccountId,
    categoryId,
    description,
    date,
    tags,
  } = body as {
    type?: string;
    amount?: number | string;
    currency?: string;
    fromAccountId?: string;
    toAccountId?: string;
    categoryId?: string;
    description?: string;
    date?: string;
    tags?: string[] | string;
  };

  // `amount = 0` NO es "ausente": cae en la validación de `invalid_amount`.
  if (!type || amount === undefined || amount === null || !fromAccountId) {
    return withLegacyDeprecation(
      NextResponse.json(
        { success: false, error: 'invalid_payload', message: 'type, amount and fromAccountId are required' },
        { status: 400 }
      ),
      LEGACY_SUCCESSOR.transactions
    );
  }

  if (Number(amount) <= 0) {
    return withLegacyDeprecation(
      NextResponse.json(
        { success: false, error: 'invalid_amount', message: 'amount must be positive' },
        { status: 400 }
      ),
      LEGACY_SUCCESSOR.transactions
    );
  }

  // Get user's base currency if not specified
  const userRecord = await db.user.findUnique({
    where: { id: user.userId },
    select: { baseCurrency: true },
  });

  // Parse date safely (timezone-safe)
  const dateStr = date || new Date().toISOString().split('T')[0];
  const occurredOn = dateStr.includes('T')
    ? new Date(dateStr)
    : new Date(dateStr + 'T12:00:00');

  const category = categoryId ?? null;
  const virtualAccountId = category ? `x_${category}` : null;
  const resolvedToAccountId =
    toAccountId ||
    (type === 'expense' && virtualAccountId ? virtualAccountId : fromAccountId);

  // GUARD DE DOBLE ENTRADA (Fase 0) — la REGLA vive en el servicio puro
  // `src/lib/services/double-entry.ts`; aquí solo se resuelven las
  // cuentas de entrada (virtualAccountId / resolvedToAccountId).
  const doubleEntryViolation = validateDoubleEntry({
    type,
    categoryId,
    fromAccountId,
    toAccountId,
    resolvedToAccountId,
  });
  if (doubleEntryViolation) {
    return withLegacyDeprecation(
      NextResponse.json(
        { success: false, ...doubleEntryViolation },
        { status: 400 }
      ),
      LEGACY_SUCCESSOR.transactions
    );
  }

  try {
    const transaction = await db.transaction.create({
      data: {
        userId: user.userId,
        type,
        amount: Number(amount),
        currency: currency || userRecord?.baseCurrency || 'USD',
        fromAccountId,
        toAccountId: resolvedToAccountId,
        categoryId: category || null,
        description: description || '',
        occurredOn,
        tags: Array.isArray(tags) ? tags.join(',') : (typeof tags === 'string' ? tags : ''),
        importSource: 'api',
      },
      include: { category: true },
    });

    return withLegacyDeprecation(
      NextResponse.json({
        success: true,
        id: transaction.id,
        type: transaction.type,
        amount: transaction.amount,
        currency: transaction.currency,
        description: transaction.description,
        date: transaction.occurredOn.toISOString().split('T')[0],
        category: transaction.category ? {
          name: transaction.category.name,
          nameEs: transaction.category.nameEs,
          icon: transaction.category.icon,
        } : null,
      }),
      LEGACY_SUCCESSOR.transactions
    );
  } catch {
    return withLegacyDeprecation(
      NextResponse.json(
        { success: false, error: 'internal_error', message: 'Could not create the transaction' },
        { status: 500 }
      ),
      LEGACY_SUCCESSOR.transactions
    );
  }
}
