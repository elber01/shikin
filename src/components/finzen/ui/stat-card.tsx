'use client';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { STAT_SCALE, type StatScale } from '@/components/finzen/ui/stat-scale';

export type StatTone = 'default' | 'income' | 'expense' | 'warning' | 'primary';

export interface StatCardProps {
  label: string;
  value: string;
  tone?: StatTone;
  /** Texto auxiliar bajo el monto (p. ej. un porcentaje). */
  hint?: string;
  /** Escala responsive — define a la vez la fuente del monto y (en StatGrid) el breakpoint. */
  scale?: StatScale;
  className?: string;
  /** Ajuste fino de la etiqueta (p. ej. `uppercase tracking-wide`). */
  labelClassName?: string;
  /** Ajuste fino del monto (p. ej. `mt-1`). */
  valueClassName?: string;
}

const TONE_CLASS: Record<StatTone, string> = {
  default: '',
  income: 'text-income',
  expense: 'text-expense',
  warning: 'text-warning',
  primary: 'text-primary',
};

/**
 * Tarjeta de estadística. El monto SIEMPRE usa la escala de `STAT_SCALE`
 * (`tabular-nums` + `break-words`: el dinero se envuelve, nunca se trunca).
 */
export function StatCard({
  label,
  value,
  tone = 'default',
  hint,
  scale = 'md',
  className,
  labelClassName,
  valueClassName,
}: StatCardProps) {
  return (
    <Card className={cn('p-4', className)}>
      <div className={cn('text-xs text-muted-foreground', labelClassName)}>{label}</div>
      <div
        className={cn(
          'font-bold tabular-nums break-words',
          STAT_SCALE[scale].amount,
          TONE_CLASS[tone],
          valueClassName
        )}
      >
        {value}
      </div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}
