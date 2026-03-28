import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { forceCacheUpdate } from '../versionPoller';
import BackButton from '../components/BackButton';
import { useNavigate } from 'react-router-dom';
import NeoButton from '../components/NeoButton';
import CacheManagerModal from '../components/CacheManagerModal';

export default function Settings() {
  const [tapCount, setTapCount] = useState(0);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();
  const [showCacheModal, setShowCacheModal] = useState(false);
  
  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');

  const [newDisplayName, setNewDisplayName] = useState('');
  const [displayNameMsg, setDisplayNameMsg] = useState('');

  const handleVersionTap = () => {
    const newCount = tapCount + 1;
    setTapCount(newCount);
    
    if (newCount >= 5) {
      alert('Easter Egg Activated: Force updating app shell cache and reloading!');
      forceCacheUpdate();
      setTapCount(0);
    } else {
      if (pressTimer.current) clearTimeout(pressTimer.current);
      pressTimer.current = setTimeout(() => {
        setTapCount(0);
      }, 1000);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    indexedDB.deleteDatabase('bantlo-data-cache-v1'); // Completely wipe PWA DB cache purely on logout
    navigate('/');
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      setPasswordMsg('Password must be at least 6 characters.');
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPasswordMsg(error.message);
    } else {
      setPasswordMsg('Password instantly updated!');
      setNewPassword('');
    }
  };

  const handleUpdateDisplayName = async () => {
    if (!newDisplayName || newDisplayName.length < 2) {
      setDisplayNameMsg('Display Name must be at least 2 characters.');
      return;
    }
    const { error } = await supabase.auth.updateUser({ data: { full_name: newDisplayName } });
    if (error) {
      setDisplayNameMsg(error.message);
    } else {
      setDisplayNameMsg('Display Name instantly updated!');
      setNewDisplayName('');
    }
  };

  return (
    <div className="np-container">
      <div className="np-flex-between" style={{ marginBottom: '1.5rem' }}>
        <h1 className="np-title" style={{ margin: 0 }}>Settings</h1>
        <BackButton fallback="/dashboard" />
      </div>

      <div className="np-section">
        <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', textTransform: 'uppercase' }}>Credits & Tech</h2>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li style={{ marginBottom: '0.75rem' }}>
            <span className="np-text-muted">Edge Serving:</span> 
            <strong style={{ marginLeft: '0.5rem' }}>Cloudflare Pages</strong>
          </li>
          <li style={{ marginBottom: '0.75rem' }}>
            <span className="np-text-muted">Backend Auth & DB:</span> 
            <strong style={{ marginLeft: '0.5rem' }}>Supabase / PostgREST</strong>
          </li>
          <li style={{ marginBottom: '0.75rem' }}>
            <span className="np-text-muted">Offline Storage Layer:</span> 
            <strong style={{ marginLeft: '0.5rem' }}>IndexedDB + CacheStorage</strong>
          </li>
          <li style={{ marginBottom: '0.75rem' }}>
            <span className="np-text-muted">UI Architecture:</span> 
            <strong style={{ marginLeft: '0.5rem' }}>Vite React + NeoPop Dark</strong>
          </li>
          <li style={{ marginBottom: '0.75rem' }}>
            <span className="np-text-muted">Logo Design:</span> 
            <strong style={{ marginLeft: '0.5rem' }}>
              <a href="https://www.svgrepo.com/svg/388633/split-cells" target="_blank" rel="noreferrer" style={{ color: 'var(--text-primary)' }}>SVG Repo</a>
            </strong>
          </li>
        </ul>
      </div>
      
      <div className="np-section" style={{ textAlign: 'center', borderColor: 'var(--border-color)', borderStyle: 'dashed' }}>
        <p className="np-text-muted" style={{ marginBottom: '0.5rem' }}>App Version</p>
        <div 
          onClick={handleVersionTap}
          style={{ 
            display: 'inline-block',
            padding: '0.5rem 1rem', 
            background: 'var(--bg-dark)', 
            border: '2px solid var(--border-color)',
            cursor: 'pointer',
            userSelect: 'none',
            fontWeight: 'bold',
            letterSpacing: '2px'
          }}
        >
          v1.0.0
        </div>
        {tapCount > 0 && tapCount < 5 && (
          <p className="np-text-muted" style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: 'var(--text-accent)' }}>
            {5 - tapCount} more taps to force update
          </p>
        )}
      </div>

      <div className="np-section" style={{ borderStyle: 'dotted', marginBottom: '1.5rem' }}>
        <p className="np-text-muted" style={{ marginBottom: '1rem', textTransform: 'uppercase' }}>Profile Identity</p>
        <input 
          type="text" 
          value={newDisplayName}
          onChange={e => {
            setNewDisplayName(e.target.value);
            setDisplayNameMsg('');
          }}
          placeholder="New Display Name..." 
          maxLength={30}
          style={{ width: '100%', padding: '0.75rem', marginBottom: '0.75rem', background: 'var(--bg-dark)', border: '2px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit' }}
        />
        <NeoButton style={{ width: '100%', borderColor: 'var(--text-secondary)' }} onClick={handleUpdateDisplayName}>
          Update Display Name
        </NeoButton>
        {displayNameMsg && (
          <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: displayNameMsg.includes('updated') ? 'var(--text-accent)' : 'var(--text-danger)' }}>
            {displayNameMsg}
          </p>
        )}
      </div>

      <div className="np-section" style={{ borderStyle: 'dotted', marginBottom: '1.5rem' }}>
        <p className="np-text-muted" style={{ marginBottom: '1rem', textTransform: 'uppercase' }}>Security</p>
        <input 
          type="password" 
          value={newPassword}
          onChange={e => {
            setNewPassword(e.target.value);
            setPasswordMsg('');
          }}
          placeholder="Enter new password..." 
          style={{ width: '100%', padding: '0.75rem', marginBottom: '0.75rem', background: 'var(--bg-dark)', border: '2px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit' }}
        />
        <NeoButton style={{ width: '100%', borderColor: 'var(--text-secondary)' }} onClick={handleUpdatePassword}>
          Update Password
        </NeoButton>
        {passwordMsg && (
          <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: passwordMsg.includes('updated') ? 'var(--text-accent)' : 'var(--text-danger)' }}>
            {passwordMsg}
          </p>
        )}
      </div>

      <div className="np-section" style={{ textAlign: 'center', borderStyle: 'dotted' }}>
        <p className="np-text-muted" style={{ marginBottom: '1rem' }}>Advanced Options</p>
        <NeoButton style={{ width: '100%', borderColor: 'var(--text-secondary)' }} onClick={() => setShowCacheModal(true)}>
          Troubleshoot App Cache
        </NeoButton>
      </div>

      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
         <NeoButton 
           variant="danger" 
           style={{ width: '100%' }}
           onClick={handleLogout}
         >
           Sign Out
         </NeoButton>
      </div>

      <CacheManagerModal 
        isOpen={showCacheModal} 
        onClose={() => setShowCacheModal(false)} 
      />
    </div>
  );
}
