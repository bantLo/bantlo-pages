import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchGroupDetails, fetchGroupMembers, fetchGroupBalances, fetchRecentExpenses, addMemberByEmail, deleteExpense, updateGroupName, updateExpenseDescription } from '../lib/api';
import AddExpense from '../components/AddExpense';
import BackButton from '../components/BackButton';
import NeoButton from '../components/NeoButton';

export default function GroupDetails() {
  const { id } = useParams<{ id: string }>();
  const [group, setGroup] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [memberLoading, setMemberLoading] = useState(false);
  
  const [editingGroupId, setEditingGroupId] = useState(false);
  const [editGroupName, setEditGroupName] = useState('');

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
      
      const [mData, bData, eData] = await Promise.all([
        fetchGroupMembers(groupId),
        fetchGroupBalances(groupId),
        fetchRecentExpenses(groupId)
      ]);
      
      setMembers(mData);
      setBalances(bData);
      setExpenses(eData);
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

  const handleUpdateGroupName = async () => {
    if (!editGroupName.trim()) return setEditingGroupId(false);
    try {
      await updateGroupName(id!, editGroupName);
      setGroup({ ...group, name: editGroupName });
    } catch(err) {
      alert('Failed to update group name');
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
      <div className="np-flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        {editingGroupId ? (
          <div style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
            <input 
              value={editGroupName}
              onChange={e => setEditGroupName(e.target.value)}
              style={{ background: 'transparent', border: '1px solid var(--text-accent)', color: 'white', fontSize: '1.5rem', flex: 1, outline: 'none', fontFamily: 'inherit' }}
              autoFocus
            />
            <button onClick={handleUpdateGroupName} style={{ background: 'transparent', color: 'var(--text-accent)', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>✓</button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 className="np-title" style={{ margin: 0, border: 'none' }}>{group.name}</h1>
            <button onClick={() => { setEditGroupName(group.name); setEditingGroupId(true); }} style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}>✏️</button>
          </div>
        )}
        <BackButton fallback="/dashboard" />
      </div>

      <div className="np-section" style={{ padding: '1rem' }}>
        <p className="np-text-muted" style={{ fontSize: '0.85rem' }}>Currency: {group.currency}</p>
        <p className="np-text-muted" style={{ fontSize: '0.85rem' }}>Members: {members.length}</p>
        
        {(!showAddExpense && !showAddMember) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
            <NeoButton variant="primary" onClick={() => setShowAddExpense(true)}>Add Expense</NeoButton>
            <NeoButton style={{ borderColor: 'var(--text-accent)', color: 'var(--text-accent)' }} onClick={() => setShowAddMember(true)}>Add Member</NeoButton>
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

      <div className="np-section" style={{ borderStyle: 'dashed' }}>
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
                  <span>{b.auth?.email || 'Unknown'}</span>
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
      
      <div className="np-section" style={{ borderStyle: 'dashed' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', textTransform: 'uppercase' }}>Recent Expenses</h2>
        {expenses.length === 0 ? (
          <p className="np-text-muted" style={{ textAlign: 'center' }}>No expenses logged.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
                  <span className="np-text-muted" style={{ fontSize: '0.8rem' }}>
                    {new Date(e.created_at).toLocaleDateString()}
                  </span>
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
    </div>
  );
}
