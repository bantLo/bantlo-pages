import React, { useState, useEffect, useRef } from 'react';
import { evaluateExpression, isExpression } from '../lib/calc';

/** Everything outside digits, a decimal point, thousands commas and + - * / ( ). */
const DISALLOWED = /[^0-9.,+\-*/()\s]/g;

interface CalcInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number | '';
  onValueChange: (value: number | '') => void;
}

/**
 * Amount field that doubles as a calculator — "80+10" resolves to 90 on blur.
 *
 * Kept as type="text" because type="number" rejects operator characters outright.
 * Plain numbers propagate to the parent as you type; expressions are held locally
 * until blur (or Enter) so live split previews don't flicker while mid-expression.
 *
 * Invalid input is never discarded: the raw text stays put and an inline error is
 * shown, so the user can correct the typo instead of retyping from scratch.
 */
export default function CalcInput({ value, onValueChange, style, ...rest }: CalcInputProps) {
  const [text, setText] = useState(value === '' ? '' : String(value));
  const [error, setError] = useState<string | null>(null);
  const focused = useRef(false);

  // Mirror externally-driven value changes (edit mode hydration, resets) while idle.
  // Skipped while an error is showing, otherwise clearing the value on a failed
  // commit would bounce back through here and wipe the text the user needs to fix.
  useEffect(() => {
    if (focused.current || error) return;
    setText(value === '' ? '' : String(value));
  }, [value, error]);

  const pending = !error && isExpression(text) ? evaluateExpression(text) : null;

  const commit = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setText('');
      setError(null);
      onValueChange('');
      return;
    }

    const result = evaluateExpression(trimmed);
    if (result === null) {
      setError(
        isExpression(trimmed)
          ? "Can't compute that — check the expression."
          : 'Enter a number or a sum like 80+10.'
      );
      onValueChange('');
      return;
    }

    setError(null);
    setText(String(result));
    onValueChange(result);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only digits and arithmetic symbols get through — anything else (letters,
    // punctuation, emoji) is dropped at the keystroke, including via paste.
    const next = e.target.value.replace(DISALLOWED, '');
    setText(next);
    // Editing clears the error — re-validated on the next blur.
    if (error) setError(null);

    if (!next.trim()) {
      onValueChange('');
      return;
    }
    // Hold expressions back until blur; propagate plain numbers immediately.
    if (!isExpression(next)) {
      const result = evaluateExpression(next);
      if (result !== null) onValueChange(result);
    }
  };

  return (
    <>
      <input
        type="text"
        inputMode="text"
        autoComplete="off"
        aria-invalid={!!error}
        value={text}
        onChange={handleChange}
        onFocus={() => { focused.current = true; }}
        onBlur={() => { focused.current = false; commit(); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && isExpression(text)) {
            e.preventDefault();
            commit();
          }
        }}
        style={error ? { ...style, borderColor: 'var(--text-danger)' } : style}
        {...rest}
      />
      {error && (
        <p
          role="alert"
          style={{ margin: '0.35rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-danger)', fontWeight: 'bold' }}
        >
          {error}
        </p>
      )}
      {pending !== null && (
        <p
          className="np-text-muted"
          style={{ margin: '0.35rem 0 0 0', fontSize: '0.8rem', letterSpacing: '0.05em' }}
        >
          = {pending.toFixed(2)}
        </p>
      )}
    </>
  );
}
