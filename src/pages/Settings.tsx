import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { forceCacheUpdate, checkVersion } from '../versionPoller';
import { clearLocalDatabase } from '../lib/db';
import BackButton from '../components/BackButton';
import { useNavigate } from 'react-router-dom';
import NeoButton from '../components/NeoButton';
import CacheManagerModal from '../components/CacheManagerModal';

export default function Settings() {
  const [tapCount, setTapCount] = useState(0);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();
  const [showCacheModal, setShowCacheModal] = useState(false);
  const [versionData, setVersionData] = useState<any>(null);
  const [isPWA, setIsPWA] = useState(false);

  useEffect(() => {
    // Detect PWA Status
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    setIsPWA(standalone);

    // 1. Initial load from storage (Installed version is the source of truth for the local instance)
    const storedInstalled = localStorage.getItem('bantlo_installed_version');
    if (storedInstalled) {
      setVersionData({ version: storedInstalled, status: 'Scanning...' });
    }
    
    // 2. Fresh check (Fetches latest server version via cache-bust)
    checkVersion().then((latest) => {
      if (latest) setVersionData(latest);
    });
  }, []);

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
    localStorage.removeItem('bantlo_post_login_redirect');
    await supabase.auth.signOut();
    await clearLocalDatabase();
    window.location.assign('/');
  };

  return (
    <div className="np-container">
      <div className="np-flex-between" style={{ marginBottom: '1.5rem' }}>
        <h1 className="np-title" style={{ margin: 0 }}>Settings</h1>
        <BackButton fallback="/dashboard" />
      </div>

      <div className="np-section" style={{ borderStyle: 'dashed' }}>
        <h3 className="np-title" style={{ fontSize: '1rem', marginBottom: '1.5rem' }}>BANTLO CORE INFRASTRUCTURE</h3>
        
        <NeoButton 
          onClick={() => navigate('/about')} 
          style={{ width: '100%', marginBottom: '1.5rem', borderColor: 'var(--text-accent)' }}
        >
          Read About & Support ›
        </NeoButton>

        <ul style={{ listStyle: 'none', padding: 0, fontSize: '0.85rem' }}>
          <li style={{ marginBottom: '0.75rem' }}>
            <span className="np-text-muted">Offline Storage Layer:</span> 
            <strong style={{ marginLeft: '0.5rem' }}>IndexedDB + CacheStorage</strong>
          </li>
          <li style={{ marginBottom: '0.75rem' }}>
            <span className="np-text-muted">PWA Engine Status:</span> 
            <strong style={{ marginLeft: '0.5rem', color: isPWA ? 'var(--text-accent)' : 'var(--text-warning)' }}>
              {isPWA ? 'STANDALONE (App Mode)' : 'WEB BROWSER (Limited Performance)'}
            </strong>
          </li>
        </ul>
      </div>
      
      <div className="np-section" style={{ textAlign: 'center', borderColor: 'var(--border-color)', borderStyle: 'dashed' }}>
        <p className="np-text-muted" style={{ marginBottom: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px' }}>System Version</p>
        <div 
          onClick={handleVersionTap}
          style={{ 
            display: 'inline-block',
            padding: '1rem', 
            background: 'var(--bg-dark)', 
            border: '2px solid var(--border-color)',
            cursor: 'pointer',
            userSelect: 'none',
            textAlign: 'left',
            width: '100%'
          }}
        >
          {(() => {
            if (!versionData) return <span style={{ fontWeight: 'bold' }}>SCANNING SYSTEM...</span>;
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Installed Engine</span>
                      <span style={{ fontWeight: '900', fontSize: '1.2rem', color: 'white' }}>
                        v{versionData.installed_version || versionData.version || '0.0.0'}
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'right' }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Network Sync</span>
                      <span style={{ fontWeight: '900', fontSize: '1.2rem', color: 'var(--text-accent)' }}>
                        v{versionData.version || '0.0.0'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', borderTop: '1px solid #333', paddingTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.7rem', color: versionData.status === 'Update Available' ? 'var(--text-accent)' : 'var(--text-secondary)' }}>
                       {versionData.status === 'Update Available' ? '⚡ New Protocol Found' : '✔ System Synced'}
                    </span>
                    <span style={{ fontSize: '0.6rem', opacity: 0.5 }}>
                      TAP 5X TO FORCE
                    </span>
                  </div>

                  {versionData.status === 'Update Available' && (
                    <NeoButton 
                      onClick={() => forceCacheUpdate()} 
                      style={{ marginTop: '0.5rem', backgroundColor: 'var(--text-accent)', color: 'black', border: 'none', height: '2rem', fontSize: '0.75rem' }}
                    >
                      UPDATE NOW
                    </NeoButton>
                  )}

                  {versionData.message && (
                    <p style={{ fontSize: '0.75rem', margin: 0, marginTop: '0.5rem', opacity: 0.8, lineHeight: '1.4', fontStyle: 'italic' }}>
                      "{versionData.message}"
                    </p>
                  )}
                </div>
              );
          })()}
        </div>
        {tapCount > 0 && tapCount < 5 && (
          <p className="np-text-muted" style={{ fontSize: '0.75rem', marginTop: '0.75rem', color: 'var(--text-accent)' }}>
             {5 - tapCount} more taps to trigger local cache wipe!
          </p>
        )}
      </div>

      <div className="np-section" style={{ borderStyle: 'dotted', marginBottom: '1.5rem' }}>
        <p className="np-text-muted" style={{ marginBottom: '1rem', textTransform: 'uppercase' }}>Account Control</p>
        <NeoButton style={{ width: '100%', borderColor: 'var(--text-accent)' }} onClick={() => navigate('/settings/account')}>
          Account Settings ›
        </NeoButton>
        <p className="np-text-muted" style={{ fontSize: '0.7rem', marginTop: '0.75rem' }}>
          Update your display identity, security credentials, or manage deep account deletion.
        </p>
      </div>

      <div className="np-section" style={{ textAlign: 'center', borderStyle: 'dotted' }}>
        <p className="np-text-muted" style={{ marginBottom: '1rem' }}>Support & Cache</p>
        <NeoButton style={{ width: '100%', borderColor: 'var(--text-secondary)' }} onClick={() => setShowCacheModal(true)}>
          Troubleshoot App Cache
        </NeoButton>
        <p className="np-text-muted" style={{ fontSize: '0.7rem', marginTop: '0.75rem', textAlign: 'center' }}>
          Tip: If facing UI sync issues, try signing out and logging back in to reset the secure session.
        </p>
      </div>

      <div style={{ marginTop: '2.5rem', textAlign: 'center' }}>
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
