import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { fetchUserGroups, createGroup } from '../lib/api';

export default function Dashboard() {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

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
      await createGroup(user.id, newGroupName.trim());
      setNewGroupName('');
      setShowCreate(false);
      loadGroups(); // Refresh list
    } catch (error) {
      console.error(error);
      alert('Error creating group. Ensure your Supabase schema is correct/running.');
    }
  };

  return (
    <div className="np-container">
      <div className="np-flex-between" style={{ marginBottom: '1.5rem' }}>
        <h1 className="np-title" style={{ margin: 0, border: 'none' }}>bantLo</h1>
        <Link to="/settings" className="np-button">Settings</Link>
      </div>

      <div className="np-flex-between" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.2rem', textTransform: 'uppercase' }}>Your Groups</h2>
        <button 
          className="np-button np-button-primary" 
          onClick={() => setShowCreate(!showCreate)}
          style={{ padding: '0.4rem 1rem' }}
        >
          {showCreate ? 'Close' : '+ New'}
        </button>
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
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button type="submit" className="np-button np-button-primary" style={{ flex: 1 }}>Create</button>
            <button type="button" className="np-button" onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="np-section" style={{ textAlign: 'center', borderColor: 'transparent' }}>
          <p className="np-text-muted" style={{ animation: 'pulse 1.5s infinite' }}>Loading groups...</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="np-section" style={{ textAlign: 'center', padding: '3rem 1rem', borderStyle: 'dashed' }}>
          <p style={{ marginBottom: '1rem' }}>No groups found.</p>
          <p className="np-text-muted">Create a group to start adding expenses and splitting bills offline.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {groups.map(g => (
            <Link 
              key={g.id} 
              to={`/groups/${g.id}`} 
              className="np-section" 
              style={{ cursor: 'pointer', display: 'block', textDecoration: 'none', margin: 0, transition: 'var(--transition-fast)' }}
            >
              <div className="np-flex-between">
                <div>
                  <h3 style={{ margin: 0, textTransform: 'uppercase', fontSize: '1.1rem' }}>{g.name}</h3>
                  <small className="np-text-muted">Currency: {g.currency}</small>
                </div>
                <span style={{ color: 'var(--text-accent)' }}>❯</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
