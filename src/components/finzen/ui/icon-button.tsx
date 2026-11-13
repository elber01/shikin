'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface IconButtonProps {
  /** Contenido del botón (normalmente un icono de lucide). */
  icon: ReactNode;
  /** Etiqueta accesible — OBLIGATORIA en todo botón de icono (AGENTS.md §5). */
  label: string;
  /** Tooltip nativo (opcional; `label` sigue siendo la fuente de accesibilidad). */
  title?: string;
  onClick?: () => void;
  /** `default` = neutro (editar/alternar) · `danger` = destructivo (borrar). */
  variant?: 'default' | 'danger';
  /** `sm` = `p-1.5` · `md` = `p-2`. */
  size?: 'sm' | 'md';
  type?: 'button' | 'submit';
  className?: string;
  disabled?: boolean;
}

/**
 * Botón de icono normalizado.
 *
 * - target táctil ≥ 40×40 (`min-w-[40px] min-h-[40px]`)
 * - `aria-label` siempre presente
 * - variantes de color y tamaño centralizadas
 */
export function IconButton({
  icon,
  label,
  title,
  onClick,
  variant = 'default',
  size = 'md',
  type = 'button',
  className,
  disabled,
}: IconButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={title}
      className={cn(
        'rounded-md min-w-[40px] min-h-[40px] flex items-center justify-center transition-colors',
        size === 'sm' ? 'p-1.5' : 'p-2',
        variant === 'danger'
          ? 'hover:bg-expense-soft text-muted-foreground hover:text-expense'
          : 'hover:bg-surface-2 text-muted-foreground hover:text-foreground',
        className
      )}
    >
      {icon}
    </button>
  );
}
