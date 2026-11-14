'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

/**
 * Transición suave entre vistas del shell. Usar con `key={view}` en el padre
 * para que el remount dispare la animación de entrada.
 *
 * [10-U2] Si el sistema pide menos movimiento (`prefers-reduced-motion`), la
 * vista entra sin desplazamiento y sin duración.
 */
export function ViewTransition({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion() === true;

  return (
    <motion.div
      initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduceMotion ? 0 : 0.2,
        ease: [0.25, 0.1, 0.25, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
