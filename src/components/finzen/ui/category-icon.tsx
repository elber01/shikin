'use client';

import { categoryColorSoft, categoryColorVar } from '@/lib/finzen/category-color';
import { cn } from '@/lib/utils';

export interface CategoryIconProps {
  /** Categoría (o `null` si no hay). El color es una clave de token `cat-N`. */
  category?: { icon?: string | null; color?: string | null } | null;
  /** `sm` = caja 32px (listas) · `md` = caja 40px (filas destacadas). */
  size?: 'sm' | 'md';
  /**
   * - `chip` (por defecto): caja con fondo tintado + icono.
   * - `bare`: solo el emoji, sin caja (listas compactas donde el color
   *   ya lo aporta otro elemento, p. ej. la barra de presupuesto).
   */
  variant?: 'chip' | 'bare';
  className?: string;
}

/**
 * Icono de categoría.
 *
 * El color NUNCA es un HEX: se resuelve al token `--cat-N` (light/dark) con
 * `categoryColorVar` / `categoryColorSoft` (convención 10-U1). Sin categoría,
 * el icono usa la superficie neutra.
 */
export function CategoryIcon({
  category,
  size = 'md',
  variant = 'chip',
  className,
}: CategoryIconProps) {
  if (variant === 'bare') {
    return (
      <span className={cn('text-base shrink-0', className)}>
        {category?.icon || '📦'}
      </span>
    );
  }

  const hasCategory = Boolean(category);
  return (
    <div
      className={cn(
        'flex items-center justify-center text-base shrink-0',
        size === 'sm' ? 'w-8 h-8 rounded-lg' : 'w-10 h-10 rounded-full',
        className
      )}
      style={{
        background: hasCategory ? categoryColorSoft(category?.color) : 'var(--surface-2)',
        color: hasCategory ? categoryColorVar(category?.color) : 'var(--muted-foreground)',
      }}
    >
      {category?.icon || '📦'}
    </div>
  );
}
