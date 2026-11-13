'use client';

import type { MouseEvent, ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export interface ConfirmDeleteProps {
  /** Elemento que abre el diálogo (normalmente un `IconButton`). */
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Si devuelve una Promise, el diálogo espera a que termine antes de cerrar. */
  onConfirm: () => void | Promise<void>;
  /** Estado en curso: deshabilita confirmar/cancelar. */
  pending?: boolean;
  /** Acción bloqueada (p. ej. una categoría con historial). */
  disabled?: boolean;
}

function isThenable(value: void | Promise<void>): value is Promise<void> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Promise<void>).then === 'function'
  );
}

/**
 * Confirmación de borrado (destructiva).
 *
 * Envuelve `ui/alert-dialog` y normaliza la acción: `bg-expense
 * text-primary-foreground`. Si `onConfirm` es asíncrono, el diálogo NO se cierra
 * hasta que la promesa se resuelve (evita el doble clic y deja ver el error).
 */
export function ConfirmDelete({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  pending = false,
  disabled = false,
}: ConfirmDeleteProps) {
  function handleConfirm(event: MouseEvent<HTMLButtonElement>) {
    const result = onConfirm();
    if (isThenable(result)) {
      // La operación sigue viva: el diálogo permanece abierto.
      event.preventDefault();
      void result.catch(() => undefined);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-expense text-primary-foreground hover:bg-expense/90"
            disabled={pending || disabled}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
