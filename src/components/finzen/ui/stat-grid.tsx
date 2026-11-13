'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { STAT_SCALE, type StatScale } from '@/components/finzen/ui/stat-scale';

export interface StatGridProps {
  /** Escala responsive — el breakpoint del grid sale de aquí (nunca a mano). */
  scale?: StatScale;
  /** 2 columnas fijas (p. ej. cuentas) o las 3 que dicta la escala. */
  columns?: 2 | 3;
  children: ReactNode;
  className?: string;
}

/**
 * Grid de estadísticas responsive.
 *
 * `*:min-w-0` es obligatorio: sin él, el contenido ancho (montos largos) impide
 * que la columna encoja y desborda la tarjeta.
 */
export function StatGrid({ scale = 'md', columns = 3, children, className }: StatGridProps) {
  const gridCols = columns === 2 ? 'md:grid-cols-2' : STAT_SCALE[scale].grid;
  return (
    <div className={cn('grid grid-cols-1 gap-4 *:min-w-0', gridCols, className)}>
      {children}
    </div>
  );
}
