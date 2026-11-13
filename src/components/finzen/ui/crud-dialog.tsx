'use client';

import type { FormEvent, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export interface CrudDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  /**
   * Etiqueta del botón de guardado a ancho completo.
   * Si se omite (o si `onSubmit` no se pasa), el diálogo no renderiza
   * formulario ni botón — modo asistente (wizard) de varios pasos.
   */
  submitLabel?: string;
  onSubmit?: (event: FormEvent) => void;
  /** Deshabilita el botón de guardado (p. ej. faltan columnas mapeadas). */
  submitDisabled?: boolean;
  /** Ancho del diálogo. */
  maxWidth?: 'sm' | 'md' | 'lg';
  /** Clases extra del contenedor (p. ej. `max-h-[90vh] overflow-y-auto scroll-area`). */
  contentClassName?: string;
}

const MAX_WIDTH: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
};

/**
 * Diálogo CRUD del dominio: título + formulario + acción de guardar.
 * Envuelve `ui/dialog` para que las 7 pantallas que lo usan compartan la
 * misma anatomía (título, formulario, botón de guardado a ancho completo).
 *
 * Los asistentes multi-paso (importación CSV/OCR/banco) pasan el contenido
 * sin `onSubmit`: entonces no hay `<form>` ni botón de guardado, y cada paso
 * conserva sus propias acciones.
 */
export function CrudDialog({
  open,
  onOpenChange,
  title,
  children,
  submitLabel,
  onSubmit,
  submitDisabled = false,
  maxWidth = 'sm',
  contentClassName,
}: CrudDialogProps) {
  const body = (
    <>
      {children}
      {submitLabel && (
        <Button type="submit" className="w-full h-11" disabled={submitDisabled}>
          {submitLabel}
        </Button>
      )}
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(MAX_WIDTH[maxWidth], contentClassName)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {onSubmit ? (
          <form onSubmit={onSubmit} className="space-y-4 mt-2">
            {body}
          </form>
        ) : (
          body
        )}
      </DialogContent>
    </Dialog>
  );
}
