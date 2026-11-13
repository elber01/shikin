'use client';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CURRENCIES, type CurrencyCode } from '@/lib/finzen/currency';
import { cn } from '@/lib/utils';

export interface CurrencySelectProps {
  value: CurrencyCode;
  onChange: (currency: CurrencyCode) => void;
  /** Etiqueta del campo (si se omite, no se pinta etiqueta). */
  label?: string;
  /** Añade el nombre de la moneda a la opción (`USD — Dólar`). */
  showName?: boolean;
  disabled?: boolean;
  /** Clases del trigger (p. ej. `w-24 h-14` en el sheet de transacción). */
  className?: string;
}

/**
 * Selector de moneda del dominio.
 * El símbolo se pinta con el token de la moneda (`var(--info)`, `var(--btc)`…)
 * — nunca un color crudo.
 */
export function CurrencySelect({
  value,
  onChange,
  label,
  showName = false,
  disabled,
  className,
}: CurrencySelectProps) {
  const select = (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as CurrencyCode)}
      disabled={disabled}
    >
      <SelectTrigger className={cn('h-11', className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(CURRENCIES).map(([code, meta]) => (
          <SelectItem key={code} value={code}>
            <span className="flex items-center gap-2">
              <span style={{ color: meta.color }}>{meta.symbol}</span>
              {showName ? `${code} — ${meta.name}` : code}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (!label) return select;

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {select}
    </div>
  );
}
