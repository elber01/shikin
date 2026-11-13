/**
 * Categories service — business rules for category CRUD.
 *
 * The internal UI routes (`/api/categories`, `/api/categories/[id]`) are thin
 * adapters over this service (see `agent.md` §2). The rules that matter:
 *
 * 1. **Ownership** — a category can only be read/modified/deleted by the user
 *    that owns it. System categories (`userId = null`) are visible but not
 *    editable through these routes.
 * 2. **Color as a token (10-U1)** — `Category.color` stores a KEY
 *    (`cat-1`..`cat-12`), never a HEX. Whatever arrives (a token key, a legacy
 *    HEX, an empty string or garbage) is normalized by
 *    `normalizeCategoryColor` before it reaches the database, so the render
 *    layer can always paint `var(--cat-N)`.
 * 3. **Integrity** — a category with transactions or budget items cannot be
 *    deleted; the client must reassign them first (409).
 *
 * The public API v1 (`/api/v1/*`) is NOT part of this service: the color is
 * not part of the v1 contract and the v1 auto-creation leaves `color = null`
 * (the view resolves the `cat-12` fallback).
 */

import type { Category } from '@prisma/client';
import { db } from '@/lib/db';
import { normalizeCategoryColor } from '@/lib/finzen/category-color';

export type CategoryErrorCode =
  | 'name_required'
  | 'not_found'
  | 'system_category_not_deletable'
  | 'category_has_transactions'
  | 'category_in_budget';

export type CategoryMutationResult =
  | { ok: true; category: Category }
  | { ok: false; code: CategoryErrorCode; message: string };

export type CategoryDeleteResult =
  | { ok: true; id: string }
  | {
      ok: false;
      code: CategoryErrorCode;
      message: string;
      transactionCount?: number;
    };

/** Payload accepted by the create/update mutations (already shape-checked). */
export interface CategoryInput {
  name?: string | null;
  nameEs?: string | null;
  nameEn?: string | null;
  icon?: string | null;
  /**
   * Color de la categoría. TRES estados, y la REGLA es del servicio:
   * - `undefined` → el campo NO viene en el body → **conservar** el actual.
   * - `null` o `''` → resetear al fallback (`cat-12`).
   * - cualquier otro valor → normalizar a clave de token (`cat-N`).
   *
   * El adaptador solo traduce "ausente" a `undefined`; nunca decide la regla.
   */
  color?: string | null;
  direction?: string | null;
}

/**
 * Normaliza el color de una categoría a una clave de token.
 * - `undefined` (ausente en el body) → conserva el valor actual, normalizado.
 * - `null` / `''` / basura → fallback `cat-12` (reset explícito).
 * - clave o HEX → token equivalente.
 *
 * Esta función es la ÚNICA fuente de la regla "preservar si no viene".
 */
function resolveColor(
  incoming: string | null | undefined,
  current: string | null | undefined
): string {
  if (incoming === undefined) return normalizeCategoryColor(current);
  return normalizeCategoryColor(incoming);
}

/**
 * Creates a category owned by `userId`.
 * The color is normalized to a token key (absent → `cat-12`).
 */
export async function createCategoryForUser(
  userId: string,
  payload: CategoryInput
): Promise<CategoryMutationResult> {
  const name = payload.name ?? '';
  if (!name) {
    return { ok: false, code: 'name_required', message: 'Name is required' };
  }

  // Get max sortOrder for this user
  const maxSort = await db.category.aggregate({
    where: { userId },
    _max: { sortOrder: true },
  });

  const category = await db.category.create({
    data: {
      userId,
      name,
      nameEs: payload.nameEs || name,
      nameEn: payload.nameEn || name,
      icon: payload.icon || '📦',
      color: resolveColor(payload.color, null),
      direction: payload.direction || 'expense',
      isSystem: false,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
  });

  return { ok: true, category };
}

/**
 * Updates a category owned by `userId`.
 * Ownership is verified first (404 otherwise); the color is normalized to a
 * token key on every write so the database never keeps a raw HEX.
 */
export async function updateCategoryForUser(
  userId: string,
  id: string,
  payload: CategoryInput
): Promise<CategoryMutationResult> {
  // Verify ownership
  const existing = await db.category.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    return { ok: false, code: 'not_found', message: 'Not found' };
  }

  const updated = await db.category.update({
    where: { id },
    data: {
      name: payload.name ?? existing.name,
      nameEs: payload.nameEs ?? existing.nameEs,
      nameEn: payload.nameEn ?? existing.nameEn,
      icon: payload.icon ?? existing.icon,
      color: resolveColor(payload.color, existing.color),
      direction: payload.direction ?? existing.direction,
    },
  });

  return { ok: true, category: updated };
}

/**
 * Deletes a category owned by `userId`.
 * Refuses to delete system categories (403) or categories still referenced by
 * transactions (409) or budget items (409) — the references must be
 * reassigned first so no double-entry history is orphaned.
 */
export async function deleteCategoryForUser(
  userId: string,
  id: string
): Promise<CategoryDeleteResult> {
  // Verify ownership
  const existing = await db.category.findFirst({
    where: { id, userId },
  });

  if (!existing) {
    return { ok: false, code: 'not_found', message: 'Not found' };
  }

  // System categories cannot be deleted
  if (existing.isSystem) {
    return {
      ok: false,
      code: 'system_category_not_deletable',
      message: 'System categories cannot be deleted',
    };
  }

  // Check if category has transactions
  const txCount = await db.transaction.count({
    where: { categoryId: id, userId },
  });

  if (txCount > 0) {
    return {
      ok: false,
      code: 'category_has_transactions',
      message: `Cannot delete: ${txCount} transactions use this category. Reassign them first.`,
      transactionCount: txCount,
    };
  }

  // Check budget items
  const budgetItemCount = await db.budgetItem.count({
    where: { categoryId: id },
  });

  if (budgetItemCount > 0) {
    return {
      ok: false,
      code: 'category_in_budget',
      message: `Cannot delete: ${budgetItemCount} budget items use this category. Remove them first.`,
      transactionCount: budgetItemCount,
    };
  }

  await db.category.delete({ where: { id } });

  return { ok: true, id };
}
