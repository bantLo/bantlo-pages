import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { forceCacheUpdate, checkVersion } from '../versionPoller';
import { deleteAccount } from '../lib/api';
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
  const [deleteStage, setDeleteStage] = useState<'none' | 'confirm' | 'countdown'>('none');
  const [timer, setTimer] = useState(30);

  useEffect(() => {
    let interval: any;
    if (deleteStage === 'countdown' && timer > 0) {
      interval = setInterval(() => {
        setTimer((t) => t - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [deleteStage, timer]);

  useEffect(() => {
    // Detect PWA Status
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    setIsPWA(standalone);

    const parse = (str: string | null) => {
      if (!str) return null;
      try {
        if (str.trim().startsWith('{')) return JSON.parse(str);
        return { version: str };
      } catch (e) {
        return null;
      }
    };

    // 1. Initial load from storage
    const stored = localStorage.getItem('bantlo_current_version');
    if (stored) setVersionData(parse(stored));
    
    // 2. Fresh check
    checkVersion().then((latest) => {
      if (latest) setVersionData(latest);
    });
  }, []);
  
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
    localStorage.removeItem('bantlo_post_login_redirect');
    await supabase.auth.signOut();
    indexedDB.deleteDatabase('bantlo-data-cache-v1');
    navigate('/');
  };

  const handleDeleteAccount = async () => {
    if (timer > 0) return;
    try {
      await deleteAccount();
      localStorage.clear();
      await supabase.auth.signOut();
      alert("ACCOUNT DELETED. All your financial data and profile have been permanently purged from our primary database.");
      navigate('/');
    } catch (err: any) {
      alert(err.message || 'Deletion failed');
      setDeleteStage('none');
      setTimer(30);
    }
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

      <div className="np-section" style={{ borderStyle: 'dashed' }}>
        <h3 className="np-title" style={{ fontSize: '1rem', marginBottom: '1.5rem' }}>BANTLO CORE INFRASTRUCTURE</h3>
        <ul style={{ listStyle: 'none', padding: 0, fontSize: '0.85rem' }}>
          <li style={{ marginBottom: '0.75rem' }}>
            <span className="np-text-muted">About the Protocol:</span> 
            <strong style={{ marginLeft: '0.5rem' }}>
              <a href="/about" onClick={(e) => { e.preventDefault(); navigate('/about'); }} style={{ color: 'var(--text-accent)', textDecoration: 'underline' }}>See Mission/Contact</a>
            </strong>
          </li>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '900', fontSize: '1.2rem', color: 'var(--text-accent)' }}>
                      v{versionData.version || '0.0.0'}
                      {versionData.status === 'Deploying...' && (
                        <span style={{ marginLeft: '1rem', fontSize: '0.7rem', color: 'var(--text-warning)', verticalAlign: 'middle', animation: 'pulse 2s infinite' }}>[SYNCING...]</span>
                      )}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', opacity: 0.7 }}>
                      TAP 5X TO FORCE SYNC
                    </span>
                  </div>
                  {versionData.message && (
                    <p style={{ fontSize: '0.8rem', margin: 0, borderTop: '1px solid #333', paddingTop: '0.5rem', lineHeight: '1.4' }}>
                      {versionData.message}
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

      {/* Danger Zone */}
      <div className="np-section" style={{ borderColor: 'var(--text-danger)', marginTop: '2rem' }}>
        <h3 className="np-title" style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-danger)' }}>DANGER ZONE</h3>
        
        {deleteStage === 'none' && (
          <>
            <p className="np-text-muted" style={{ fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Permanent Account Deletion. This will remove your financial history and all group memberships.
            </p>
            <NeoButton 
              variant="danger" 
              style={{ width: '100%', borderColor: 'var(--text-danger)', color: 'var(--text-danger)' }}
              onClick={() => setDeleteStage('confirm')}
            >
              Delete User Account
            </NeoButton>
          </>
        )}

        {deleteStage === 'confirm' && (
          <div style={{ padding: '1rem', background: 'rgba(255, 100, 100, 0.1)', border: '2px solid var(--text-danger)' }}>
            <p style={{ color: 'var(--text-danger)', fontWeight: 'bold', marginBottom: '1rem' }}>WARNING: IRREVERSIBLE ACTION</p>
            <p className="np-text-muted" style={{ fontSize: '0.8rem', marginBottom: '1rem' }}>
              Your debt data and profile will be wiped. To remove your email from our auth registry after deletion, contact <strong>bantlo.expenses@gmail.com</strong>.
            </p>
            <div style={{ display: 'flex', gap: '1rem' }}>
               <NeoButton 
                variant="primary" 
                style={{ flex: 1, backgroundColor: 'var(--text-danger)', border: 'none' }}
                onClick={() => setDeleteStage('countdown')}
              >
                I Understand, Proceed
              </NeoButton>
              <NeoButton 
                variant="default" 
                style={{ flex: 1 }}
                onClick={() => setDeleteStage('none')}
              >
                Abort
              </NeoButton>
            </div>
          </div>
        )}

        {deleteStage === 'countdown' && (
          <div style={{ textAlign: 'center', padding: '1.5rem', border: '2px solid var(--text-danger)' }}>
            <h4 style={{ color: 'var(--text-danger)', marginBottom: '1rem' }}>CALCULATING WIPE MATRIX...</h4>
            <p style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '1.5rem' }}>{timer}s</p>
            <NeoButton 
              variant="primary" 
              disabled={timer > 0}
              onClick={handleDeleteAccount}
              style={{ width: '100%', backgroundColor: timer === 0 ? 'var(--text-danger)' : 'var(--bg-dark)', border: timer === 0 ? 'none' : '2px solid var(--border-color)' }}
            >
              {timer > 0 ? 'WAITING FOR CONFIRMATION' : 'DELETE FOREVER'}
            </NeoButton>
            <button 
              onClick={() => { setDeleteStage('none'); setTimer(30); }}
              style={{ marginTop: '1rem', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', opacity: 0.7 }}
            >
              STOP AND RE-INITIALIZE (CANCEL)
            </button>
          </div>
        )}
      </div>

      <CacheManagerModal 
        isOpen={showCacheModal} 
        onClose={() => setShowCacheModal(false)} 
      />

    </div>
  );
}
