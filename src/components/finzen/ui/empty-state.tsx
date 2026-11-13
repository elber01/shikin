'use client';

import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'outline';
  /** Deshabilita la acción (p. ej. no hay categorías disponibles). */
  disabled?: boolean;
  /** Icono dentro del botón (ya con su margen, p. ej. `<Plus className="w-4 h-4 mr-1" />`). */
  icon?: ReactNode;
}

export interface EmptyStateProps {
  /** Contenido del icono (la caja con su fondo la aporta quien llama). */
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Acción principal. */
  action?: EmptyStateAction;
  /** Acción secundaria (CTA alterno). */
  secondaryAction?: EmptyStateAction;
  /** `card` (por defecto) o `plain` (div sin borde — dentro de otra Card). */
  surface?: 'card' | 'plain';
  /** Nivel del título — `h3` por defecto; `p` para textos planos. */
  titleAs?: 'h2' | 'h3' | 'p';
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
}

/**
 * Estado vacío honesto: qué falta + por qué + UNA acción clara.
 * Sin datos decorativos falsos (AGENTS.md §5).
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  surface = 'card',
  titleAs = 'h3',
  className,
  titleClassName,
  descriptionClassName,
}: EmptyStateProps) {
  const Title = titleAs;
  const body = (
    <>
      {icon}
      <Title className={cn('text-lg font-semibold mb-1', titleClassName)}>{title}</Title>
      {description && (
        <p
          className={cn(
            'text-sm text-muted-foreground mb-4 max-w-xs mx-auto',
            descriptionClassName
          )}
        >
          {description}
        </p>
      )}
      {action && secondaryAction && (
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button
            size="sm"
            className="h-11 min-h-11"
            variant={action.variant}
            disabled={action.disabled}
            onClick={action.onClick}
          >
            {action.icon}
            {action.label}
          </Button>
          <Button
            size="sm"
            className="h-11 min-h-11"
            variant={secondaryAction.variant ?? 'outline'}
            disabled={secondaryAction.disabled}
            onClick={secondaryAction.onClick}
          >
            {secondaryAction.icon}
            {secondaryAction.label}
          </Button>
        </div>
      )}
      {action && !secondaryAction && (
        <Button
          size="sm"
          className="h-11 min-h-11"
          variant={action.variant}
          disabled={action.disabled}
          onClick={action.onClick}
        >
          {action.icon}
          {action.label}
        </Button>
      )}
    </>
  );

  if (surface === 'plain') {
    return <div className={className}>{body}</div>;
  }

  return <Card className={cn('p-8 text-center', className)}>{body}</Card>;
}
