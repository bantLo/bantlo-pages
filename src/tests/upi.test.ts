import { describe, it, expect } from 'vitest';
import { isValidUpiId, normalizeUpiId, buildUpiIntentUrl } from '../lib/upi';

describe('isValidUpiId', () => {
  it('accepts common VPA shapes', () => {
    expect(isValidUpiId('harshit@okhdfcbank')).toBe(true);
    expect(isValidUpiId('harshit.jain@ybl')).toBe(true);
    expect(isValidUpiId('harshit-jain_1@paytm')).toBe(true);
    expect(isValidUpiId('9876543210@upi')).toBe(true);
  });

  it('tolerates surrounding whitespace', () => {
    expect(isValidUpiId('  harshit@ybl  ')).toBe(true);
  });

  it('rejects malformed input', () => {
    expect(isValidUpiId('')).toBe(false);
    expect(isValidUpiId('harshit')).toBe(false);
    expect(isValidUpiId('@ybl')).toBe(false);
    expect(isValidUpiId('harshit@')).toBe(false);
    expect(isValidUpiId('harshit@ybl@extra')).toBe(false);
    expect(isValidUpiId('harshit@123')).toBe(false);
    expect(isValidUpiId('.harshit@ybl')).toBe(false);
    expect(isValidUpiId('harshit jain@ybl')).toBe(false);
  });
});

describe('normalizeUpiId', () => {
  it('trims and lowercases', () => {
    expect(normalizeUpiId('  Harshit@YBL ')).toBe('harshit@ybl');
  });
});

describe('buildUpiIntentUrl', () => {
  const base = { payeeUpiId: 'harshit@ybl', payeeName: 'Harshit', amount: 2400 };

  it('builds a well-formed intent', () => {
    const url = buildUpiIntentUrl(base)!;
    expect(url.startsWith('upi://pay?')).toBe(true);

    const params = new URLSearchParams(url.split('?')[1]);
    expect(params.get('pa')).toBe('harshit@ybl');
    expect(params.get('pn')).toBe('Harshit');
    expect(params.get('am')).toBe('2400.00');
    expect(params.get('cu')).toBe('INR');
  });

  it('always formats the amount to 2 decimals', () => {
    expect(new URLSearchParams(buildUpiIntentUrl({ ...base, amount: 5 })!.split('?')[1]).get('am')).toBe('5.00');
    expect(new URLSearchParams(buildUpiIntentUrl({ ...base, amount: 1234.5 })!.split('?')[1]).get('am')).toBe('1234.50');
  });

  it('normalizes the payee VPA', () => {
    const url = buildUpiIntentUrl({ ...base, payeeUpiId: '  Harshit@YBL ' })!;
    expect(new URLSearchParams(url.split('?')[1]).get('pa')).toBe('harshit@ybl');
  });

  it('encodes spaces as %20 rather than +', () => {
    const url = buildUpiIntentUrl({ ...base, payeeName: 'Harshit Jain', note: 'bantLo Flat 402' })!;
    expect(url).not.toContain('+');
    expect(url).toContain('%20');

    const params = new URLSearchParams(url.split('?')[1]);
    expect(params.get('pn')).toBe('Harshit Jain');
    expect(params.get('tn')).toBe('bantLo Flat 402');
  });

  it('falls back to a placeholder name when none is usable', () => {
    const url = buildUpiIntentUrl({ ...base, payeeName: '   ' })!;
    expect(new URLSearchParams(url.split('?')[1]).get('pn')).toBe('bantLo user');
  });

  it('truncates an overlong note', () => {
    const url = buildUpiIntentUrl({ ...base, note: 'x'.repeat(200) })!;
    expect(new URLSearchParams(url.split('?')[1]).get('tn')!.length).toBe(50);
  });

  it('omits the note when not supplied', () => {
    const url = buildUpiIntentUrl(base)!;
    expect(new URLSearchParams(url.split('?')[1]).has('tn')).toBe(false);
  });

  it('returns null rather than an unusable intent', () => {
    expect(buildUpiIntentUrl({ ...base, payeeUpiId: 'nonsense' })).toBeNull();
    expect(buildUpiIntentUrl({ ...base, payeeUpiId: '' })).toBeNull();
    expect(buildUpiIntentUrl({ ...base, amount: 0 })).toBeNull();
    expect(buildUpiIntentUrl({ ...base, amount: -100 })).toBeNull();
    expect(buildUpiIntentUrl({ ...base, amount: NaN })).toBeNull();
  });
});
