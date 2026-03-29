import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import NeoButton from './NeoButton';

interface Member {
  user_id: string;
  profiles: { display_name?: string; email: string };
}

interface AddSettlementProps {
  groupId: string;
  members: Member[];
  onComplete: () => void;
  onCancel: () => void;
  initialFromId?: string;
  initialToId?: string;
}

export default function AddSettlement({ groupId, members, onComplete, onCancel, initialFromId, initialToId }: AddSettlementProps) {
  const [fromUserId, setFromUserId] = useState(initialFromId || '');
  const [toUserId, setToUserId] = useState(initialToId || '');
  const [amount, setAmount] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || amount <= 0) return alert('Invalid amount');
    if (!fromUserId || !toUserId || fromUserId === toUserId) return alert('Invalid users selected!');

    setLoading(true);
    try {
      const { error } = await supabase.from('settlements').insert([{
        group_id: groupId,
        from_user_id: fromUserId,
        to_user_id: toUserId,
        amount: Number(amount)
      }]);
      if (error) throw error;
      onComplete();
    } catch (err: any) {
      console.error(err);
      alert('Failed to settle up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="np-section" style={{ borderColor: 'var(--text-accent)' }}>
      <h3 style={{ marginBottom: '1rem', textTransform: 'uppercase', color: 'var(--text-accent)' }}>Record Payment</h3>
      
      <div style={{ marginBottom: '1rem' }}>
        <p className="np-text-muted" style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>Who Paid?</p>
        <select 
          required 
          value={fromUserId} 
          onChange={e => setFromUserId(e.target.value)}
          style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-dark)', border: '2px solid var(--border-color)', color: 'white', outline: 'none' }}
        >
          <option value="" disabled>Select User</option>
          {members.map(m => (
            <option key={m.user_id} value={m.user_id}>
              {m.profiles?.display_name || m.profiles?.email || m.user_id}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <p className="np-text-muted" style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>Who Received?</p>
        <select 
          required 
          value={toUserId} 
          onChange={e => setToUserId(e.target.value)}
          style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-dark)', border: '2px solid var(--border-color)', color: 'white', outline: 'none' }}
        >
          <option value="" disabled>Select User</option>
          {members.map(m => (
            <option key={m.user_id} value={m.user_id}>
              {m.profiles?.display_name || m.profiles?.email || m.user_id}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <input 
          type="number" 
          step="0.01"
          placeholder="Amount (0.00)" 
          value={amount}
          onChange={(e) => setAmount(parseFloat(e.target.value))}
          required
          style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-dark)', border: '2px solid var(--border-color)', color: 'white', fontSize: '1.2rem', fontWeight: 'bold' }}
        />
      </div>

      <div style={{ display: 'flex', gap: '1rem' }}>
        <NeoButton type="submit" variant="primary" style={{ flex: 1, borderColor: 'var(--text-accent)' }} disabled={loading}>
          {loading ? 'Processing...' : 'Settle'}
        </NeoButton>
        <NeoButton type="button" onClick={onCancel} disabled={loading}>Cancel</NeoButton>
      </div>
    </form>
  );
}
