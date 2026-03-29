import NeoButton from './NeoButton';
import { clearLocalDatabase } from '../lib/db';

interface CacheManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CacheManagerModal({ isOpen, onClose }: CacheManagerModalProps) {
  if (!isOpen) return null;

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

  const handleClearDB = async () => {
    await clearLocalDatabase();
    localStorage.clear();
    sessionStorage.clear();
    alert('Offline database cleared! Reloading...');
    window.location.assign('/');
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
      <div className="np-section" style={{ borderColor: 'var(--text-danger)', borderStyle: 'solid', width: '90%', maxWidth: '400px', margin: '0' }}>
        <h3 style={{ marginBottom: '1rem', textTransform: 'uppercase', color: 'var(--text-danger)' }}>System Reset</h3>
        <p className="np-text-muted" style={{ marginBottom: '1.5rem', lineHeight: 1.4 }}>
          If bantLo is stuck offline, showing ghost expenses, or failing to load the newest design — you can forcefully wipe the localized PWA memory here.
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <NeoButton type="button" onClick={handleClearApp} style={{ borderColor: 'var(--text-accent)', color: 'var(--text-accent)' }}>
            Refresh UI Shell Only
          </NeoButton>
          
          <NeoButton type="button" onClick={handleClearDB} style={{ borderColor: 'var(--text-accent)', color: 'var(--text-accent)' }}>
            Wipe Offline DB Only
          </NeoButton>
          
          <NeoButton type="button" variant="danger" onClick={handleClearBoth}>
            Everything (Fix All)
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
