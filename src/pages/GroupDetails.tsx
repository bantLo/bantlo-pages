import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchGroupDetails, fetchGroupMembers, fetchGroupBalances, fetchRecentExpenses, addMemberByEmail, deleteExpense, updateGroupSettings, updateExpenseDescription, removeMember, deleteGroup, fetchExpenseCount, fetchRecentSettlements, deleteSettlement } from '../lib/api';
import AddExpense from '../components/AddExpense';
import AddSettlement from '../components/AddSettlement';
import BackButton from '../components/BackButton';
import NeoButton from '../components/NeoButton';

export default function GroupDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [group, setGroup] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [expenseCount, setExpenseCount] = useState(0);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [showAddSettlement, setShowAddSettlement] = useState(false);
  
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [memberLoading, setMemberLoading] = useState(false);
  
  const [editingGroupId, setEditingGroupId] = useState(false);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupCurrency, setEditGroupCurrency] = useState('');

  const COMMON_CURRENCIES = ['USD', 'INR', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'AED', 'SGD', 'CHF'];

  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editExpenseDesc, setEditExpenseDesc] = useState('');

  useEffect(() => {
    if (id) {
      loadGroupData(id);
    }
  }, [id]);

  const loadGroupData = async (groupId: string) => {
    try {
      const gData = await fetchGroupDetails(groupId);
      setGroup(gData);
      
      const [mData, bData, eData, sData, countTemp] = await Promise.all([
        fetchGroupMembers(groupId),
        fetchGroupBalances(groupId),
        fetchRecentExpenses(groupId),
        fetchRecentSettlements(groupId),
        fetchExpenseCount(groupId)
      ]);
      
      setMembers(mData);
      setBalances(bData);
      setExpenses(eData);
      setSettlements(sData);
      setExpenseCount(countTemp);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExpenseSaved = () => {
    setShowAddExpense(false);
    if (id) loadGroupData(id);
    alert('Expense successfully added!');
  };

  const handleSettlementSaved = () => {
    setShowAddSettlement(false);
    if (id) loadGroupData(id);
    alert('Payment successfully recorded!');
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !newMemberEmail) return;
    setMemberLoading(true);
    try {
      await addMemberByEmail(id, newMemberEmail);
      alert('Member successfully added!');
      setShowAddMember(false);
      setNewMemberEmail('');
      loadGroupData(id);
    } catch (err: any) {
      alert(err.message || 'Failed to add member');
    } finally {
      setMemberLoading(false);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!id || !window.confirm('Are you absolutely sure? This will delete the expense and automatically reverse the calculated group balances!')) return;
    try {
      await deleteExpense(expenseId);
      loadGroupData(id);
    } catch(err: any) {
      alert('Failed to delete expense: ' + err.message);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!id || !window.confirm('Remove this member from the group?')) return;
    try {
      await removeMember(id, userId);
      loadGroupData(id);
    } catch(err: any) {
      alert('Failed to remove member: ' + err.message);
    }
  };

  const handleDeleteGroup = async () => {
    if (!id || !window.confirm('WARNING: Are you absolutely sure? This will permanently delete the group, all expenses, and all balances forever.')) return;
    try {
      await deleteGroup(id);
      navigate('/dashboard');
    } catch(err: any) {
      alert('Failed to delete group: ' + err.message);
    }
  };

  const handleDeleteSettlement = async (settlementId: string) => {
    if (!id || !window.confirm('Are you sure? This will delete the payment record and reverse its balance effects.')) return;
    try {
      await deleteSettlement(settlementId);
      loadGroupData(id);
    } catch(err: any) {
      alert('Failed to delete settlement: ' + err.message);
    }
  };

  const handleUpdateGroupSettings = async () => {
    if (!editGroupName.trim()) return setEditingGroupId(false);
    try {
      await updateGroupSettings(id!, { name: editGroupName, currency: editGroupCurrency });
      setGroup({ ...group, name: editGroupName, currency: editGroupCurrency });
    } catch(err) {
      alert('Failed to update group settings');
    }
    setEditingGroupId(false);
  };

  const handleUpdateExpenseDesc = async (expenseId: string) => {
    if (!editExpenseDesc.trim()) return setEditingExpenseId(null);
    try {
      await updateExpenseDescription(expenseId, editExpenseDesc);
      setExpenses(expenses.map(e => e.id === expenseId ? { ...e, description: editExpenseDesc.substring(0, 30) } : e));
    } catch(err) {
      alert('Failed to update expense description');
    }
    setEditingExpenseId(null);
  };

  if (loading) return <div className="np-container"><p className="np-title" style={{ border: 'none', animation: 'pulse 1.5s infinite'}}>Loading group...</p></div>;

  if (!group) {
    return (
      <div className="np-container">
        <p className="np-text-danger">Group not found or inaccessible.</p>
        <BackButton fallback="/dashboard" />
      </div>
    );
  }

  return (
    <div className="np-container">
      {expenseCount >= 300 && (
        <div className="np-section" style={{ borderStyle: 'solid', borderColor: 'var(--text-danger)', marginBottom: '1.5rem', background: 'rgba(255,50,50,0.1)' }}>
          <h2 style={{ fontSize: '1.2rem', color: 'var(--text-danger)', marginTop: 0 }}>Limit Exceeded (300+ Logs)</h2>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>To save server costs and keep bantLo free natively, please <strong>Settle Up</strong> any active balances, create a new Group, and Delete this one. Older transactions may no longer calculate accurately to prevent aggressive looping.</p>
        </div>
      )}

      <div className="np-flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        {editingGroupId ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
            <input 
              value={editGroupName}
              onChange={e => setEditGroupName(e.target.value)}
              style={{ background: 'transparent', border: '1px solid var(--text-accent)', color: 'white', fontSize: '1.2rem', width: '100%', outline: 'none', fontFamily: 'inherit', padding: '0.2rem' }}
              autoFocus
              placeholder="Group Name"
            />
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <select
                value={editGroupCurrency}
                onChange={e => setEditGroupCurrency(e.target.value)}
                style={{ background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'white', fontSize: '0.9rem', outline: 'none', fontFamily: 'inherit', padding: '0.2rem' }}
              >
                {COMMON_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button 
                onClick={handleUpdateGroupSettings} 
                style={{ background: 'var(--text-accent)', color: 'black', border: 'none', cursor: 'pointer', padding: '0.2rem 0.75rem', fontWeight: 'bold' }}
              >
                SAVE
              </button>
              <button 
                onClick={() => setEditingGroupId(false)} 
                style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer', fontSize: '0.8rem' }}
              >
                CANCEL
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 className="np-title" style={{ margin: 0, border: 'none' }}>{group.name}</h1>
            <button onClick={() => { setEditGroupName(group.name); setEditGroupCurrency(group.currency); setEditingGroupId(true); }} style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}>✏️</button>
          </div>
        )}
        <BackButton fallback="/dashboard" />
      </div>

      <div className="np-section" style={{ padding: '1rem' }}>
        <p className="np-text-muted" style={{ fontSize: '0.85rem' }}>Currency: {group.currency}</p>
        <p className="np-text-muted" style={{ fontSize: '0.85rem' }}>Members: {members.length}</p>
        
        {(!showAddExpense && !showAddMember && !showAddSettlement) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
            <NeoButton variant="primary" onClick={() => setShowAddExpense(true)}>Add Expense</NeoButton>
            <NeoButton style={{ borderColor: 'var(--text-accent)', color: 'var(--text-accent)' }} onClick={() => setShowAddSettlement(true)}>Settle Up</NeoButton>
            <NeoButton style={{ gridColumn: 'span 2', borderColor: 'var(--text-secondary)', color: 'var(--text-secondary)' }} onClick={() => setShowAddMember(true)}>Invite Member</NeoButton>
          </div>
        )}
      </div>

      {showAddMember && (
        <div className="np-section" style={{ borderStyle: 'solid', borderColor: 'var(--text-accent)' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', textTransform: 'uppercase' }}>Invite Member</h2>
          <form onSubmit={handleAddMember} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input 
              type="email" 
              required 
              placeholder="user@example.com" 
              value={newMemberEmail} 
              onChange={e => setNewMemberEmail(e.target.value)}
              style={{ padding: '0.75rem', background: 'var(--bg-dark)', border: '2px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none' }}
            />
            <div style={{ display: 'flex', gap: '1rem' }}>
              <NeoButton type="submit" variant="primary" style={{ flex: 1 }} disabled={memberLoading}>
                {memberLoading ? 'Inviting...' : 'Add via Email'}
              </NeoButton>
              <NeoButton type="button" onClick={() => setShowAddMember(false)} disabled={memberLoading}>
                Cancel
              </NeoButton>
            </div>
          </form>
        </div>
      )}

      {showAddExpense && (
        <AddExpense 
          groupId={group.id} 
          members={members} 
          onComplete={handleExpenseSaved} 
          onCancel={() => setShowAddExpense(false)} 
        />
      )}

      {showAddSettlement && (
        <AddSettlement 
          groupId={group.id} 
          members={members} 
          onComplete={handleSettlementSaved} 
          onCancel={() => setShowAddSettlement(false)} 
        />
      )}

      <div className="np-grid-desktop">
        
        {/* Left Column: People & Accounting */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="np-section" style={{ borderStyle: 'dashed', marginBottom: 0 }}>
            <div className="np-flex-between" style={{ marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.1rem', margin: 0, textTransform: 'uppercase' }}>Members</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {members.map(m => {
                const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
                const label = profile?.display_name || profile?.email || m.user_id || 'Unknown';
                return (
                  <div key={m.user_id} className="np-flex-between" style={{ padding: '0.5rem', borderBottom: '1px solid #333' }}>
                    <span>{label}</span>
                    <button 
                      onClick={() => handleRemoveMember(m.user_id)} 
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-danger)', cursor: 'pointer', fontSize: '1.2rem', padding: '0' }} 
                      title="Remove Member"
                    >
                      🗑️
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="np-section" style={{ borderStyle: 'dashed', marginBottom: 0 }}>
            <div className="np-flex-between" style={{ marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.1rem', margin: 0, textTransform: 'uppercase' }}>Balances</h2>
            </div>
            {balances.length === 0 ? (
              <p className="np-text-muted" style={{ textAlign: 'center' }}>No balances recorded yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {balances.map((b: any, idx: number) => {
                  const amt = Number(b.balance);
                  const isPositive = amt > 0;
                  const isZero = amt === 0;
                  return (
                    <div key={idx} className="np-flex-between" style={{ padding: '0.5rem', borderBottom: '1px solid #333' }}>
                      <span>{b.profiles?.display_name || b.profiles?.email || 'Unknown'}</span>
                      <span style={{ 
                        fontWeight: 'bold', 
                        color: isZero ? 'var(--text-secondary)' : (isPositive ? 'var(--text-accent)' : 'var(--text-danger)') 
                      }}>
                        {isPositive ? '+' : ''}{amt.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {balances.length > 0 && balances.some(b => Number(b.balance) !== 0) && (
            <div className="np-section" style={{ borderStyle: 'dotted', borderColor: 'var(--text-accent)', marginBottom: 0 }}>
              <h2 style={{ fontSize: '1rem', marginBottom: '1rem', textTransform: 'uppercase', color: 'var(--text-accent)' }}>How to Settle Up</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {(() => {
                  const debtors = balances.filter(b => Number(b.balance) < -0.001).map(b => ({ ...b, amount: Math.abs(Number(b.balance)) })).sort((a,b) => b.amount - a.amount);
                  const creditors = balances.filter(b => Number(b.balance) > 0.001).map(b => ({ ...b, amount: Number(b.balance) })).sort((a,b) => b.amount - a.amount);
                  
                  const optimized = [];
                  let d = 0, c = 0;
                  
                  while(d < debtors.length && c < creditors.length) {
                    const debtor = debtors[d];
                    const creditor = creditors[c];
                    const settleAmt = Math.min(debtor.amount, creditor.amount);
                    
                    if (settleAmt > 0.001) {
                      optimized.push({
                        from: debtor.profiles?.display_name || debtor.profiles?.email || 'Someone',
                        to: creditor.profiles?.display_name || creditor.profiles?.email || 'Someone',
                        amount: settleAmt
                      });
                    }
                    
                    debtor.amount -= settleAmt;
                    creditor.amount -= settleAmt;
                    
                    if (debtor.amount < 0.001) d++;
                    if (creditor.amount < 0.001) c++;
                  }
                  
                  if (optimized.length === 0) return <p className="np-text-muted" style={{ fontSize: '0.85rem' }}>All debts are incredibly small penny balances.</p>;
                  
                  return optimized.map((opt, idx) => (
                    <div key={idx} className="np-flex-between" style={{ padding: '0.5rem', background: 'var(--bg-dark)', borderLeft: '3px solid var(--text-accent)' }}>
                      <span style={{ fontSize: '0.9rem' }}>
                        <strong style={{ color: 'var(--text-danger)' }}>{opt.from}</strong> owes <strong style={{ color: 'var(--text-accent)' }}>{opt.to}</strong>
                      </span>
                      <span style={{ fontWeight: 'bold' }}>
                        {group.currency} {opt.amount.toFixed(2)}
                      </span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Ledger History */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="np-section" style={{ borderStyle: 'dashed', marginBottom: 0 }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', textTransform: 'uppercase' }}>Recent Expenses</h2>
            {expenses.length === 0 ? (
              <p className="np-text-muted" style={{ textAlign: 'center' }}>No expenses logged.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '450px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                {expenses.map((e: any) => (
                  <div key={e.id} className="np-flex-between" style={{ padding: '0.5rem', borderBottom: '1px solid #333' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, marginRight: '1rem' }}>
                      {editingExpenseId === e.id ? (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input 
                            value={editExpenseDesc}
                            onChange={ev => setEditExpenseDesc(ev.target.value)}
                            maxLength={30}
                            style={{ background: 'transparent', border: '1px solid var(--text-accent)', color: 'white', flex: 1, outline: 'none', fontSize: '0.9rem', width: '100%', fontFamily: 'inherit' }}
                            autoFocus
                          />
                          <button onClick={() => handleUpdateExpenseDesc(e.id)} style={{ background: 'transparent', color: 'var(--text-accent)', border: 'none', cursor: 'pointer' }}>✓</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 'bold' }}>{e.description}</span>
                          <button onClick={() => { setEditExpenseDesc(e.description); setEditingExpenseId(e.id); }} style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer', padding: 0 }} title="Edit Description">✏️</button>
                        </div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.25rem' }}>
                        {e.payments && e.payments.length === 1 && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            Paid by {e.payments[0].profiles?.display_name || e.payments[0].profiles?.email || 'Someone'}
                          </span>
                        )}
                        {e.payments && e.payments.length > 1 && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            Paid by {e.payments.length} people
                          </span>
                        )}
                        <span className="np-text-muted" style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
                          {new Date(e.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 'bold', marginRight: '0.5rem' }}>{group.currency} {Number(e.amount).toFixed(2)}</span>
                      <button onClick={() => handleDeleteExpense(e.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-danger)', cursor: 'pointer', fontSize: '1.2rem', padding: '0' }} title="Delete Expense">
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="np-section" style={{ borderStyle: 'dashed', marginBottom: 0 }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', textTransform: 'uppercase', color: 'var(--text-accent)' }}>Settlements</h2>
            {settlements.length === 0 ? (
              <p className="np-text-muted" style={{ textAlign: 'center' }}>No settlements yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '350px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                {settlements.map((s: any) => {
                  const fromName = members.find(m => m.user_id === s.from_user_id)?.profiles?.display_name || 'Someone';
                  const toName = members.find(m => m.user_id === s.to_user_id)?.profiles?.display_name || 'Someone';
                  
                  return (
                    <div key={s.id} className="np-flex-between" style={{ padding: '0.5rem', borderBottom: '1px solid #333' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, marginRight: '1rem' }}>
                        <span style={{ fontWeight: 'bold' }}>{fromName} paid {toName}</span>
                        <span className="np-text-muted" style={{ fontSize: '0.8rem' }}>
                          {new Date(s.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 'bold', color: 'var(--text-accent)', marginRight: '0.5rem' }}>
                          {group.currency} {Number(s.amount).toFixed(2)}
                        </span>
                        <button onClick={() => handleDeleteSettlement(s.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-danger)', cursor: 'pointer', fontSize: '1.2rem', padding: '0' }} title="Delete Settlement">
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>

      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
         <NeoButton 
           variant="danger" 
           style={{ width: '100%' }}
           onClick={handleDeleteGroup}
         >
           Delete Group Permanently
         </NeoButton>
      </div>

    </div>
  );
}
