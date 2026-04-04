import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchGroupDetails, fetchGroupMembers, fetchGroupBalances, fetchRecentExpenses, addMemberByEmail, deleteExpense, updateGroupSettings, removeMember, deleteGroup, fetchExpenseCount, createGroupInvite, fetchMoreExpenses } from '../lib/api';
import { getExpensesCached, updateCachedGroupStanding } from '../lib/db';
import { supabase } from '../lib/supabase';
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
  
  const [expenseCount, setExpenseCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [showAddSettlement, setShowAddSettlement] = useState(false);
  
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [memberLoading, setMemberLoading] = useState(false);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupCurrency, setEditGroupCurrency] = useState('INR');

  const COMMON_CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'AED', 'SGD', 'CHF'];

  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [editingSettlement, setEditingSettlement] = useState<any>(null);
  const [viewingExpense, setViewingExpense] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'expenses' | 'balances' | 'management'>('expenses');
  const [quickSettle, setQuickSettle] = useState<{from: string, to: string, amount: number} | null>(null);
  const [inviteLink, setInviteLink] = useState('');

  useEffect(() => {
    if (id) {
      loadGroupData(id);
    }
  }, [id]);

  const [currentUserId, setCurrentUserId] = useState<string>('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id);
    });
  }, []);

  const summarizeExpenseForUser = (expense: any) => {
    if (!currentUserId) return null;
    const paid = expense.payments?.find((p: any) => p.user_id === currentUserId)?.amount_paid || 0;
    const owed = expense.splits?.find((s: any) => s.user_id === currentUserId)?.amount_owed || 0;
    const net = paid - owed;

    if (net > 0) return <span style={{ color: 'var(--text-accent)' }}>Owed {net.toFixed(2)}</span>;
    if (net < 0) return <span style={{ color: 'var(--text-danger)' }}>Owe {Math.abs(net).toFixed(2)}</span>;
    if (paid === 0 && owed === 0) return <span className="np-text-muted">Doesn't involve you</span>;
    return <span className="np-text-muted">Settled</span>;
  };

  const getSettlementNameString = (s: any) => {
    // Handle both old settlement table format and new Unified Expense format
    const fromId = s.from_user_id || s.payments?.[0]?.user_id;
    const toId = s.to_user_id || s.splits?.[0]?.user_id;
    
    if (!fromId || !toId) return 'Payment';

    const fromMember = members.find(m => m.user_id === fromId);
    const toMember = members.find(m => m.user_id === toId);
    
    const fromName = fromId === currentUserId ? 'You' : (fromMember?.profiles?.display_name || fromMember?.profiles?.email || 'Unknown').split(' ')[0];
    const toName = toId === currentUserId ? 'You' : (toMember?.profiles?.display_name || toMember?.profiles?.email || 'Unknown').split(' ')[0];
    
    return `${fromName} paid ${toName}`;
  };


  const getPayerNameString = (expense: any) => {
    if (!expense.payments || expense.payments.length === 0) return 'Unknown paid';
    
    if (expense.payments.length === 1 && expense.payments[0].user_id === currentUserId) {
       return 'You paid';
    }

    const payerNames = expense.payments.map((p: any) => {
      if (p.user_id === currentUserId) return 'You';
      const dbProfile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
      const profile = dbProfile || members.find(m => m.user_id === p.user_id)?.profiles;
      const name = profile?.display_name || profile?.email || 'Unknown';
      return name.split(' ')[0];
    });
    
    if (payerNames.length === 1) return `${payerNames[0]} paid`;
    if (payerNames.length === 2) return `${payerNames[0]} and ${payerNames[1]} paid`;
    return `${payerNames.length} people paid`;
  };

  const loadGroupData = async (groupId: string) => {
    // 1. Instant Load from Cache (SWR)
    getExpensesCached(groupId, 20).then(cached => {
      if (cached && cached.length > 0) {
        setExpenses(cached);
      }
    }).catch(err => {
      console.warn('Cache load failed, bypassing to network:', err);
    });

    try {
      const gData = await fetchGroupDetails(groupId);
      setGroup(gData);
      
      const [mData, bData, eData, countTemp] = await Promise.all([
        fetchGroupMembers(groupId),
        fetchGroupBalances(groupId),
        fetchRecentExpenses(groupId, 20),
        fetchExpenseCount(groupId)
      ]);
      
      setMembers(mData);
      setBalances(bData);
      setExpenses(eData);
      setExpenseCount(countTemp);
      setHasMore(countTemp > eData.length);

      // Sync this specific group's standing to the global dashboard cache
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const myBalance = bData.find((b: any) => b.user_id === user.id)?.balance || 0;
        await updateCachedGroupStanding(groupId, myBalance);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLoadMore = async () => {
    if (!id || !hasMore) return;
    try {
      const more = await fetchMoreExpenses(id, expenses.length, 20);
      const newExpenses = [...expenses, ...more];
      setExpenses(newExpenses);
      setHasMore(expenseCount > newExpenses.length);
    } catch (err) {
      console.error('Load more failed:', err);
    }
  };

  const handleExpenseSaved = (newExpense: any) => {
    setShowAddExpense(false);
    setEditingExpense(null);
    
    // Optimistic UI update
    setExpenses(prev => {
      const exists = prev.find(e => e.id === newExpense.id);
      if (exists) {
        return prev.map(e => e.id === newExpense.id ? newExpense : e);
      }
      return [newExpense, ...prev];
    });

    // Still sync balances/count in background
    if (id) {
       fetchGroupBalances(id).then(setBalances);
       fetchExpenseCount(id).then(setExpenseCount);
    }
    
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
      
      if (invite.reused) {
        alert('Active link found! Reusing existing invite link (One link per user per 12h allowed). Copied to clipboard!');
      } else {
        alert('Expirable invite link created and copied to clipboard! (Valid for 24h). Next fresh link available in 12h.');
      }
    } catch (err: any) {
      alert('Failed to obtain invite link');
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



  const [timedOut, setTimedOut] = useState(false);
  const [minLoaded, setMinLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTimedOut(true);
    }, 10000); // 10 second grace period
    
    const minTimer = setTimeout(() => {
      setMinLoaded(true);
    }, 500); // Pulse for at least 500ms for aesthetic feel

    return () => {
      clearTimeout(timer);
      clearTimeout(minTimer);
    };
  }, []);

  if (!group || !minLoaded) {
    if (!timedOut) {
      return (
        <div className="np-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <div style={{ marginBottom: '2rem', animation: 'pulse 2s infinite' }}>
            <svg width="60" height="60" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 14V5C4 4.44772 4.44772 4 5 4H19C19.5523 4 20 4.44772 20 5V43C20 43.5523 19.5523 44 19 44H5C4.44772 44 4 43.5523 4 43V34" stroke="var(--text-accent)" strokeWidth="4" strokeLinecap="round"/>
              <path d="M44 34V43C44 43.5523 43.5523 44 43 44H29C28.4477 44 28 43.5523 28 43V5C28 4.44772 28.4477 4 29 4H43C43.5523 4 44 4.44772 44 5V14" stroke="var(--text-accent)" strokeWidth="4" strokeLinecap="round"/>
              <path d="M28 24L44 24.0132" stroke="var(--text-primary)" strokeWidth="4" strokeLinecap="round"/>
              <path d="M4 24.0132L20 24" stroke="var(--text-primary)" strokeWidth="4" strokeLinecap="round"/>
            </svg>
          </div>
          <p className="np-title" style={{ border: 'none', fontSize: '1.1rem', color: 'var(--text-secondary)' }}>Synchronizing Ledger...</p>
        </div>
      );
    }

    if (!group) {
      return (
        <div className="np-container" style={{ textAlign: 'center', paddingTop: '5rem' }}>
          <p className="np-text-danger" style={{ fontSize: '1.2rem', marginBottom: '1.5rem', fontWeight: 'bold' }}>Group inaccessible or unavailable</p>
          <p className="np-text-muted" style={{ marginBottom: '2rem' }}>This group might have been deleted or you don't have permission to view it.</p>
          <BackButton fallback="/dashboard" />
        </div>
      );
    }
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

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '2px solid var(--border-color)', flexWrap: 'wrap' }}>
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
            fontSize: '0.85rem',
            textTransform: 'uppercase'
          }}
        >
          Expenses
        </button>
        <button 
          onClick={() => setActiveTab('balances')}
          style={{ 
            padding: '0.75rem 1rem', 
            background: activeTab === 'balances' ? 'var(--bg-dark)' : 'transparent', 
            color: activeTab === 'balances' ? 'var(--text-accent)' : 'var(--text-secondary)',
            border: 'none',
            borderBottom: activeTab === 'balances' ? '3px solid var(--text-accent)' : '3px solid transparent',
            fontWeight: 'bold',
            cursor: 'pointer',
            fontSize: '0.85rem',
            textTransform: 'uppercase'
          }}
        >
          Balances
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
            fontSize: '0.85rem',
            textTransform: 'uppercase'
          }}
        >
          Management
        </button>
      </div>

      {activeTab === 'expenses' && (
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
                onComplete={(exp: any) => handleExpenseSaved(exp)} 
                onCancel={() => { setShowAddExpense(false); setEditingExpense(null); }} 
                editExpenseId={editingExpense?.id}
                initialData={editingExpense}
              />
            )}

            {editingSettlement && (
              <AddSettlement 
                groupId={id!}
                members={members}
                editId={editingSettlement.id}
                initialFromId={editingSettlement.payments?.[0]?.user_id}
                initialToId={editingSettlement.splits?.[0]?.user_id}
                initialAmount={editingSettlement.amount}
                onComplete={() => { setEditingSettlement(null); loadGroupData(id!); }}
                onCancel={() => setEditingSettlement(null)}
              />
            )}
          </div>

          <div style={{ marginTop: '1.5rem', marginBottom: '3rem' }}>
            <div className="np-section" style={{ borderStyle: 'dashed', width: '100%' }}>
              <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', textTransform: 'uppercase' }}>History</h2>
              {expenses.length === 0 ? (
                <p className="np-text-muted" style={{ textAlign: 'center' }}>No expenses logged.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
                  {expenses.map((e: any) => {
                    const isSettlement = e.is_settlement === true;
                    return (
                      <div 
                        key={e.id} 
                        className="np-flex-between" 
                        onClick={() => setViewingExpense(e)}
                        style={{ 
                          padding: isSettlement ? '0.5rem' : '0.75rem 0.5rem', 
                          borderBottom: '1px solid #333', 
                          cursor: 'pointer', 
                          transition: 'background 0.2s',
                          color: isSettlement ? 'var(--text-accent)' : 'inherit'
                        }}
                        onMouseEnter={(evt) => evt.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                        onMouseLeave={(evt) => evt.currentTarget.style.background = 'transparent'}
                      >
                        {isSettlement ? (
                          <div 
                            style={{ 
                              width: '100%', 
                              fontSize: '0.8rem', 
                              fontWeight: 'bold', 
                              color: 'var(--text-accent)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                          >
                          <span>
                            {getSettlementNameString(e)} | {new Date(e.created_at).toLocaleDateString()}
                          </span>
                          <span>
                            {group.currency} {Number(e.amount).toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, marginRight: '1rem' }}>
                            <span style={{ fontWeight: 'bold' }}>{e.description}</span>
                            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginTop: '0.1rem' }}>
                              <span className="np-text-muted" style={{ fontSize: '0.75rem' }}>{getPayerNameString(e)}</span>
                              <span className="np-text-muted" style={{ fontSize: '0.75rem' }}>•</span>
                              <span className="np-text-muted" style={{ fontSize: '0.75rem' }}>{new Date(e.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontWeight: 'bold' }}>{group.currency} {Number(e.amount).toFixed(2)}</span>
                              <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>›</span>
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{summarizeExpenseForUser(e)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  ); })}
                  
                  {hasMore && (
                    <NeoButton 
                      variant="default" 
                      onClick={(evt: any) => { evt.stopPropagation(); handleLoadMore(); }} 
                      style={{ marginTop: '1rem', width: '100%', fontSize: '0.8rem', borderColor: '#333' }}
                    >
                      Load More Transactions ({expenseCount - expenses.length} remaining)
                    </NeoButton>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'balances' && (
        <>
          <div className="np-grid-desktop">
            <div className="np-section" style={{ borderStyle: 'dashed' }}>
              <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', textTransform: 'uppercase' }}>Member Balances</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {balances.map((b: any, idx: number) => {
                  const amt = Number(b.balance);
                  const member = members.find(m => m.user_id === b.user_id);
                  return (
                    <div key={idx} className="np-flex-between" style={{ padding: '0.5rem', borderBottom: '1px solid #333' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                         <span>{member?.profiles?.display_name || member?.profiles?.email || 'Unknown User'}</span>
                         <span className="np-text-muted" style={{ fontSize: '0.7rem' }}>{member?.profiles?.email || 'No email registered'}</span>
                      </div>
                      <span style={{ fontWeight: 'bold', color: amt === 0 ? 'var(--text-secondary)' : (amt > 0 ? 'var(--text-accent)' : 'var(--text-danger)') }}>
                        {amt > 0 ? '+' : ''}{amt.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="np-section" style={{ borderStyle: 'dotted', borderColor: 'var(--text-accent)', background: 'rgba(0,183,114,0.03)' }}>
              <h2 style={{ fontSize: '1.0rem', marginBottom: '1.5rem', textTransform: 'uppercase', color: 'var(--text-accent)', letterSpacing: '1px' }}>
                Quick Settle Suggestions
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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

                  if (results.length === 0) return (
                    <div style={{ textAlign: 'center', padding: '1rem', background: 'rgba(0,0,0,0.2)', border: '1px dashed #333' }}>
                      <p className="np-text-muted" style={{ margin: 0 }}>Everyone is settled! ✔</p>
                    </div>
                  );

                  return results.map((r, i) => {
                    const fromProfile = members.find(m => m.user_id === r.from.user_id)?.profiles;
                    const toProfile = members.find(m => m.user_id === r.to.user_id)?.profiles;
                    
                    return (
                      <div 
                        key={i} 
                        style={{ 
                          padding: '1.25rem', 
                          background: 'var(--bg-dark)', 
                          border: '1px solid rgba(255,255,255,0.05)',
                          borderRadius: '8px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '1rem'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.95rem', color: 'white' }}>
                          <span style={{ fontWeight: 'bold' }}>{fromProfile?.display_name || 'User'}</span>
                          <span style={{ fontSize: '0.8rem', opacity: 0.5, marginLeft: '0.2rem' }}>pays</span>
                          <span style={{ opacity: 0.3 }}>→</span>
                          <span style={{ fontWeight: 'bold' }}>{toProfile?.display_name || 'User'}</span>
                        </div>
                        
                        <div className="np-flex-between">
                          <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-accent)' }}>
                            {group.currency} {r.amount.toFixed(2)}
                          </span>
                          
                          <button 
                            onClick={() => { 
                              setQuickSettle({ from: r.from.user_id, to: r.to.user_id, amount: Number(r.amount) }); 
                              setShowAddSettlement(true); 
                            }}
                            className="np-btn"
                            style={{ 
                              background: 'var(--text-accent)', 
                              color: 'black', 
                              border: 'none', 
                              padding: '0.5rem 1rem', 
                              fontWeight: 'bold', 
                              cursor: 'pointer', 
                              fontSize: '0.75rem',
                              borderRadius: '4px',
                              textTransform: 'uppercase'
                            }}
                          >
                            Settle Now ›
                          </button>
                        </div>
                      </div>
                    );
                  });
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
                initialAmount={quickSettle?.amount}
                onComplete={handleSettlementSaved} 
                onCancel={() => { setShowAddSettlement(false); setQuickSettle(null); }} 
              />
            </div>
          )}
        </>
      )}

      {activeTab === 'management' && (
        <div className="np-section" style={{ borderStyle: 'solid', borderColor: '#333' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>⚙ Group Management Zone</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* 1. Administrative Actions */}
            <div>
              <p className="np-text-muted" style={{ marginBottom: '1.5rem', fontSize: '0.8rem' }}>ADMINISTRATIVE ACTIONS</p>
              
              {/* Add via Email Flow */}
              <div style={{ marginBottom: '2rem', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderLeft: '3px solid var(--text-accent)' }}>
                <p className="np-text-muted" style={{ fontSize: '0.75rem', marginBottom: '0.75rem', lineHeight: '1.4' }}>
                  If you know your friend's <strong>bantLo email</strong>, you can add them directly without creating an invite link.
                </p>
                {!showAddMember ? (
                  <NeoButton variant="primary" onClick={() => setShowAddMember(true)} style={{ width: '100%', height: '2.5rem', fontSize: '0.85rem' }}>+ Add via email</NeoButton>
                ) : (
                  <form onSubmit={handleAddMember}>
                     <input 
                        type="email" 
                        required 
                        placeholder="Friend's email..." 
                        value={newMemberEmail} 
                        onChange={e => setNewMemberEmail(e.target.value)}
                        style={{ width: '100%', padding: '0.75rem', marginBottom: '0.5rem', background: 'var(--bg-dark)', border: '2px solid var(--border-color)', color: 'white' }}
                      />
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <NeoButton type="submit" variant="primary" style={{ flex: 1 }} disabled={memberLoading}>Add Member</NeoButton>
                        <NeoButton type="button" onClick={() => setShowAddMember(false)}>Cancel</NeoButton>
                      </div>
                  </form>
                )}
              </div>

              {/* Invite Link Flow */}
              <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderLeft: '3px solid var(--text-secondary)' }}>
                <p className="np-text-muted" style={{ fontSize: '0.75rem', marginBottom: '0.75rem', lineHeight: '1.4' }}>
                  If they don't have a bantLo account or you don't know their email, you can create an invite link.
                </p>
                <NeoButton onClick={handleGenerateInvite} style={{ width: '100%', height: '2.5rem', fontSize: '0.85rem', borderColor: 'var(--border-color)' }}>
                  {inviteLink ? 'Regenerate Invite Link' : 'Generate Invite Link'}
                </NeoButton>
                {inviteLink && (
                  <div style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.3)', border: '1px dashed var(--text-accent)', fontSize: '0.7rem', overflowWrap: 'break-word', color: 'var(--text-accent)', marginTop: '0.5rem' }}>
                    {inviteLink}
                  </div>
                )}
                <p className="np-text-muted" style={{ fontSize: '0.65rem', marginTop: '0.5rem' }}>Links expire automatically after 24 hours.</p>
              </div>
            </div>

            {/* 2. Update Group Settings */}
            <div style={{ borderTop: '1px solid #333', paddingTop: '1.5rem' }}>
              <p className="np-text-muted" style={{ marginBottom: '1rem', fontSize: '0.8rem' }}>UPDATE GROUP NAME</p>
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
                <NeoButton onClick={handleUpdateGroupSettings} variant="primary" style={{ height: '3rem' }}>Update Group Settings</NeoButton>
              </div>
            </div>

            {/* 3. Existing Members */}
            <div style={{ borderTop: '1px solid #333', paddingTop: '1.5rem' }}>
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

            {/* 4. Danger Zone */}
            <div style={{ marginTop: '1rem', borderTop: '2px solid var(--text-danger)', paddingTop: '1.5rem' }}>
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
        </div>
      )}

      {/* Transaction Detail Overlay */}
      {viewingExpense && (
        <div 
          style={{ 
            position: 'fixed', 
            top: 0, left: 0, width: '100%', height: '100%', 
            background: 'rgba(0,0,0,0.85)', 
            backdropFilter: 'blur(4px)',
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            zIndex: 1000,
            padding: '1rem'
          }}
          onClick={() => setViewingExpense(null)}
        >
          <div 
            className="np-section" 
            style={{ 
              maxWidth: '450px', 
              width: '100%', 
              background: 'var(--bg-dark)', 
              border: '4px solid var(--border-color)', 
              boxShadow: '10px 10px 0px black',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', margin: '0 0 0.5rem 0', textTransform: 'uppercase', color: 'var(--text-accent)' }}>{viewingExpense.description}</h2>
                <p className="np-text-muted" style={{ fontSize: '0.8rem', margin: 0 }}>Logged on {new Date(viewingExpense.created_at).toLocaleString()}</p>
              </div>
              <button 
                onClick={() => setViewingExpense(null)}
                style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer', padding: '0.5rem' }}
              >
                ✖
              </button>
            </div>

            <div style={{ padding: '1rem', background: 'var(--bg-dark)', border: '2px solid var(--border-color)', marginBottom: '1.5rem' }}>
              <p className="np-text-muted" style={{ fontSize: '0.8rem', margin: '0 0 0.5rem 0' }}>TOTAL LOGGED</p>
              <h3 style={{ fontSize: '2rem', margin: 0, fontWeight: 900 }}>{group.currency} {Number(viewingExpense.amount).toFixed(2)}</h3>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-accent)' }}>
                Split Logic: {viewingExpense.split_type === 0 ? 'Equal' : (viewingExpense.split_type === 1 ? 'Exact' : 'By Shares')}
              </p>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '0.75rem', color: 'var(--text-accent)', borderBottom: '1px solid #333', paddingBottom: '0.4rem' }}>Funding (Who Paid)</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {viewingExpense.payments?.map((p: any, idx: number) => {
                  const dbProfile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
                  const profile = dbProfile || members.find(m => m.user_id === p.user_id)?.profiles;
                  return (
                    <div key={idx} className="np-flex-between" style={{ fontSize: '0.9rem' }}>
                      <span>{profile?.display_name || profile?.email || 'Unknown'}</span>
                      <span style={{ fontWeight: 'bold' }}>+ {Number(p.amount_paid).toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '0.75rem', color: 'var(--text-secondary)', borderBottom: '1px solid #333', paddingBottom: '0.4rem' }}>Distribution (Who Owes)</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {viewingExpense.splits?.map((s: any, idx: number) => {
                  const dbProfile = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
                  const profile = dbProfile || members.find(m => m.user_id === s.user_id)?.profiles;
                  return (
                    <div key={idx} className="np-flex-between" style={{ fontSize: '0.9rem' }}>
                      <span>{profile?.display_name || profile?.email || 'Unknown'}</span>
                      <span style={{ fontWeight: 'bold', color: 'var(--text-danger)' }}>- {Number(s.amount_owed).toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <NeoButton 
                onClick={() => { 
                  if (viewingExpense.is_settlement) {
                    setEditingSettlement(viewingExpense);
                  } else {
                    setEditingExpense(viewingExpense); 
                    setShowAddExpense(true); 
                  }
                  setViewingExpense(null); 
                }} 
                variant="primary" 
                style={{ flex: 1 }}
              >
                ✎ Edit Record
              </NeoButton>
              <NeoButton 
                onClick={() => { 
                  handleDeleteExpense(viewingExpense.id); 
                  setViewingExpense(null); 
                }} 
                variant="danger" 
                style={{ padding: '0.75rem 1rem' }}
              >
                ✖ Delete
              </NeoButton>
            </div>
          </div>
        </div>
      )}
    </div>

  );
}
