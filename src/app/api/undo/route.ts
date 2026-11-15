import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { undoForUser } from '@/lib/services/undo-service';
import type { UndoErrorCode } from '@/lib/finzen/undo';

const ERROR_STATUS: Record<UndoErrorCode, number> = {
  unauthorized: 401,
  invalid_undo_payload: 400,
  not_found: 404,
  invalid_transaction: 422,
  invalid_account: 422,
  invalid_category: 422,
  invalid_budget_item: 422,
  undo_batch_too_large: 422,
  undo_conflict: 409,
  undo_dependency_missing: 409,
  undo_batch_conflict: 409,
  undo_failed: 500,
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'unauthorized', message: 'A session is required' },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'invalid_undo_payload', message: 'The request body is not valid JSON' },
      { status: 400 }
    );
  }

  const result = await undoForUser(session.user.id, body);
  if (result.success) {
    return NextResponse.json(result, { status: 200 });
  }

  return NextResponse.json(result, { status: ERROR_STATUS[result.error] });
}
