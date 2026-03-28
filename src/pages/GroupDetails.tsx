import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchGroupDetails, fetchGroupMembers, fetchGroupBalances, fetchRecentExpenses } from '../lib/api';
import AddExpense from '../components/AddExpense';
import BackButton from '../components/BackButton';

export default function GroupDetails() {
  const { id } = useParams<{ id: string }>();
  const [group, setGroup] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddExpense, setShowAddExpense] = useState(false);

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
      <div className="np-flex-between" style={{ marginBottom: '1.5rem' }}>
        <h1 className="np-title" style={{ margin: 0, border: 'none' }}>{group.name}</h1>
        <BackButton fallback="/dashboard" />
      </div>

      <div className="np-section" style={{ padding: '1rem' }}>
        <p className="np-text-muted" style={{ fontSize: '0.85rem' }}>Currency: {group.currency}</p>
        <p className="np-text-muted" style={{ fontSize: '0.85rem' }}>Members: {members.length}</p>
        
        {!showAddExpense && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
            <button className="np-button np-button-primary" onClick={() => setShowAddExpense(true)}>Add Expense</button>
            <button className="np-button" style={{ borderColor: 'var(--text-accent)', color: 'var(--text-accent)' }}>Settle Up</button>
          </div>
        )}
      </div>

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
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 'bold' }}>{e.description}</span>
                  <span className="np-text-muted" style={{ fontSize: '0.8rem' }}>
                    {new Date(e.created_at).toLocaleDateString()}
                  </span>
                </div>
                <span style={{ fontWeight: 'bold' }}>{group.currency} {Number(e.amount).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
