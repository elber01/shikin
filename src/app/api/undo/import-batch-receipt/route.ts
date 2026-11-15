import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { issueImportBatchUndoReceiptForUser } from '@/lib/services/undo-service';

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

  const result = await issueImportBatchUndoReceiptForUser(session.user.id, body);
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.code, message: result.message },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    undoReceipt: result.receipt,
    snapshot: result.snapshot,
  });
}
