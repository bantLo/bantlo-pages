import { describe, it, expect } from 'vitest';
import { computeEqualSplits } from '../lib/splits';

const sum = (splits: Record<string, number>) =>
  parseFloat(Object.values(splits).reduce((a, b) => a + b, 0).toFixed(2));

describe('computeEqualSplits', () => {
  it('divides evenly when it divides evenly', () => {
    expect(computeEqualSplits(90, ['a', 'b', 'c'])).toEqual({ a: 30, b: 30, c: 30 });
  });

  it('gives the rounding remainder to the last person', () => {
    expect(computeEqualSplits(100, ['a', 'b', 'c'])).toEqual({ a: 33.33, b: 33.33, c: 33.34 });
  });

  it('always sums to exactly the total', () => {
    // Exactness matters: balances are derived from these rows, so a stray paisa
    // becomes a permanent discrepancy.
    for (const total of [100, 0.01, 45000, 1, 33.33, 999.99, 7]) {
      for (const n of [1, 2, 3, 4, 7, 11]) {
        const ids = Array.from({ length: n }, (_, i) => `u${i}`);
        expect(sum(computeEqualSplits(total, ids))).toBe(total);
      }
    }
  });

  it('handles a single member', () => {
    expect(computeEqualSplits(45000, ['a'])).toEqual({ a: 45000 });
  });

  it('returns nothing for an empty roster', () => {
    expect(computeEqualSplits(100, [])).toEqual({});
  });

  it('handles amounts that do not divide cleanly', () => {
    const splits = computeEqualSplits(10, ['a', 'b', 'c']);
    expect(splits.a).toBe(3.33);
    expect(splits.b).toBe(3.33);
    expect(splits.c).toBe(3.34);
    expect(sum(splits)).toBe(10);
  });
});
