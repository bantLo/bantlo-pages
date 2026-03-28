import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { forceCacheUpdate } from '../versionPoller';
import BackButton from '../components/BackButton';
import { useNavigate } from 'react-router-dom';

export default function Settings() {
  const [tapCount, setTapCount] = useState(0);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();

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

      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
         <button 
           className="np-button np-button-danger" 
           style={{ width: '100%' }}
           onClick={handleLogout}
         >
           Sign Out
         </button>
      </div>
    </div>
  );
}
