import { useState } from 'react';
import NeoButton from './NeoButton';
import CalcInput from './CalcInput';
import { createPreset, updatePreset, deletePreset, setPresetMembers, type ExpensePreset } from '../lib/api';

interface Member {
  user_id: string;
  profiles?: { display_name?: string; email?: string };
}

interface PresetManagerProps {
  groupId: string;
  members: Member[];
  presets: ExpensePreset[];
  currency: string;
  currentUserId: string;
  onChanged: () => void;
}

const nameOf = (m?: Member) => m?.profiles?.display_name || m?.profiles?.email || 'Unknown';

const inputStyle = {
  width: '100%', padding: '0.6rem', background: 'var(--bg-dark)',
  border: '2px solid var(--border-color)', color: 'white',
  outline: 'none', fontFamily: 'inherit'
} as const;

/** Create, edit and delete the group's quick-add presets. */
export default function PresetManager({ groupId, members, presets, currency, currentUserId, onChanged }: PresetManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [defaultAmount, setDefaultAmount] = useState<number | ''>('');
  const [payerId, setPayerId] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const resetForm = () => {
    setName('');
    setDefaultAmount('');
    setPayerId('');
    setSelected({});
    setError('');
  };

  const startCreate = () => {
    resetForm();
    // Everyone in by default — the common case is "splits between all of us",
    // and unchecking a couple is less work than checking everyone.
    setSelected(Object.fromEntries(members.map(m => [m.user_id, true])));
    setEditingId(null);
    setCreating(true);
  };

  const startEdit = (preset: ExpensePreset) => {
    resetForm();
    setName(preset.name);
    setDefaultAmount(preset.default_amount ?? '');
    setPayerId(preset.payer_id || '');
    setSelected(Object.fromEntries(preset.members.map(pm => [pm.user_id, true])));
    setCreating(false);
    setEditingId(preset.id);
  };

  const cancel = () => {
    setCreating(false);
    setEditingId(null);
    resetForm();
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    const memberIds = Object.entries(selected).filter(([, on]) => on).map(([id]) => id);

    if (!trimmed) return setError('Give the preset a name.');
    if (memberIds.length === 0) return setError('Pick at least one person to split between.');

    setBusy(true);
    setError('');
    try {
      if (editingId) {
        await updatePreset(editingId, {
          name: trimmed,
          default_amount: defaultAmount === '' ? null : Number(defaultAmount),
          payer_id: payerId || null
        });
        await setPresetMembers(editingId, memberIds);
      } else {
        await createPreset(groupId, trimmed, memberIds, {
          defaultAmount: defaultAmount === '' ? null : Number(defaultAmount),
          payerId: payerId || null
        });
      }
      cancel();
      onChanged();
    } catch (err: any) {
      // The unique index on (group_id, lower(name)) is the likeliest failure.
      setError(err.code === '23505' ? 'A preset with that name already exists.' : (err.message || 'Could not save.'));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (preset: ExpensePreset) => {
    if (!confirm(`Delete the "${preset.name}" preset? Expenses already added through it are kept.`)) return;
    setBusy(true);
    try {
      await deletePreset(preset.id);
      onChanged();
    } catch (err: any) {
      setError(err.message || 'Could not delete.');
    } finally {
      setBusy(false);
    }
  };

  const formOpen = creating || !!editingId;

  return (
    <div className="np-section" style={{ borderStyle: 'dotted' }}>
      <div className="np-flex-between" style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.1rem', margin: 0, textTransform: 'uppercase' }}>Quick Add Presets</h2>
        {!formOpen && (
          <NeoButton style={{ padding: '0.35rem 0.7rem', fontSize: '0.75rem' }} onClick={startCreate}>
            + New
          </NeoButton>
        )}
      </div>

      <p className="np-text-muted" style={{ margin: '0 0 1rem 0', fontSize: '0.8rem', lineHeight: 1.5 }}>
        Recurring expenses minus the amount. Tap one on the Expenses tab to add it in two taps.
      </p>

      {!formOpen && presets.length === 0 && (
        <p className="np-text-muted" style={{ fontSize: '0.85rem', fontStyle: 'italic' }}>
          No presets yet. Add one for rent, milk, wifi — whatever keeps coming back.
        </p>
      )}

      {!formOpen && presets.map(preset => {
        const roster = preset.members
          .map(pm => members.find(m => m.user_id === pm.user_id))
          .filter(Boolean) as Member[];
        const stale = preset.members.length - roster.length;

        return (
          <div key={preset.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid #333' }}>
            <div className="np-flex-between" style={{ gap: '0.5rem' }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 'bold' }}>{preset.name}</p>
                <p className="np-text-muted" style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem' }}>
                  {preset.default_amount != null ? `${currency} ${Number(preset.default_amount).toFixed(2)} · ` : ''}
                  {roster.length} {roster.length === 1 ? 'person' : 'people'}
                  {stale > 0 && <span style={{ color: 'var(--text-danger)' }}> · {stale} no longer in group</span>}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                <NeoButton style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem' }} onClick={() => startEdit(preset)}>Edit</NeoButton>
                <NeoButton variant="danger" style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem' }} onClick={() => handleDelete(preset)}>Del</NeoButton>
              </div>
            </div>
          </div>
        );
      })}

      {formOpen && (
        <div className="np-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          <div>
            <p className="np-text-muted" style={{ marginBottom: '0.4rem', fontSize: '0.8rem' }}>Name</p>
            <input
              value={name}
              onChange={e => { setName(e.target.value); setError(''); }}
              placeholder="Rent, Milk, Wifi..."
              maxLength={50}
              style={inputStyle}
            />
          </div>

          <div>
            <p className="np-text-muted" style={{ marginBottom: '0.4rem', fontSize: '0.8rem' }}>
              Fixed amount <span style={{ opacity: 0.6 }}>— leave blank to ask each time</span>
            </p>
            <CalcInput
              value={defaultAmount}
              onValueChange={setDefaultAmount}
              placeholder={`e.g. 45000`}
              style={inputStyle}
            />
          </div>

          <div>
            <p className="np-text-muted" style={{ marginBottom: '0.4rem', fontSize: '0.8rem' }}>
              Usually paid by <span style={{ opacity: 0.6 }}>— defaults to whoever adds it</span>
            </p>
            <select value={payerId} onChange={e => setPayerId(e.target.value)} style={inputStyle}>
              <option value="">Whoever adds it</option>
              {members.map(m => (
                <option key={m.user_id} value={m.user_id}>
                  {m.user_id === currentUserId ? 'You' : nameOf(m)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="np-text-muted" style={{ marginBottom: '0.4rem', fontSize: '0.8rem' }}>Splits between</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {members.map(m => {
                const on = !!selected[m.user_id];
                return (
                  <button
                    key={m.user_id}
                    type="button"
                    onClick={() => { setSelected(s => ({ ...s, [m.user_id]: !on })); setError(''); }}
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
                    {m.user_id === currentUserId ? 'You' : nameOf(m).split(' ')[0]}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <p role="alert" style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-danger)', fontWeight: 'bold' }}>{error}</p>
          )}

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <NeoButton variant="primary" style={{ flex: 1, borderColor: 'var(--text-accent)' }} onClick={handleSave} disabled={busy}>
              {busy ? 'Saving...' : (editingId ? 'Update Preset' : 'Create Preset')}
            </NeoButton>
            <NeoButton style={{ flex: 1 }} onClick={cancel} disabled={busy}>Cancel</NeoButton>
          </div>
        </div>
      )}
    </div>
  );
}
