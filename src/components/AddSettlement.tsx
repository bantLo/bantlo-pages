import React, { useState } from 'react';
import NeoButton from './NeoButton';

import { createSettlement, updateSettlement } from '../lib/api';

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
  initialAmount?: number;
  editId?: string;
  onDelete?: (id: string) => void;
}

export default function AddSettlement({ groupId, members, onComplete, onCancel, initialFromId, initialToId, initialAmount, editId, onDelete }: AddSettlementProps) {
  const [fromUserId, setFromUserId] = useState(initialFromId || '');
  const [toUserId, setToUserId] = useState(initialToId || '');
  const [amount, setAmount] = useState<number | ''>(initialAmount || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || amount <= 0) return alert('Invalid amount');
    if (!fromUserId || !toUserId || fromUserId === toUserId) return alert('Invalid users selected!');

    setLoading(true);
    try {
      if (editId) {
        await updateSettlement(editId, Number(amount));
      } else {
        await createSettlement(groupId, fromUserId, toUserId, Number(amount));
      }
      onComplete();
    } catch (err: any) {
      console.error(err);
      alert('Failed to save payment: ' + (err.message || 'Check database connection'));
    } finally {
      setLoading(false);
    }
  };

  const payerName = members.find(m => m.user_id === fromUserId)?.profiles?.display_name || 'User';
  const receiverName = members.find(m => m.user_id === toUserId)?.profiles?.display_name || 'User';

  return (
    <form onSubmit={handleSubmit} className="np-section" style={{ borderColor: 'var(--text-accent)' }}>
      <h3 style={{ marginBottom: '1rem', textTransform: 'uppercase', color: 'var(--text-accent)' }}>
        {editId ? 'Edit Payment' : 'Record Payment'}
      </h3>
      
      {!editId ? (
        <>
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
        </>
      ) : (
        <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderLeft: '3px solid var(--text-accent)' }}>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>
            <span style={{ color: 'var(--text-accent)', fontWeight: 'bold' }}>{payerName}</span> paid <span style={{ color: 'var(--text-accent)', fontWeight: 'bold' }}>{receiverName}</span>
          </p>
          <p className="np-text-muted" style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem' }}>Identity is locked for recorded payments.</p>
        </div>
      )}

      <div style={{ marginBottom: '1.5rem' }}>
        <p className="np-text-muted" style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>Amount</p>
        <input 
          type="number" 
          step="0.01"
          placeholder="Amount (0.00)" 
          value={amount}
          onChange={(e) => setAmount(parseFloat(e.target.value))}
          required
          autoFocus={!!editId}
          style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-dark)', border: '2px solid var(--border-color)', color: 'white', fontSize: '1.2rem', fontWeight: 'bold' }}
        />
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <NeoButton type="submit" variant="primary" style={{ flex: 1, minWidth: '120px', borderColor: 'var(--text-accent)' }} disabled={loading}>
          {loading ? 'Saving...' : (editId ? 'Update Payment' : 'Settle')}
        </NeoButton>
        
        {editId && onDelete && (
          <NeoButton 
            type="button" 
            onClick={() => editId && onDelete(editId)} 
            style={{ flex: 1, minWidth: '120px', color: 'var(--text-danger)', borderColor: 'var(--text-danger)' }} 
            disabled={loading}
          >
            Delete Payment
          </NeoButton>
        )}

        <NeoButton type="button" onClick={onCancel} disabled={loading}>Cancel</NeoButton>
      </div>
    </form>
  );
}
