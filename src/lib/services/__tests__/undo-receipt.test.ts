import { describe, expect, it } from 'vitest';
import {
  issueUndoReceipt,
  stableStringify,
  verifyUndoReceipt,
} from '@/lib/services/undo-receipt';

/**
 * P0 — Recibo de undo (HMAC-SHA256).
 *
 * El recibo es la PRUEBA DE PROPIEDAD de una eliminación: liga usuario +
 * tipo + id + hash canónico del snapshot. Si el snapshot viene del cliente,
 * solo la firma garantiza que el servidor lo emitió.
 *
 * Estos tests NO tocan la BD (el módulo `undo-receipt` es puro: solo
 * `node:crypto`).
 */

/** Snapshot de ejemplo (los campos exactos no importan: el hash es canónico). */
const SNAPSHOT = {
  id: 'tx-1',
  type: 'expense',
  amount: 100,
  currency: 'DOP',
  fromAccountId: 'acc-1',
  toAccountId: 'x_cat-1',
  categoryId: 'cat-1',
  description: 'Cena',
  occurredOn: '2026-11-15T10:00:00.000Z',
  tags: 'manual',
  importSource: null,
};

describe('stableStringify', () => {
  it('es determinista: el orden de las claves no importa', () => {
    const a = stableStringify({ b: 1, a: 2, c: { z: 1, y: 2 } });
    const b = stableStringify({ c: { y: 2, z: 1 }, a: 2, b: 1 });
    expect(a).toBe(b);
  });

  it('CONSERVA el orden de los arrays', () => {
    expect(stableStringify([3, 1, 2])).toBe(stableStringify([3, 1, 2]));
    expect(stableStringify([1, 2, 3])).not.toBe(stableStringify([3, 2, 1]));
  });

  it('descarta las claves con valor undefined', () => {
    expect(stableStringify({ a: 1, b: undefined })).toBe('{"a":1}');
    expect(stableStringify({ b: undefined, a: 1 })).toBe('{"a":1}');
  });

  it('ordena las claves anidadas recursivamente', () => {
    expect(stableStringify({ x: { b: 1, a: 2 } })).toBe('{"x":{"a":2,"b":1}}');
  });

  it('lanza si el valor no es serializable', () => {
    expect(() => stableStringify(undefined)).toThrow(TypeError);
  });
});

describe('issueUndoReceipt / verifyUndoReceipt', () => {
  it('emite un recibo que verifica con el MISMO snapshot', () => {
    const receipt = issueUndoReceipt('user-1', 'transaction', 'tx-1', SNAPSHOT);
    expect(verifyUndoReceipt('user-1', 'transaction', 'tx-1', SNAPSHOT, receipt)).toBe(true);
  });

  it('rechaza un snapshot ALTERADO', () => {
    const receipt = issueUndoReceipt('user-1', 'transaction', 'tx-1', SNAPSHOT);
    const altered = { ...SNAPSHOT, amount: 999999 };
    expect(verifyUndoReceipt('user-1', 'transaction', 'tx-1', altered, receipt)).toBe(false);
  });

  it('rechaza un userId DISTINTO', () => {
    const receipt = issueUndoReceipt('user-1', 'transaction', 'tx-1', SNAPSHOT);
    expect(verifyUndoReceipt('user-2', 'transaction', 'tx-1', SNAPSHOT, receipt)).toBe(false);
  });

  it('rechaza un kind DISTINTO', () => {
    const receipt = issueUndoReceipt('user-1', 'transaction', 'tx-1', SNAPSHOT);
    expect(verifyUndoReceipt('user-1', 'account', 'tx-1', SNAPSHOT, receipt)).toBe(false);
  });

  it('rechaza un id DISTINTO', () => {
    const receipt = issueUndoReceipt('user-1', 'transaction', 'tx-1', SNAPSHOT);
    expect(verifyUndoReceipt('user-1', 'transaction', 'tx-2', SNAPSHOT, receipt)).toBe(false);
  });

  it('rechaza un recibo manipulado (firma corrupta)', () => {
    const receipt = issueUndoReceipt('user-1', 'transaction', 'tx-1', SNAPSHOT);
    const [payload, signature] = receipt.split('.');
    const tampered = `${payload}.${signature.slice(0, -2)}AA`;
    expect(verifyUndoReceipt('user-1', 'transaction', 'tx-1', SNAPSHOT, tampered)).toBe(false);
  });

  it('rechaza un recibo malformado', () => {
    expect(verifyUndoReceipt('user-1', 'transaction', 'tx-1', SNAPSHOT, '')).toBe(false);
    expect(verifyUndoReceipt('user-1', 'transaction', 'tx-1', SNAPSHOT, 'sin-punto')).toBe(false);
    expect(
      verifyUndoReceipt('user-1', 'transaction', 'tx-1', SNAPSHOT, 'a.b.c')
    ).toBe(false);
    expect(
      verifyUndoReceipt('user-1', 'transaction', 'tx-1', SNAPSHOT, '!!!.???')
    ).toBe(false);
  });

  it('un snapshot equivalente con distinto orden de claves sigue verificando', () => {
    const receipt = issueUndoReceipt('user-1', 'transaction', 'tx-1', SNAPSHOT);
    const reordered = Object.fromEntries(Object.entries(SNAPSHOT).reverse());
    expect(verifyUndoReceipt('user-1', 'transaction', 'tx-1', reordered, receipt)).toBe(true);
  });

  it('sin NEXTAUTH_SECRET falla de forma explícita (nunca una clave débil)', () => {
    const previous = process.env.NEXTAUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    try {
      expect(() => issueUndoReceipt('user-1', 'transaction', 'tx-1', SNAPSHOT)).toThrow(
        /NEXTAUTH_SECRET/
      );
      expect(() =>
        verifyUndoReceipt('user-1', 'transaction', 'tx-1', SNAPSHOT, 'a.b')
      ).toThrow(/NEXTAUTH_SECRET/);
    } finally {
      if (previous !== undefined) process.env.NEXTAUTH_SECRET = previous;
    }
  });
});
