import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import NeoButton from '../components/NeoButton';
import Logo from '../components/Logo';
import { supabase } from '../lib/supabase';
import { fetchUserGroups, createGroup, addFriendByEmail } from '../lib/api';

export default function Dashboard() {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupCurrency, setNewGroupCurrency] = useState('USD');
  const [newFriendEmail, setNewFriendEmail] = useState('');

  const COMMON_CURRENCIES = ['USD', 'INR', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'AED', 'SGD', 'CHF'];

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const userGroups = await fetchUserGroups(user.id);
      
      // Filter out any potential nulls if RLS or deletion caused dangling references
      setGroups(userGroups.filter((g: any) => g !== null));
    } catch (e) {
      console.error("Error loading groups:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await createGroup(user.id, newGroupName.trim(), newGroupCurrency);
      setNewGroupName('');
      setNewGroupCurrency('USD');
      setShowCreate(false);
      loadGroups(); // Refresh list
    } catch (error: any) {
      console.error(error);
      alert('Error creating group: ' + (error.message || 'Check database connection'));
    }
  };

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFriendEmail.trim()) return;
    
    try {
      await addFriendByEmail(newFriendEmail.trim());
      setNewFriendEmail('');
      setShowAddFriend(false);
      loadGroups();
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'Error adding friend. They might need to create an account first.');
    }
  };

  const normalGroups = groups.filter(g => !g.is_friend_group);
  const friendGroups = groups.filter(g => g.is_friend_group);

  return (
    <div className="np-container">
      <div className="np-flex-between" style={{ marginBottom: '1.5rem' }}>
        <Logo />
        <NeoButton to="/settings">Settings</NeoButton>
      </div>

      <div className="np-flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 style={{ fontSize: '1.2rem', textTransform: 'uppercase' }}>Your Groups</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <NeoButton 
            variant="primary" 
            onClick={() => { setShowCreate(!showCreate); setShowAddFriend(false); }}
            style={{ padding: '0.4rem 1rem' }}
          >
            {showCreate ? 'Close Group' : '+ Group'}
          </NeoButton>
          <NeoButton 
            variant="default" 
            onClick={() => { setShowAddFriend(!showAddFriend); setShowCreate(false); }}
            style={{ padding: '0.4rem 1rem', borderColor: 'var(--text-accent)' }}
          >
            {showAddFriend ? 'Close Friend' : '+ Friend'}
          </NeoButton>
        </div>
      </div>

      {showCreate && (
        <form onSubmit={handleCreateGroup} className="np-section" style={{ borderColor: 'var(--text-accent)' }}>
          <h3 style={{ marginBottom: '1rem', textTransform: 'uppercase', fontSize: '1rem' }}>Create Group</h3>
          <input 
            type="text" 
            placeholder="e.g. Goa Trip, Apartment 5B" 
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            required
            style={{ 
              width: '100%', 
              padding: '0.75rem', 
              background: 'var(--bg-dark)', 
              border: '2px solid var(--border-color)', 
              color: 'var(--text-primary)', 
              marginBottom: '1rem',
              outline: 'none',
              fontFamily: 'inherit'
            }}
          />
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.5rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
              Group Currency
            </label>
            <select
              value={newGroupCurrency}
              onChange={(e) => setNewGroupCurrency(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'var(--bg-dark)',
                border: '2px solid var(--border-color)',
                color: 'var(--text-primary)',
                outline: 'none',
                fontFamily: 'inherit'
              }}
            >
              {COMMON_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <NeoButton type="submit" variant="primary" style={{ flex: 1 }}>Create</NeoButton>
            <NeoButton type="button" onClick={() => setShowCreate(false)}>Cancel</NeoButton>
          </div>
        </form>
      )}

      {showAddFriend && (
        <form onSubmit={handleAddFriend} className="np-section" style={{ borderColor: 'var(--text-accent)' }}>
          <h3 style={{ marginBottom: '1rem', textTransform: 'uppercase', fontSize: '1rem', color: 'var(--text-accent)' }}>Add a Friend</h3>
          <p className="np-text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>Add them by their BantLo email to instantly open a 1-on-1 split tab!</p>
          <input 
            type="email" 
            placeholder="friend@example.com" 
            value={newFriendEmail}
            onChange={(e) => setNewFriendEmail(e.target.value)}
            required
            style={{ 
              width: '100%', 
              padding: '0.75rem', 
              background: 'var(--bg-dark)', 
              border: '2px solid var(--border-color)', 
              color: 'var(--text-primary)', 
              marginBottom: '1rem',
              outline: 'none',
              fontFamily: 'inherit'
            }}
          />
          <div style={{ display: 'flex', gap: '1rem' }}>
            <NeoButton type="submit" variant="primary" style={{ flex: 1, borderColor: 'var(--text-accent)' }}>Add</NeoButton>
            <NeoButton type="button" onClick={() => setShowAddFriend(false)}>Cancel</NeoButton>
          </div>
        </form>
      )}

      {loading ? (
        <div className="np-section" style={{ textAlign: 'center', borderColor: 'transparent' }}>
          <p className="np-text-muted" style={{ animation: 'pulse 1.5s infinite' }}>Loading records...</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="np-section" style={{ textAlign: 'center', padding: '3rem 1rem', borderStyle: 'dashed' }}>
          <p style={{ marginBottom: '1rem' }}>No groups or friends found.</p>
          <p className="np-text-muted">Create a Group or Add a friend to start splitting bills entirely offline natively!</p>
        </div>
      ) : (
        <div className="np-grid-desktop">
          
          <div>
            <p className="np-text-muted" style={{ marginBottom: '0.75rem', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '1px' }}>Friends (1-on-1)</p>
            {friendGroups.length === 0 ? (
              <div className="np-section" style={{ borderStyle: 'dotted', opacity: 0.5 }}>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>No friend splits. Add someone by email!</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {friendGroups.map(g => (
                  <Link 
                    key={g.id} 
                    to={`/groups/${g.id}`} 
                    className="np-section" 
                    style={{ cursor: 'pointer', display: 'block', textDecoration: 'none', margin: 0, padding: '1rem', transition: 'var(--transition-fast)', borderColor: 'var(--text-accent)', borderStyle: 'dashed' }}
                  >
                    <div className="np-flex-between">
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>{g.name}</h3>
                      </div>
                      <span style={{ color: 'var(--text-accent)' }}>❯</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="np-text-muted" style={{ marginBottom: '0.75rem', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '1px' }}>Ledger Groups</p>
            {normalGroups.length === 0 ? (
              <div className="np-section" style={{ borderStyle: 'dotted', opacity: 0.5 }}>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>No group ledgers. Click "+ Group" to start one!</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {normalGroups.map(g => (
                  <Link 
                    key={g.id} 
                    to={`/groups/${g.id}`} 
                    className="np-section" 
                    style={{ cursor: 'pointer', display: 'block', textDecoration: 'none', margin: 0, padding: '1rem', transition: 'var(--transition-fast)' }}
                  >
                    <div className="np-flex-between">
                      <div>
                        <h3 style={{ margin: 0, textTransform: 'uppercase', fontSize: '1.1rem', color: 'var(--text-primary)' }}>{g.name}</h3>
                        <small className="np-text-muted">Currency: {g.currency}</small>
                      </div>
                      <span style={{ color: 'var(--text-primary)' }}>❯</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
