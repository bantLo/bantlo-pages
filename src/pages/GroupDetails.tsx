import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchGroupDetails, fetchGroupMembers, fetchGroupBalances, fetchRecentExpenses, addMemberByEmail, deleteExpense, updateGroupSettings, removeMember, deleteGroup, fetchExpenseCount, fetchRecentSettlements, deleteSettlement, createGroupInvite } from '../lib/api';
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
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupCurrency, setEditGroupCurrency] = useState('INR');

  const COMMON_CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'AED', 'SGD', 'CHF'];

  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'expenses' | 'management'>('expenses');
  const [quickSettle, setQuickSettle] = useState<{from: string, to: string} | null>(null);
  const [inviteLink, setInviteLink] = useState('');

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
    setEditingExpense(null);
    if (id) loadGroupData(id);
    alert('Expense successfully saved!');
  };

  const handleSettlementSaved = () => {
    setShowAddSettlement(false);
    setQuickSettle(null);
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
    const isLast = members.length === 1;
    const balance = balances.find(b => b.user_id === userId)?.balance || 0;
    
    if (!isLast && Math.abs(Number(balance)) > 0.01) {
      alert(`Cannot remove/leave. This user has an active balance of ${group.currency} ${Number(balance).toFixed(2)}. All debts must be settled (exactly 0.00) first.`);
      return;
    }

    const msg = isLast 
      ? 'WARNING: You are the last member. Leaving will permanently DELETE this group and all its data. Proceed?'
      : 'Remove this member from the group?';
      
    if (!id || !window.confirm(msg)) return;
    
    try {
      if (isLast) {
        await deleteGroup(id);
        navigate('/dashboard');
      } else {
        await removeMember(id, userId);
        loadGroupData(id);
      }
    } catch(err: any) {
      alert('Action failed: ' + err.message);
    }
  };

  const handleGenerateInvite = async () => {
    try {
      const invite = await createGroupInvite(id!);
      const link = `${window.location.origin}/join/${invite.id}`;
      setInviteLink(link);
      navigator.clipboard.writeText(link);
      alert('Invite link created and copied to clipboard! (Valid for 24h)');
    } catch (err: any) {
      alert('Failed to create invite link');
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
    if (!editGroupName.trim()) return;
    try {
      await updateGroupSettings(id!, { name: editGroupName, currency: editGroupCurrency });
      setGroup({ ...group, name: editGroupName, currency: editGroupCurrency });
      alert('Settings updated!');
    } catch(err) {
      alert('Failed to update group settings');
    }
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
        <h1 className="np-title" style={{ margin: 0, border: 'none' }}>{group.name}</h1>
        <BackButton fallback="/dashboard" />
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '2px solid var(--border-color)' }}>
        <button 
          onClick={() => setActiveTab('expenses')}
          style={{ 
            padding: '0.75rem 1rem', 
            background: activeTab === 'expenses' ? 'var(--bg-dark)' : 'transparent', 
            color: activeTab === 'expenses' ? 'var(--text-accent)' : 'var(--text-secondary)',
            border: 'none',
            borderBottom: activeTab === 'expenses' ? '3px solid var(--text-accent)' : '3px solid transparent',
            fontWeight: 'bold',
            cursor: 'pointer',
            fontSize: '0.9rem',
            textTransform: 'uppercase'
          }}
        >
          Expenses
        </button>
        <button 
          onClick={() => setActiveTab('management')}
          style={{ 
            padding: '0.75rem 1rem', 
            background: activeTab === 'management' ? 'var(--bg-dark)' : 'transparent', 
            color: activeTab === 'management' ? 'var(--text-accent)' : 'var(--text-secondary)',
            border: 'none',
            borderBottom: activeTab === 'management' ? '3px solid var(--text-accent)' : '3px solid transparent',
            fontWeight: 'bold',
            cursor: 'pointer',
            fontSize: '0.9rem',
            textTransform: 'uppercase'
          }}
        >
          Management
        </button>
      </div>

      {activeTab === 'expenses' ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
            {!showAddExpense && (
              <NeoButton variant="primary" onClick={() => setShowAddExpense(true)} style={{ width: '100%' }}>
                + Add Expense
              </NeoButton>
            )}
            
            {showAddExpense && (
              <AddExpense 
                groupId={id!} 
                members={members} 
                onComplete={handleExpenseSaved} 
                onCancel={() => { setShowAddExpense(false); setEditingExpense(null); }} 
                editExpenseId={editingExpense?.id}
                initialData={editingExpense}
              />
            )}
          </div>

          <div className="np-grid-desktop">
            <div className="np-section" style={{ borderStyle: 'dashed' }}>
              <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', textTransform: 'uppercase' }}>Recent Records</h2>
              {expenses.length === 0 ? (
                <p className="np-text-muted" style={{ textAlign: 'center' }}>No expenses logged.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '500px', overflowY: 'auto' }}>
                  {expenses.map((e: any) => (
                    <div key={e.id} className="np-flex-between" style={{ padding: '0.5rem', borderBottom: '1px solid #333' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, marginRight: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 'bold' }}>{e.description}</span>
                          <button 
                            onClick={() => { setEditingExpense(e); setShowAddExpense(true); }} 
                            style={{ background: 'transparent', color: 'var(--text-accent)', border: 'none', cursor: 'pointer', padding: 0 }} 
                            title="Edit"
                          >
                            ✎
                          </button>
                        </div>
                        <span className="np-text-muted" style={{ fontSize: '0.7rem' }}>{new Date(e.created_at).toLocaleDateString()}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 'bold' }}>{group.currency} {Number(e.amount).toFixed(2)}</span>
                        <button onClick={() => handleDeleteExpense(e.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-danger)', cursor: 'pointer', fontSize: '1.2rem' }}>✖</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="np-section" style={{ borderStyle: 'dashed' }}>
              <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Payment History</h2>
              {settlements.length === 0 ? (
                 <p className="np-text-muted" style={{ textAlign: 'center' }}>No payments yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {settlements.map((s: any) => (
                    <div key={s.id} className="np-flex-between" style={{ padding: '0.5rem', borderBottom: '1px solid #333' }}>
                      <span style={{ fontSize: '0.9rem' }}>Record › {Number(s.amount).toFixed(2)}</span>
                      <button onClick={() => handleDeleteSettlement(s.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-danger)', cursor: 'pointer', fontSize: '1.2rem' }}>✖</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="np-grid-desktop">
            <div className="np-section" style={{ borderStyle: 'dashed' }}>
              <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', textTransform: 'uppercase' }}>Member Balances</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {balances.map((b: any, idx: number) => {
                  const amt = Number(b.balance);
                  return (
                    <div key={idx} className="np-flex-between" style={{ padding: '0.5rem', borderBottom: '1px solid #333' }}>
                      <span>{b.profiles?.display_name || b.profiles?.email || 'Unknown'}</span>
                      <span style={{ fontWeight: 'bold', color: amt === 0 ? 'var(--text-secondary)' : (amt > 0 ? 'var(--text-accent)' : 'var(--text-danger)') }}>
                        {amt > 0 ? '+' : ''}{amt.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="np-section" style={{ borderStyle: 'dotted', borderColor: 'var(--text-accent)' }}>
              <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', textTransform: 'uppercase', color: 'var(--text-accent)' }}>Quick Settle Suggestions</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {(() => {
                  const debtors = balances.filter(b => Number(b.balance) < -0.01).map(b => ({ ...b, amount: Math.abs(Number(b.balance)) }));
                  const creditors = balances.filter(b => Number(b.balance) > 0.01).map(b => ({ ...b, amount: Number(b.balance) }));
                  
                  const results = [];
                  let d = 0, c = 0;
                  while(d < debtors.length && c < creditors.length) {
                    const amt = Math.min(debtors[d].amount, creditors[c].amount);
                    results.push({ from: debtors[d], to: creditors[c], amount: amt });
                    debtors[d].amount -= amt;
                    creditors[c].amount -= amt;
                    if (debtors[d].amount < 0.01) d++;
                    if (creditors[c].amount < 0.01) c++;
                  }

                  if (results.length === 0) return <p className="np-text-muted">Everyone is settled! ✔</p>;

                  return results.map((r, i) => (
                    <div key={i} className="np-flex-between" style={{ padding: '0.5rem', background: 'var(--bg-dark)', borderLeft: '3px solid var(--text-accent)' }}>
                      <span style={{ fontSize: '0.85rem' }}>{r.from.profiles?.display_name || 'User'} owes {r.to.profiles?.display_name || 'User'}</span>
                      <button 
                        onClick={() => { 
                          setQuickSettle({ from: r.from.user_id, to: r.to.user_id }); 
                          setShowAddSettlement(true); 
                        }}
                        style={{ background: 'var(--text-accent)', color: 'black', border: 'none', padding: '0.2rem 0.5rem', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.75rem' }}
                      >
                        SETTLE › {r.amount.toFixed(2)}
                      </button>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>

          {showAddSettlement && (
            <div style={{ marginTop: '1.5rem' }}>
              <AddSettlement 
                groupId={group.id} 
                members={members} 
                initialFromId={quickSettle?.from}
                initialToId={quickSettle?.to}
                onComplete={handleSettlementSaved} 
                onCancel={() => { setShowAddSettlement(false); setQuickSettle(null); }} 
              />
            </div>
          )}

          <div className="np-section" style={{ marginTop: '2rem', borderStyle: 'solid', borderColor: '#333' }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>⚙ Group Management Zone</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem' }}>
              <div>
                <p className="np-text-muted" style={{ marginBottom: '1rem', fontSize: '0.8rem' }}>CONFIGURE GROUP</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <input 
                    value={editGroupName}
                    onChange={e => setEditGroupName(e.target.value)}
                    placeholder={group.name}
                    style={{ background: 'var(--bg-dark)', border: '2px solid var(--border-color)', color: 'white', padding: '0.75rem', outline: 'none' }}
                  />
                  <select
                    value={editGroupCurrency}
                    onChange={e => setEditGroupCurrency(e.target.value)}
                    style={{ background: 'var(--bg-dark)', border: '2px solid var(--border-color)', color: 'white', padding: '0.75rem', outline: 'none' }}
                  >
                    {COMMON_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <NeoButton onClick={handleUpdateGroupSettings} variant="primary" style={{ height: '3rem' }}>Update General Settings</NeoButton>
                </div>
              </div>

              <div>
                <p className="np-text-muted" style={{ marginBottom: '1rem', fontSize: '0.8rem' }}>ADMINISTRATIVE ACTIONS</p>
                
                <div style={{ marginBottom: '2rem' }}>
                  <NeoButton onClick={handleGenerateInvite} style={{ width: '100%', marginBottom: '0.5rem', borderColor: 'var(--text-accent)' }}>
                    {inviteLink ? 'Regenerate Invite Link' : 'Generate Invite Link'}
                  </NeoButton>
                  {inviteLink && (
                    <div style={{ padding: '0.5rem', background: 'rgba(0,0,0,0.3)', border: '1px dashed var(--text-accent)', fontSize: '0.75rem', overflowWrap: 'break-word', color: 'var(--text-accent)' }}>
                      {inviteLink}
                    </div>
                  )}
                  <p className="np-text-muted" style={{ fontSize: '0.65rem', marginTop: '0.25rem' }}>Links expire automatically after 24 hours.</p>
                </div>

                {!showAddMember ? (
                  <NeoButton onClick={() => setShowAddMember(true)} style={{ width: '100%', marginBottom: '1rem' }}>+ Invite via Email</NeoButton>
                ) : (
                  <form onSubmit={handleAddMember} style={{ marginBottom: '1rem' }}>
                     <input 
                        type="email" 
                        required 
                        placeholder="Invite by email..." 
                        value={newMemberEmail} 
                        onChange={e => setNewMemberEmail(e.target.value)}
                        style={{ width: '100%', padding: '0.75rem', marginBottom: '0.5rem', background: 'var(--bg-dark)', border: '2px solid var(--border-color)', color: 'white' }}
                      />
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <NeoButton type="submit" variant="primary" style={{ flex: 1 }} disabled={memberLoading}>Submit</NeoButton>
                        <NeoButton type="button" onClick={() => setShowAddMember(false)}>Cancel</NeoButton>
                      </div>
                  </form>
                )}

                <div style={{ marginTop: '1rem', borderTop: '1px solid #333', paddingTop: '1rem' }}>
                  <p className="np-text-muted" style={{ marginBottom: '0.5rem', fontSize: '0.7rem' }}>EXISTING MEMBERS</p>
                  <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                    {members.map(m => (
                      <div key={m.user_id} className="np-flex-between" style={{ padding: '0.4rem 0', opacity: 0.8 }}>
                        <span style={{ fontSize: '0.85rem' }}>{m.profiles?.display_name || m.profiles?.email}</span>
                        <button onClick={() => handleRemoveMember(m.user_id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-danger)', fontSize: '0.9rem', cursor: 'pointer' }}>⌧ Remove</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '2.5rem', borderTop: '2px solid var(--text-danger)', paddingTop: '1.5rem' }}>
               <p style={{ color: 'var(--text-danger)', fontSize: '0.85rem', marginBottom: '1rem', fontWeight: 'bold' }}>DANGER ZONE</p>
               <NeoButton 
                 variant="danger" 
                 style={{ width: '100%' }}
                 onClick={handleDeleteGroup}
               >
                 Destroy Group Data Permanently
               </NeoButton>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
