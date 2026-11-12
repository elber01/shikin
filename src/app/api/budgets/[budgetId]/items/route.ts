import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { addBudgetItemForUser } from '@/lib/services/budgets-service';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// POST /api/budgets/[budgetId]/items — add a budget line to an existing budget.
// Thin adapter: every rule lives in budgets-service.ts.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ budgetId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { budgetId } = await params;

  let raw: unknown = {};
  try {
    raw = await req.json();
  } catch {
    raw = {};
  }
  const body = isRecord(raw) ? raw : {};

  const result = await addBudgetItemForUser(session.user.id, budgetId, {
    categoryId: typeof body.categoryId === 'string' ? body.categoryId : '',
    plannedAmount: Number(body.plannedAmount),
    alertThresholdPct:
      body.alertThresholdPct !== undefined ? Number(body.alertThresholdPct) : undefined,
  });

  if (!result.ok) {
    const status = result.code === 'not_found' ? 404 : 422;
    return NextResponse.json(
      { error: result.code, message: result.message },
      { status }
    );
  }

  return NextResponse.json(result.item, { status: 201 });
}
