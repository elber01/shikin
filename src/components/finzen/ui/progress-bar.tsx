'use client';

import { cn } from '@/lib/utils';

export interface ProgressBarProps {
  /** Porcentaje 0..100. */
  value: number;
  /**
   * - `auto`: income < 80 · warning ≥ 80 · expense > 100
   * - `income` | `expense` | `warning` | `primary`: tono fijo
   * - cualquier otro string: valor CSS directo (p. ej. `var(--cat-3)`)
   */
  tone?: 'auto' | 'income' | 'expense' | 'warning' | 'primary' | string;
  /** `sm` = `h-2` · `md` = `h-3`. */
  size?: 'sm' | 'md';
  /** Etiqueta accesible del medidor. */
  label?: string;
  /** Anima el ancho al cambiar de valor (`true` por defecto). */
  animated?: boolean;
  className?: string;
}

const TONE_VAR: Record<string, string> = {
  income: 'var(--income)',
  expense: 'var(--expense)',
  warning: 'var(--warning)',
  primary: 'var(--primary)',
};

/** Resuelve el color de fondo según el tono pedido. */
function resolveTone(tone: string, value: number): string {
  if (tone === 'auto') {
    if (value > 100) return TONE_VAR.expense;
    if (value >= 80) return TONE_VAR.warning;
    return TONE_VAR.income;
  }
  return TONE_VAR[tone] ?? tone;
}

/**
 * Barra de progreso con tono semántico.
 * El ancho se limita al 100% — el exceso se lee como sobrepaso, no como barra.
 */
export function ProgressBar({
  value,
  tone = 'auto',
  size = 'sm',
  label,
  animated = true,
  className,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn(
        'rounded-full bg-surface-2 overflow-hidden',
        size === 'md' ? 'h-3' : 'h-2',
        className
      )}
    >
      <div
        className={cn('h-full rounded-full', animated && 'transition-all')}
        style={{ width: `${clamped}%`, background: resolveTone(tone, value) }}
      />
    </div>
  );
}
