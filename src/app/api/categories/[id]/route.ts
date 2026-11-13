import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import {
  deleteCategoryForUser,
  updateCategoryForUser,
  type CategoryInput,
} from '@/lib/services/categories-service';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Lee el body y lo reduce a los campos tipados del servicio.
 *
 * `color` distingue TRES estados (la REGLA es del servicio, no del adaptador):
 * - ausente → `undefined` → el servicio conserva el color actual
 * - `null` / `''` → resetear al fallback (`cat-12`)
 * - valor → normalizar a token
 *
 * Por eso `color` solo se incluye cuando la clave venía en el body: el
 * adaptador traduce "ausente", pero no decide qué hacer con el color.
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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Thin adapter — every rule (incl. color normalization) lives in the service.
  const result = await updateCategoryForUser(
    session.user.id,
    id,
    await readCategoryInput(req)
  );

  if (!result.ok) {
    return NextResponse.json(
      { error: result.message, code: result.code },
      { status: result.code === 'not_found' ? 404 : 400 }
    );
  }

  return NextResponse.json(result.category);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  // Thin adapter — ownership + referential integrity live in the service.
  const result = await deleteCategoryForUser(session.user.id, id);

  if (!result.ok) {
    const status =
      result.code === 'not_found'
        ? 404
        : result.code === 'system_category_not_deletable'
          ? 403
          : 409;
    return NextResponse.json(
      { error: result.message, code: result.code, transactionCount: result.transactionCount },
      { status }
    );
  }

  return NextResponse.json({ success: true });
}
