import { describe, expect, it } from 'vitest';
import {
  CURRENCIES,
  FX_RATES,
  convertAmount,
  formatMoney,
} from '@/lib/finzen/currency';

/**
 * P1 — Monedas (convención 10-U0 §5.1).
 *
 * `convertAmount` usa tasas FIJAS (`FX_RATES`, relativas a USD) y
 * `formatMoney` formatea con `Intl` por locale, con signo y compacto.
 */
describe('convertAmount', () => {
  it('la identidad conserva el monto exacto', () => {
    expect(convertAmount(100, 'USD', 'USD')).toBe(100);
    expect(convertAmount(0, 'DOP', 'DOP')).toBe(0);
    expect(convertAmount(-42.5, 'EUR', 'EUR')).toBe(-42.5);
  });

  it('convierte con las tasas fijas (USD → DOP)', () => {
    expect(convertAmount(1, 'USD', 'DOP')).toBeCloseTo(FX_RATES.DOP, 10);
    expect(convertAmount(2, 'USD', 'DOP')).toBeCloseTo(FX_RATES.DOP * 2, 10);
  });

  it('convierte con las tasas fijas (DOP → USD)', () => {
    expect(convertAmount(6050, 'DOP', 'USD')).toBeCloseTo(100, 10);
  });

  it('ida y vuelta es la identidad (tolerance de coma flotante)', () => {
    const roundTrip = convertAmount(convertAmount(250, 'USD', 'DOP'), 'DOP', 'USD');
    expect(roundTrip).toBeCloseTo(250, 8);
  });

  it('USD y USDT tienen la misma tasa (paridad 1:1)', () => {
    expect(convertAmount(10, 'USDT', 'USD')).toBeCloseTo(10, 10);
  });
});

describe('formatMoney', () => {
  it('incluye el símbolo de la moneda por defecto', () => {
    expect(formatMoney(100, 'USD', 'en')).toBe('$100.00');
    expect(formatMoney(100, 'DOP', 'en')).toBe('RD$100.00');
  });

  it('un monto negativo lleva el signo delante', () => {
    expect(formatMoney(-100, 'USD', 'en')).toBe('-$100.00');
  });

  it('showSymbol: false omite el símbolo pero conserva el signo', () => {
    expect(formatMoney(100, 'USD', 'en', { showSymbol: false })).toBe('100.00');
    expect(formatMoney(-100, 'USD', 'en', { showSymbol: false })).toBe('-100.00');
  });

  it('respeta los decimales de cada moneda (BTC con 8)', () => {
    expect(formatMoney(1, 'BTC', 'en')).toBe('₿1.00000000');
  });

  it('el modo compacto abrevia los miles sin perder el símbolo', () => {
    const compact = formatMoney(1500, 'USD', 'en', { compact: true });
    expect(compact.startsWith('$')).toBe(true);
    expect(compact).not.toBe(formatMoney(1500, 'USD', 'en'));
    expect(compact).toMatch(/1[,.]5/);
  });

  it('el modo compacto NO se aplica por debajo de 1000', () => {
    expect(formatMoney(999, 'USD', 'en', { compact: true })).toBe(
      formatMoney(999, 'USD', 'en')
    );
  });

  it('todas las monedas tienen símbolo y color de token (sin HEX)', () => {
    for (const currency of Object.keys(CURRENCIES) as Array<keyof typeof CURRENCIES>) {
      expect(CURRENCIES[currency].symbol.length).toBeGreaterThan(0);
      expect(CURRENCIES[currency].color).toMatch(/^var\(--/);
    }
  });
});
