import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import CalcInput from '../components/CalcInput';

/** Mirrors real usage: the parent owns the value, so a cleared value round-trips back in. */
function Harness({ onValue }: { onValue?: (v: number | '') => void }) {
  const [amount, setAmount] = useState<number | ''>('');
  return (
    <CalcInput
      value={amount}
      onValueChange={(v) => { setAmount(v); onValue?.(v); }}
      placeholder="Total Amount"
    />
  );
}

const typeAndBlur = (input: HTMLElement, value: string) => {
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
};

describe('CalcInput', () => {
  it('evaluates an expression on blur', () => {
    render(<Harness />);
    const input = screen.getByPlaceholderText('Total Amount');
    typeAndBlur(input, '80+10');
    expect(input).toHaveValue('90');
  });

  it('previews the result before blur', () => {
    render(<Harness />);
    const input = screen.getByPlaceholderText('Total Amount');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '80+10' } });
    expect(screen.getByText('= 90.00')).toBeInTheDocument();
  });

  it('keeps the raw text and shows an error when the expression is invalid', () => {
    render(<Harness />);
    const input = screen.getByPlaceholderText('Total Amount');
    typeAndBlur(input, '80++*10');

    expect(input).toHaveValue('80++*10');
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('rejects non-mathematical characters as they are typed', () => {
    render(<Harness />);
    const input = screen.getByPlaceholderText('Total Amount');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(input).toHaveValue('');

    fireEvent.change(input, { target: { value: '8a0+b1c0' } });
    expect(input).toHaveValue('80+10');
  });

  it('strips non-mathematical characters from pasted text', () => {
    render(<Harness />);
    const input = screen.getByPlaceholderText('Total Amount');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '$80 + $10;' } });
    fireEvent.blur(input);
    expect(input).toHaveValue('90');
  });

  it('keeps every arithmetic symbol', () => {
    render(<Harness />);
    const input = screen.getByPlaceholderText('Total Amount');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '(1+2)-3*4/5.6' } });
    expect(input).toHaveValue('(1+2)-3*4/5.6');
  });

  it('clears the underlying value on invalid input so submit stays blocked', () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    const input = screen.getByPlaceholderText('Total Amount');
    typeAndBlur(input, '80+');
    expect(onValue).toHaveBeenLastCalledWith('');
  });

  it('clears the error once the user edits, and recovers on the next blur', () => {
    render(<Harness />);
    const input = screen.getByPlaceholderText('Total Amount');
    typeAndBlur(input, '80+');
    expect(screen.getByRole('alert')).toBeInTheDocument();

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '80+10' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    fireEvent.blur(input);
    expect(input).toHaveValue('90');
  });

  it('rejects a negative result and keeps the text', () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    const input = screen.getByPlaceholderText('Total Amount');
    typeAndBlur(input, '50-80');

    expect(input).toHaveValue('50-80');
    expect(screen.getByRole('alert')).toHaveTextContent("Amount can't be negative.");
    expect(onValue).toHaveBeenLastCalledWith('');
  });

  it('rejects a directly-typed negative number', () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    const input = screen.getByPlaceholderText('Total Amount');
    typeAndBlur(input, '-50');

    expect(input).toHaveValue('-50');
    expect(screen.getByRole('alert')).toHaveTextContent("Amount can't be negative.");
    expect(onValue).toHaveBeenLastCalledWith('');
  });

  it('allows negative intermediates that total positive', () => {
    render(<Harness />);
    const input = screen.getByPlaceholderText('Total Amount');
    typeAndBlur(input, '-50+80');

    expect(input).toHaveValue('30');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not preview a negative result', () => {
    render(<Harness />);
    const input = screen.getByPlaceholderText('Total Amount');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '50-80' } });
    expect(screen.queryByText('= -30.00')).not.toBeInTheDocument();
  });

  it('propagates plain numbers as they are typed', () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    const input = screen.getByPlaceholderText('Total Amount');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '80' } });
    expect(onValue).toHaveBeenLastCalledWith(80);
  });

  it('empties cleanly when the field is blanked', () => {
    render(<Harness />);
    const input = screen.getByPlaceholderText('Total Amount');
    typeAndBlur(input, '90');
    typeAndBlur(input, '');
    expect(input).toHaveValue('');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
