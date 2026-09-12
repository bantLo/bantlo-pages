import { describe, it, expect } from 'vitest';
import { evaluateExpression, isExpression } from '../lib/calc';

describe('evaluateExpression', () => {
  it('returns plain numbers unchanged', () => {
    expect(evaluateExpression('80')).toBe(80);
    expect(evaluateExpression('80.50')).toBe(80.5);
    expect(evaluateExpression('  42  ')).toBe(42);
  });

  it('evaluates addition and subtraction', () => {
    expect(evaluateExpression('80+10')).toBe(90);
    expect(evaluateExpression('100-25.5')).toBe(74.5);
    expect(evaluateExpression('10+20+30')).toBe(60);
  });

  it('respects operator precedence', () => {
    expect(evaluateExpression('2+3*4')).toBe(14);
    expect(evaluateExpression('100/4+5')).toBe(30);
  });

  it('handles parentheses', () => {
    expect(evaluateExpression('(2+3)*4')).toBe(20);
    expect(evaluateExpression('900/(2+1)')).toBe(300);
  });

  it('handles unary minus', () => {
    expect(evaluateExpression('-50+80')).toBe(30);
    expect(evaluateExpression('10*-2')).toBe(-20);
  });

  it('rounds results to 2 decimals for currency', () => {
    expect(evaluateExpression('10/3')).toBe(3.33);
    expect(evaluateExpression('0.1+0.2')).toBe(0.3);
  });

  it('ignores spaces and thousands commas', () => {
    expect(evaluateExpression('80 + 10')).toBe(90);
    expect(evaluateExpression('1,200+300')).toBe(1500);
  });

  it('returns null for empty input', () => {
    expect(evaluateExpression('')).toBeNull();
    expect(evaluateExpression('   ')).toBeNull();
  });

  it('returns null for malformed expressions', () => {
    expect(evaluateExpression('80+')).toBeNull();
    expect(evaluateExpression('80 10')).toBeNull();
    expect(evaluateExpression('(80+10')).toBeNull();
    expect(evaluateExpression('80++*10')).toBeNull();
    expect(evaluateExpression('*5')).toBeNull();
  });

  it('rejects anything that is not arithmetic', () => {
    expect(evaluateExpression('alert(1)')).toBeNull();
    expect(evaluateExpression('80+abc')).toBeNull();
    expect(evaluateExpression('process.exit')).toBeNull();
  });

  it('returns null for non-finite results', () => {
    expect(evaluateExpression('10/0')).toBeNull();
  });
});

describe('isExpression', () => {
  it('detects operators', () => {
    expect(isExpression('80+10')).toBe(true);
    expect(isExpression('(2+3)')).toBe(true);
  });

  it('treats plain and negative numbers as non-expressions', () => {
    expect(isExpression('80')).toBe(false);
    expect(isExpression('80.50')).toBe(false);
    expect(isExpression('-80')).toBe(false);
  });
});
