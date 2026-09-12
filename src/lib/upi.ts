/**
 * UPI deep-link helpers.
 *
 * IMPORTANT: a `upi://` intent hands off to the user's payment app and returns
 * nothing. There is no callback, no status, no way for a web app to verify that
 * money actually moved. Everything here only *pre-fills* a payment — the
 * settlement record that follows is still the user's word, exactly as it was
 * when they typed it in manually. Never present an opened intent as proof.
 */

/**
 * A UPI ID (VPA) is `handle@provider`. The local part allows alphanumerics plus
 * `. - _`; the provider is alphabetic. Deliberately permissive about provider
 * names — new PSPs appear regularly and a strict allow-list would reject valid IDs.
 */
const VPA_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9.\-_]{1,255}@[a-zA-Z]{2,64}$/;

/** UPI settles in INR only, so the feature is offered only to INR groups. */
export const UPI_CURRENCY = 'INR';

export function isValidUpiId(value: string): boolean {
  return VPA_PATTERN.test(value.trim());
}

export function normalizeUpiId(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * True when the platform can actually hand off to a payment app. Desktop
 * browsers can't — callers should fall back to showing the ID for copying.
 */
export function isUpiIntentSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent);
}

interface UpiIntentParams {
  payeeUpiId: string;
  payeeName: string;
  amount: number;
  note?: string;
}

/**
 * Builds a `upi://pay` URL. Returns null when the inputs can't produce a
 * payment worth opening — an invalid VPA or a non-positive amount.
 */
export function buildUpiIntentUrl({ payeeUpiId, payeeName, amount, note }: UpiIntentParams): string | null {
  if (!isValidUpiId(payeeUpiId)) return null;
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const params = new URLSearchParams({
    pa: normalizeUpiId(payeeUpiId),
    pn: payeeName.trim() || 'bantLo user',
    am: amount.toFixed(2),
    cu: UPI_CURRENCY,
  });

  if (note) params.set('tn', note.slice(0, 50));

  // URLSearchParams encodes spaces as "+", which some UPI apps mis-parse in the
  // payee-name and note fields. %20 is understood universally.
  return `upi://pay?${params.toString().replace(/\+/g, '%20')}`;
}
