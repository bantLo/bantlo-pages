import { useState } from 'react';
import NeoButton from './NeoButton';
import CalcInput from './CalcInput';
import ChipSelect from './ChipSelect';
import type { ExpensePreset } from '../lib/api';

interface Member {
  user_id: string;
  profiles?: { display_name?: string; email?: string };
}

interface QuickAddPresetProps {
  preset: ExpensePreset | null;
  members: Member[];
  currency: string;
  currentUserId: string;
  /** Most recent amount booked through this preset, if any. */
  lastAmount?: number;
  onSubmit: (amount: number, payerId: string, memberIds: string[]) => Promise<void>;
  onEditDetails: (amount: number | '') => void;
  onClose: () => void;
}

const nameOf = (m?: Member) => m?.profiles?.display_name || m?.profiles?.email || 'Unknown';

/**
 * The preset quick-add: a whole expense minus the amount.
 *
 * Everything the preset already knows — description, roster, split — is applied
 * silently. Only the amount and payer are asked for, and "Edit details" escapes
 * to the full form for the month where the usual split doesn't apply.
 */
export default function QuickAddPreset({
  preset,
  members,
  currency,
  currentUserId,
  lastAmount,
  onSubmit,
  onEditDetails,
  onClose,
}: QuickAddPresetProps) {
  // A preset can outlive someone's removal from the group; splitting to an
  // ex-member would corrupt balances, so the roster is always intersected with
  // current membership.
  const roster = (preset?.members || [])
    .map(pm => members.find(m => m.user_id === pm.user_id))
    .filter((m): m is Member => !!m);

  const defaultPayer = preset?.payer_id && members.some(m => m.user_id === preset.payer_id)
    ? preset.payer_id
    : currentUserId;

  const [amount, setAmount] = useState<number | ''>(preset?.default_amount ?? '');
  const [payerId, setPayerId] = useState(defaultPayer);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!preset) return null;

  const handleSubmit = async () => {
    if (!amount || amount <= 0) {
      setError('Enter an amount.');
      return;
    }
    if (roster.length === 0) {
      setError('Nobody in this preset is still in the group. Edit it under Manage.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await onSubmit(Number(amount), payerId, roster.map(m => m.user_id));
    } catch (err: any) {
      setError(err.message || 'Could not add the expense.');
      setSaving(false);
    }
  };

  const rosterLabel = roster.length
    ? `Splits ${roster.length} ways: ${roster.map(m => nameOf(m).split(' ')[0]).join(', ')}`
    : 'No current members — edit this preset under Manage.';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.85)',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        zIndex: 9999, padding: '1rem'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-dark)',
          border: '2px solid var(--border-color)',
          padding: '1.5rem',
          width: '100%',
          maxWidth: '420px',
          boxShadow: '8px 8px 0px rgba(0,0,0,0.6)'
        }}
      >
        <p className="np-text-muted" style={{ margin: 0, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Quick Add
        </p>
        <h2 style={{ margin: '0.4rem 0 0.4rem 0', fontSize: '1.4rem' }}>{preset.name}</h2>
        <p className="np-text-muted" style={{ margin: '0 0 1.25rem 0', fontSize: '0.8rem' }}>{rosterLabel}</p>

        <div style={{ marginBottom: '1rem' }}>
          <p className="np-text-muted" style={{ marginBottom: '0.4rem', fontSize: '0.8rem' }}>Amount</p>
          <CalcInput
            value={amount}
            onValueChange={v => { setAmount(v); setError(''); }}
            autoFocus
            // Pre-filled amounts select on focus so they can be replaced by typing.
            onFocus={e => e.currentTarget.select()}
            placeholder={`Amount (0.00 or 80+10)`}
            style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-dark)', border: '2px solid var(--border-color)', color: 'white', fontSize: '1.2rem', fontWeight: 'bold', fontFamily: 'inherit' }}
          />
          {preset.default_amount == null && lastAmount != null && (
            <p className="np-text-muted" style={{ margin: '0.4rem 0 0 0', fontSize: '0.75rem' }}>
              Last time: {currency} {lastAmount.toFixed(2)}
            </p>
          )}
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <p className="np-text-muted" style={{ marginBottom: '0.4rem', fontSize: '0.8rem' }}>Paid by</p>
          <ChipSelect
            value={payerId}
            onChange={setPayerId}
            options={members.map(m => ({
              value: m.user_id,
              label: m.user_id === currentUserId ? 'You' : nameOf(m).split(' ')[0]
            }))}
          />
        </div>

        {error && (
          <p role="alert" style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', color: 'var(--text-danger)', fontWeight: 'bold' }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* The amount lives in the action, not just the field — a pre-filled
              figure that has gone stale is otherwise easy to tap straight past. */}
          <NeoButton
            variant="primary"
            style={{ width: '100%', borderColor: 'var(--text-accent)' }}
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? 'Adding...' : (amount ? `Add ${currency} ${Number(amount).toFixed(2)} Expense` : 'Add Expense')}
          </NeoButton>

          <button
            onClick={() => onEditDetails(amount)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline', fontFamily: 'inherit', padding: '0.25rem' }}
          >
            Edit details…
          </button>

          <NeoButton style={{ width: '100%', borderColor: 'var(--text-secondary)' }} onClick={onClose} disabled={saving}>
            Cancel
          </NeoButton>
        </div>
      </div>
    </div>
  );
}
