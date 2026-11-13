import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { db } from '@/lib/db';
import { createCategoryForUser, type CategoryInput } from '@/lib/services/categories-service';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Lee el body y lo reduce a los campos tipados del servicio.
 *
 * `color` distingue TRES estados (la REGLA es del servicio, no del adaptador):
 * - ausente → `undefined`
 * - `null` / `''` → resetear al fallback (`cat-12`)
 * - valor → normalizar a token
 *
 * En POST, "ausente" y "null" dan el mismo resultado (`cat-12`), pero el
 * contrato se mantiene igual que en PATCH para no divergir.
 */
async function readCategoryInput(req: Request): Promise<CategoryInput> {
  let raw: unknown = {};
  try {
    raw = await req.json();
  } catch {
    raw = {};
  }
  const body = isRecord(raw) ? raw : {};
  const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
  return {
    name: str(body.name),
    nameEs: str(body.nameEs),
    nameEn: str(body.nameEn),
    icon: str(body.icon),
    direction: str(body.direction),
    ...('color' in body ? { color: str(body.color) } : {}),
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401 });
  }

  const categories = await db.category.findMany({
    where: {
      OR: [
        { userId: session.user.id },
        { userId: null },
      ],
    },
    orderBy: { sortOrder: 'asc' },
  });

  return NextResponse.json(categories);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401 });
  }

  // Thin adapter — every rule (incl. color normalization) lives in the service.
  const result = await createCategoryForUser(session.user.id, await readCategoryInput(req));

  if (!result.ok) {
    return NextResponse.json(
      { error: result.message, code: result.code },
      { status: result.code === 'name_required' ? 400 : 500 }
    );
  }

  return NextResponse.json(result.category);
}
