import { useState } from 'react';
import NeoButton from './NeoButton';
import { clearLocalDatabase } from '../lib/db';
import { performFullSync } from '../lib/sync';

interface CacheManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CacheManagerModal({ isOpen, onClose }: CacheManagerModalProps) {
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');

  if (!isOpen) return null;

  const handleSync = async () => {
    setSyncing(true);
    setSyncStatus('idle');
    try {
      await performFullSync();
      setSyncStatus('success');
      setTimeout(() => {
        onClose();
        window.location.reload(); // Refresh to show newly synced data
      }, 1500);
    } catch (err) {
      console.error(err);
      setSyncStatus('error');
    } finally {
      setSyncing(false);
    }
  };

  const handleClearApp = async () => {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'FORCE_UPDATE' });
    } else {
      window.location.reload();
    }
  };

  const handleClearBoth = async () => {
    await clearLocalDatabase();
    localStorage.clear();
    sessionStorage.clear();
    
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'FORCE_UPDATE' });
    } else {
      alert('All caches completely wiped! Reloading fresh...');
      window.location.assign('/');
    }
  };

  return (
    <div style={{ 
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      backgroundColor: 'rgba(0,0,0,0.85)', 
      display: 'flex', justifyContent: 'center', alignItems: 'center', 
      zIndex: 9999 
    }}>
      <div className="np-section" style={{ borderColor: 'var(--text-accent)', borderStyle: 'solid', width: '90%', maxWidth: '400px', margin: '0' }}>
        <h3 style={{ marginBottom: '1rem', textTransform: 'uppercase', color: 'var(--text-accent)' }}>Troubleshoot & Sync</h3>
        <p className="np-text-muted" style={{ marginBottom: '1.5rem', lineHeight: 1.4 }}>
          If bantLo is stuck offline, showing ghost expenses, or failing to sync — use these tools to reconcile your local data with the cloud.
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <NeoButton 
            type="button" 
            variant="primary" 
            onClick={handleSync} 
            disabled={syncing}
            style={{ height: '3.5rem', background: syncStatus === 'success' ? '#00c355' : 'var(--text-accent)', color: 'black', border: 'none' }}
          >
            {syncing ? 'SYNCING...' : syncStatus === 'success' ? '✔ SYNC COMPLETE' : syncStatus === 'error' ? '❌ SYNC FAILED' : 'Sync with Online DB'}
          </NeoButton>

          <NeoButton type="button" onClick={handleClearApp} disabled={syncing} style={{ borderColor: '#444' }}>
            Flush System Caches (UI)
          </NeoButton>
          
          <NeoButton type="button" variant="danger" onClick={handleClearBoth} disabled={syncing} style={{ borderStyle: 'dotted' }}>
            Full Local Wipe (Danger)
          </NeoButton>
          
          <button 
            type="button" 
            onClick={onClose} 
            style={{ 
              marginTop: '0.5rem', background: 'transparent', border: 'none', 
              color: 'var(--text-secondary)', textDecoration: 'underline', 
              cursor: 'pointer', fontFamily: 'inherit', padding: '0.5rem'
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
