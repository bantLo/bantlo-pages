/**
 * Arithmetic evaluator for amount fields — lets users type "80+10" instead of 90.
 *
 * Hand-rolled recursive-descent parser rather than eval()/new Function(): the input
 * is user-controlled and this runs in the browser, so no string ever reaches a
 * code path that could execute it.
 *
 * Grammar:
 *   expr    := term (('+' | '-') term)*
 *   term    := factor (('*' | '/') factor)*
 *   factor  := ('+' | '-') factor | primary
 *   primary := number | '(' expr ')'
 */

type Token =
  | { type: 'num'; value: number }
  | { type: 'op'; value: '+' | '-' | '*' | '/' }
  | { type: 'paren'; value: '(' | ')' };

const OPERATORS = ['+', '-', '*', '/'] as const;

function tokenize(input: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (ch === ' ') {
      i++;
      continue;
    }

    if ((OPERATORS as readonly string[]).includes(ch)) {
      tokens.push({ type: 'op', value: ch as '+' | '-' | '*' | '/' });
      i++;
      continue;
    }

    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'paren', value: ch });
      i++;
      continue;
    }

    if ((ch >= '0' && ch <= '9') || ch === '.') {
      let literal = '';
      let seenDot = false;
      while (i < input.length) {
        const c = input[i];
        if (c >= '0' && c <= '9') {
          literal += c;
          i++;
        } else if (c === '.' && !seenDot) {
          seenDot = true;
          literal += c;
          i++;
        } else {
          break;
        }
      }
      const value = parseFloat(literal);
      if (!Number.isFinite(value)) return null;
      tokens.push({ type: 'num', value });
      continue;
    }

    // Anything else (letters, symbols) makes the whole expression invalid.
    return null;
  }

  return tokens;
}

/**
 * Evaluates an arithmetic expression, rounding to 2 decimals for currency.
 * Returns null when the input is empty, malformed, or produces a non-finite
 * result (e.g. division by zero) — callers should leave the field untouched.
 */
export function evaluateExpression(input: string): number | null {
  // Commas are thousands separators, so strip them before tokenizing — skipping
  // them inline would split "1,200" into two separate number tokens.
  const trimmed = input.replace(/,/g, '').trim();
  if (!trimmed) return null;

  const tokens = tokenize(trimmed);
  if (!tokens || tokens.length === 0) return null;

  let pos = 0;
  let failed = false;

  const peek = (): Token | undefined => tokens[pos];

  function parseExpr(): number {
    let left = parseTerm();
    while (!failed) {
      const token = peek();
      if (token?.type !== 'op' || (token.value !== '+' && token.value !== '-')) break;
      pos++;
      const right = parseTerm();
      left = token.value === '+' ? left + right : left - right;
    }
    return left;
  }

  function parseTerm(): number {
    let left = parseFactor();
    while (!failed) {
      const token = peek();
      if (token?.type !== 'op' || (token.value !== '*' && token.value !== '/')) break;
      pos++;
      const right = parseFactor();
      left = token.value === '*' ? left * right : left / right;
    }
    return left;
  }

  function parseFactor(): number {
    const token = peek();
    if (token?.type === 'op' && (token.value === '+' || token.value === '-')) {
      pos++;
      const operand = parseFactor();
      return token.value === '-' ? -operand : operand;
    }
    return parsePrimary();
  }

  function parsePrimary(): number {
    const token = peek();
    if (token?.type === 'num') {
      pos++;
      return token.value;
    }
    if (token?.type === 'paren' && token.value === '(') {
      pos++;
      const inner = parseExpr();
      const closing = peek();
      if (closing?.type === 'paren' && closing.value === ')') {
        pos++;
        return inner;
      }
      failed = true;
      return 0;
    }
    failed = true;
    return 0;
  }

  const result = parseExpr();

  // Trailing tokens mean the expression was only partially consumed ("1 2", "5+").
  if (failed || pos !== tokens.length) return null;
  if (!Number.isFinite(result)) return null;

  return parseFloat(result.toFixed(2));
}

/** True when the input contains an operator, i.e. it needs evaluating to become a number. */
export function isExpression(input: string): boolean {
  return /[+\-*/()]/.test(input.trim().slice(1));
}
