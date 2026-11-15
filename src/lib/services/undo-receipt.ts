import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { UndoKind } from '@/lib/finzen/undo';

const RECEIPT_DOMAIN = 'shikin:undo:v1';

interface UndoReceiptPayload {
  u: string;
  k: UndoKind;
  i: string;
  h: string;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }

  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0
      );
    return Object.fromEntries(
      entries.map(([key, item]) => [key, canonicalize(item)])
    );
  }

  return value;
}

/** Serializa un snapshot de forma estable para que el hash no dependa del orden de claves. */
export function stableStringify(value: unknown): string {
  const serialized = JSON.stringify(canonicalize(value));
  if (serialized === undefined) {
    throw new TypeError('The undo snapshot cannot be serialized');
  }
  return serialized;
}

function getSigningKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || secret.trim().length === 0) {
    throw new Error(
      '[finzen] NEXTAUTH_SECRET is required to issue or verify undo receipts.'
    );
  }

  return createHmac('sha256', secret).update(RECEIPT_DOMAIN).digest();
}

function hashSnapshot(snapshot: unknown): string {
  return createHash('sha256').update(stableStringify(snapshot)).digest('hex');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUndoKind(value: unknown): value is UndoKind {
  return (
    value === 'transaction' ||
    value === 'account' ||
    value === 'category' ||
    value === 'budget_item' ||
    value === 'import_batch'
  );
}

/**
 * Emite una prueba de propiedad para una eliminación realizada por el servidor.
 * El recibo liga usuario, tipo, id y hash canónico del snapshot.
 */
export function issueUndoReceipt(
  userId: string,
  kind: UndoKind,
  id: string,
  snapshot: unknown
): string {
  const payload: UndoReceiptPayload = {
    u: userId,
    k: kind,
    i: id,
    h: hashSnapshot(snapshot),
  };
  const payloadJson = JSON.stringify(payload);
  const signature = createHmac('sha256', getSigningKey())
    .update(payloadJson)
    .digest('base64url');

  return `${Buffer.from(payloadJson, 'utf8').toString('base64url')}.${signature}`;
}

/** Verifica la prueba de propiedad sin escribir nada en la base de datos. */
export function verifyUndoReceipt(
  userId: string,
  kind: UndoKind,
  id: string,
  snapshot: unknown,
  receipt: string
): boolean {
  const parts = receipt.split('.');
  if (parts.length !== 2) return false;

  const [encodedPayload, encodedSignature] = parts;
  if (!encodedPayload || !encodedSignature) return false;

  let payloadJson: string;
  let signature: Buffer;
  try {
    payloadJson = Buffer.from(encodedPayload, 'base64url').toString('utf8');
    signature = Buffer.from(encodedSignature, 'base64url');
  } catch {
    return false;
  }

  const expectedSignature = createHmac('sha256', getSigningKey())
    .update(payloadJson)
    .digest();
  if (
    signature.length !== expectedSignature.length ||
    !timingSafeEqual(signature, expectedSignature)
  ) {
    return false;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(payloadJson);
  } catch {
    return false;
  }

  if (!isRecord(payload)) return false;
  if (
    payload.u !== userId ||
    payload.k !== kind ||
    payload.i !== id ||
    !isUndoKind(payload.k) ||
    typeof payload.h !== 'string'
  ) {
    return false;
  }

  try {
    return payload.h === hashSnapshot(snapshot);
  } catch {
    return false;
  }
}
