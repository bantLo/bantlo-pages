import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import NeoButton from './NeoButton';

interface Member {
  user_id: string;
  profiles: { display_name?: string; email: string };
}

interface AddExpenseProps {
  groupId: string;
  members: Member[];
  onComplete: () => void;
  onCancel: () => void;
}

export default function AddExpense({ groupId, members, onComplete, onCancel }: AddExpenseProps) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  
  // Funding States (Who Paid)
  const [payerType, setPayerType] = useState<'single' | 'multiple'>('single');
  const [singlePayerId, setSinglePayerId] = useState<string>('');
  const [multiPayers, setMultiPayers] = useState<Record<string, number>>({});
  
  // Consumption States (Who owes)
  const [splitType, setSplitType] = useState<0 | 1 | 2>(0); // 0=Equal, 1=Exact, 2=Shares
  const [exactAmounts, setExactAmounts] = useState<Record<string, number>>({});
  const [shares, setShares] = useState<Record<string, number>>({});
  
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setSinglePayerId(data.session.user.id);
      }
    });
  }, []);

  const calculateSplits = () => {
    const total = Number(amount) || 0;
    let computed: Record<string, number> = {};

    if (splitType === 0) {
      const perPerson = parseFloat((total / members.length).toFixed(2));
      let runningTotal = 0;
      members.forEach((m, i) => {
        if (i === members.length - 1) {
          computed[m.user_id] = parseFloat((total - runningTotal).toFixed(2));
        } else {
          computed[m.user_id] = perPerson;
          runningTotal += perPerson;
        }
      });
    } else if (splitType === 1) {
      computed = { ...exactAmounts };
    } else if (splitType === 2) {
      const totalShares = Object.values(shares).reduce((a, b) => a + (Number(b) || 0), 0);
      if (totalShares > 0) {
        let runningTotal = 0;
        members.forEach((m, i) => {
          const userShare = Number(shares[m.user_id]) || 0;
          if (i === members.length - 1) {
            computed[m.user_id] = parseFloat((total - runningTotal).toFixed(2));
          } else {
            const splitAmt = parseFloat(((userShare / totalShares) * total).toFixed(2));
            computed[m.user_id] = splitAmt;
            runningTotal += splitAmt;
          }
        });
      }
    }
    return computed;
  };

  const computedSplits = calculateSplits();
  
  const exactRemaining = splitType === 1 
    ? parseFloat((Number(amount || 0) - Object.values(exactAmounts).reduce((a, b) => a + (Number(b) || 0), 0)).toFixed(2))
    : 0;

  const multiPayerRemaining = payerType === 'multiple'
    ? parseFloat((Number(amount || 0) - Object.values(multiPayers).reduce((a, b) => a + (Number(b) || 0), 0)).toFixed(2))
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || amount <= 0) return alert('Invalid amount');
    if (splitType === 1 && exactRemaining !== 0) return alert('Exact splits must sum strictly to the total amount.');
    if (payerType === 'multiple' && multiPayerRemaining !== 0) return alert('Multi-payer sums must identically equal the total amount.');
    if (payerType === 'single' && !singlePayerId) return alert('Please assign a primary payer.');

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not auth');

      const { data: exp, error: e1 } = await supabase.from('expenses').insert([{
        group_id: groupId,
        amount: Number(amount),
        description,
        split_type: splitType
      }]).select().single();
      if (e1) throw e1;

      let paymentsToInsert = [];
      if (payerType === 'single') {
        paymentsToInsert.push({
          expense_id: exp.id,
          user_id: singlePayerId,
          amount_paid: Number(amount)
        });
      } else {
        paymentsToInsert = Object.entries(multiPayers).filter(([_, amt]) => amt > 0).map(([uid, amt]) => ({
          expense_id: exp.id,
          user_id: uid,
          amount_paid: amt
        }));
      }
      const { error: eP } = await supabase.from('expense_payments').insert(paymentsToInsert);
      if (eP) throw eP;

      const splitsToInsert = Object.entries(computedSplits).filter(([_, amt]) => amt > 0).map(([uid, amt]) => ({
        expense_id: exp.id,
        user_id: uid,
        amount_owed: amt
      }));
      const { error: e2 } = await supabase.from('expense_splits').insert(splitsToInsert);
      if (e2) throw e2;

      onComplete();
    } catch (err: any) {
      console.error(err);
      alert('Failed to add expense natively');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="np-section" style={{ borderColor: 'var(--text-accent)' }}>
      <h3 style={{ marginBottom: '1rem', textTransform: 'uppercase' }}>Add Expense</h3>
      
      <div style={{ marginBottom: '1rem' }}>
        <input 
          type="text" 
          placeholder="Description (e.g. Dinner)" 
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          maxLength={30}
          style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-dark)', border: '2px solid var(--border-color)', color: 'white', fontFamily: 'inherit' }}
        />
      </div>
      
      <div style={{ marginBottom: '1.5rem' }}>
        <input 
          type="number" 
          step="0.01"
          placeholder="Total Amount (0.00)" 
          value={amount}
          onChange={(e) => setAmount(parseFloat(e.target.value))}
          required
          style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-dark)', border: '2px solid var(--border-color)', color: 'white', fontSize: '1.2rem', fontWeight: 'bold', fontFamily: 'inherit' }}
        />
      </div>

      {/* FUNDING SECTOR (Who Paid) */}
      <div style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px dashed var(--border-color)' }}>
        <p className="np-text-muted" style={{ marginBottom: '0.5rem', fontSize: '0.85rem', textTransform: 'uppercase' }}>Who Paid?</p>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <NeoButton type="button" variant={payerType === 'single' ? 'primary' : 'default'} onClick={() => setPayerType('single')} style={{ flex: 1, padding: '0.5rem' }}>Individual</NeoButton>
          <NeoButton type="button" variant={payerType === 'multiple' ? 'primary' : 'default'} onClick={() => setPayerType('multiple')} style={{ flex: 1, padding: '0.5rem' }}>Multiple Payers</NeoButton>
        </div>

        {payerType === 'single' ? (
          <select 
            value={singlePayerId} 
            onChange={e => setSinglePayerId(e.target.value)}
            style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-dark)', border: '2px solid var(--border-color)', color: 'white', outline: 'none' }}
          >
            <option value="" disabled>Select User</option>
            {members.map(m => (
              <option key={m.user_id} value={m.user_id}>
                {m.profiles?.display_name || m.profiles?.email || m.user_id}
              </option>
            ))}
          </select>
        ) : (
          <div>
            <p style={{ textAlign: 'center', color: multiPayerRemaining === 0 ? 'var(--text-accent)' : 'var(--text-danger)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
              Remaining to fund: {multiPayerRemaining.toFixed(2)}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '150px', overflowY: 'auto' }}>
              {members.map(m => (
                <div key={m.user_id} className="np-flex-between" style={{ padding: '0.5rem', borderBottom: '1px solid #333' }}>
                  <span style={{ fontSize: '0.85rem' }}>{m.profiles?.display_name || m.profiles?.email || 'Unknown'}</span>
                  <input 
                    type="number" 
                    step="0.01" 
                    placeholder="Paid"
                    value={multiPayers[m.user_id] || ''} 
                    onChange={e => setMultiPayers({...multiPayers, [m.user_id]: parseFloat(e.target.value) || 0})}
                    style={{ width: '80px', background: 'transparent', border: '1px solid #555', color: 'white', padding: '0.2rem' }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CONSUMPTION SECTOR (Who Owes) */}
      <p className="np-text-muted" style={{ marginBottom: '0.5rem', fontSize: '0.85rem', textTransform: 'uppercase' }}>Who Owes?</p>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <NeoButton type="button" variant={splitType === 0 ? 'primary' : 'default'} onClick={() => setSplitType(0)} style={{ flex: 1, padding: '0.5rem' }}>Equal</NeoButton>
        <NeoButton type="button" variant={splitType === 1 ? 'primary' : 'default'} onClick={() => setSplitType(1)} style={{ flex: 1, padding: '0.5rem' }}>Exact</NeoButton>
        <NeoButton type="button" variant={splitType === 2 ? 'primary' : 'default'} onClick={() => setSplitType(2)} style={{ flex: 1, padding: '0.5rem' }}>Shares</NeoButton>
      </div>

      {splitType === 1 && (
        <div style={{ marginBottom: '1rem', padding: '0.5rem', border: '1px dashed var(--text-danger)' }}>
          <p style={{ textAlign: 'center', color: exactRemaining === 0 ? 'var(--text-accent)' : 'var(--text-danger)' }}>
            Remaining to assign: {exactRemaining.toFixed(2)}
          </p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem', maxHeight: '200px', overflowY: 'auto' }}>
        {members.map(m => (
          <div key={m.user_id} className="np-flex-between" style={{ padding: '0.5rem', borderBottom: '1px solid #333' }}>
            <span style={{ fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.profiles?.display_name || m.profiles?.email || m.user_id}</span>
            
            {splitType === 0 && <span style={{ fontFamily: 'monospace' }}>{computedSplits[m.user_id] || 0.00}</span>}
            
            {splitType === 1 && (
              <input 
                type="number" 
                step="0.01" 
                value={exactAmounts[m.user_id] || ''} 
                onChange={e => setExactAmounts({...exactAmounts, [m.user_id]: parseFloat(e.target.value) || 0})}
                style={{ width: '80px', background: 'transparent', border: '1px solid #555', color: 'white', padding: '0.2rem' }}
              />
            )}

            {splitType === 2 && (
              <input 
                type="number" 
                step="1" 
                placeholder="Shares"
                value={shares[m.user_id] || ''} 
                onChange={e => setShares({...shares, [m.user_id]: parseInt(e.target.value) || 0})}
                style={{ width: '60px', background: 'transparent', border: '1px solid #555', color: 'white', padding: '0.2rem' }}
              />
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '1rem' }}>
        <NeoButton type="submit" variant="primary" style={{ flex: 1 }} disabled={loading || (splitType === 1 && exactRemaining !== 0) || (payerType === 'multiple' && multiPayerRemaining !== 0)}>
          {loading ? 'Processing...' : 'Save Matrix'}
        </NeoButton>
        <NeoButton type="button" onClick={onCancel} disabled={loading}>Cancel</NeoButton>
      </div>
    </form>
  );
}
