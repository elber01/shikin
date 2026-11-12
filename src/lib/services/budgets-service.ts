/**
 * Budgets service — business rules for budget lines.
 *
 * The internal UI needs to add a line to a budget that ALREADY exists
 * (`POST /api/budgets/:budgetId/items`). That mutation used to live nowhere:
 * the store faked it with a temporary id and the line vanished on reload.
 * The rules live here so the route handler stays a thin adapter.
 */

import { db } from '@/lib/db';

export type BudgetItemErrorCode = 'not_found' | 'invalid_category' | 'invalid_amount';

export interface BudgetItemCategory {
  id: string;
  name: string;
  nameEs: string | null;
  nameEn: string | null;
  icon: string | null;
  color: string | null;
  direction: string;
  isSystem: boolean;
  sortOrder: number;
}

/** Misma forma que devuelve `GET /api/budgets` (items con su categoría). */
export interface BudgetItemPublic {
  id: string;
  budgetId: string;
  categoryId: string;
  plannedAmount: number;
  alertThresholdPct: number;
  category: BudgetItemCategory | null;
}

export type AddBudgetItemResult =
  | { ok: true; item: BudgetItemPublic }
  | { ok: false; code: BudgetItemErrorCode; message: string };

export interface AddBudgetItemInput {
  categoryId: string;
  plannedAmount: number;
  alertThresholdPct?: number;
}

export async function addBudgetItemForUser(
  userId: string,
  budgetId: string,
  item: AddBudgetItemInput
): Promise<AddBudgetItemResult> {
  // 1. Ownership — the budget must belong to the user (404 otherwise).
  const budget = await db.budget.findFirst({
    where: { id: budgetId, userId },
    select: { id: true },
  });
  if (!budget) {
    return {
      ok: false,
      code: 'not_found',
      message: 'Budget not found or not owned by your user',
    };
  }

  // 2. Category — must exist and be either the user's own or a system one.
  const category = await db.category.findFirst({
    where: {
      id: item.categoryId,
      OR: [{ userId: userId }, { isSystem: true }],
    },
  });
  if (!category) {
    return {
      ok: false,
      code: 'invalid_category',
      message: 'Category not found or not available for this user',
    };
  }

  // 3. Amount — finite and not negative.
  const plannedAmount = Number(item.plannedAmount);
  if (!Number.isFinite(plannedAmount) || plannedAmount < 0) {
    return {
      ok: false,
      code: 'invalid_amount',
      message: 'plannedAmount must be a finite number greater than or equal to 0',
    };
  }

  // 4. Threshold — clamped to 1..100 (default 80, same as the PATCH route).
  const threshold = Math.min(
    100,
    Math.max(1, Math.round(Number(item.alertThresholdPct ?? 80)) || 80)
  );

  const created = await db.budgetItem.create({
    data: {
      budgetId: budget.id,
      categoryId: category.id,
      plannedAmount,
      alertThresholdPct: threshold,
    },
    include: { category: true },
  });

  return {
    ok: true,
    item: {
      id: created.id,
      budgetId: created.budgetId,
      categoryId: created.categoryId,
      plannedAmount: created.plannedAmount,
      alertThresholdPct: created.alertThresholdPct,
      category: {
        id: created.category.id,
        name: created.category.name,
        nameEs: created.category.nameEs,
        nameEn: created.category.nameEn,
        icon: created.category.icon,
        color: created.category.color,
        direction: created.category.direction,
        isSystem: created.category.isSystem,
        sortOrder: created.category.sortOrder,
      },
    },
  };
}
