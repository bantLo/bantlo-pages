interface ChipOption {
  value: string;
  label: string;
}

interface ChipSelectProps {
  options: ChipOption[];
  value: string;
  onChange: (value: string) => void;
}

/**
 * Single-select rendered as a row of chips rather than a native <select>.
 *
 * A native select's dropdown is drawn by the OS outside the page, so it can't
 * be positioned or styled — and it lands in the wrong place under Chrome's
 * device emulation, which is where this app gets tested. Chips also match the
 * multi-select directly beneath it, so the two read as one control.
 */
export default function ChipSelect({ options, value, onChange }: ChipSelectProps) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
      {options.map(opt => {
        const on = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={on}
            style={{
              padding: '0.4rem 0.7rem',
              background: on ? 'var(--text-accent)' : 'transparent',
              color: on ? 'black' : 'var(--text-secondary)',
              border: `2px solid ${on ? 'var(--text-accent)' : 'var(--border-color)'}`,
              fontWeight: on ? 'bold' : 'normal',
              fontSize: '0.75rem',
              cursor: 'pointer',
              fontFamily: 'inherit'
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
