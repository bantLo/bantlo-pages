import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import NeoButton from '../components/NeoButton';
import { checkVersion } from '../versionPoller';

export default function About() {
  const navigate = useNavigate();
  const [versionData, setVersionData] = useState<any>(null);

  useEffect(() => {
    // 1. Initial load from storage
    const storedInstalled = localStorage.getItem('bantlo_installed_version');
    if (storedInstalled) {
      setVersionData({ version: storedInstalled });
    }
    
    // 2. Fresh check
    checkVersion().then((latest) => {
      if (latest) setVersionData(latest);
    });
  }, []);

  return (
    <div className="np-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header */}
      <nav className="np-flex-between" style={{ padding: '1rem 0', marginBottom: '2rem', borderBottom: '2px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button 
            onClick={() => navigate(-1)} 
            style={{ 
              background: 'transparent', border: 'none', 
              color: 'var(--text-primary)', cursor: 'pointer', 
              fontSize: '1.2rem', padding: '0.5rem' 
            }}
          >
            ←
          </button>
          <Logo />
        </div>
      </nav>

      <div style={{ flex: 1, maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        <h2 style={{ fontSize: '2.5rem', fontWeight: 900, textTransform: 'uppercase', marginBottom: '2rem', lineHeight: 1 }}>
          The <span style={{ color: 'var(--text-accent)' }}>bantLo</span> org
        </h2>

        <div className="np-section" style={{ marginBottom: '2rem' }}>
          <h3 className="np-title" style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Vision</h3>
          <p className="np-text-muted" style={{ lineHeight: 1.6 }}>
            bantLo is a brutalist, offline-first expense manager designed for people who value financial clarity over social noise. 
            We replace "IOU" anxiety with strict mathematical ledgers and real-time debt simplification.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
          <div className="np-section" style={{ borderStyle: 'dashed' }}>
             <h4 style={{ color: 'var(--text-accent)', marginBottom: '0.5rem', textTransform: 'uppercase', fontSize: '0.8rem' }}>Tech Stack</h4>
             <ul style={{ listStyle: 'none', padding: 0, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
               <li>• Vite + React (UI)</li>
               <li>• Supabase (Global Sync)</li>
               <li>• IndexedDB (Offline Engine)</li>
               <li>• PWA (Native Install)</li>
             </ul>
          </div>
          <div className="np-section">
             <h4 style={{ color: 'var(--text-accent)', marginBottom: '0.5rem', textTransform: 'uppercase', fontSize: '0.8rem' }}>Developer</h4>
             <p style={{ fontSize: '0.9rem' }}>Built for precision sharing. Focused on performance at the edge.</p>
          </div>
        </div>

        <div className="np-section" style={{ borderColor: 'var(--text-accent)' }}>
          <h3 className="np-title" style={{ fontSize: '1rem', marginBottom: '1rem' }}>Support & Identity</h3>
          <p className="np-text-muted" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
            If you need to request a full manual purge of your authentication record after deleting your profile, 
            or if you've encountered a mathematical anomaly in your balances:
          </p>
          <div style={{ background: 'var(--bg-dark)', padding: '1rem', border: '2px solid var(--border-color)', textAlign: 'center' }}>
            <p style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>bantlo.expenses@gmail.com</p>
          </div>
        </div>

        <div style={{ marginTop: '3rem', textAlign: 'center', paddingBottom: '3rem' }}>
          {versionData && (
             <div style={{ 
               marginBottom: '2rem', 
               padding: '1rem', 
               background: 'var(--bg-dark)', 
               border: '1px dashed var(--border-color)',
               display: 'inline-block',
               textAlign: 'left'
             }}>
               <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                 Protocol Identity: <span style={{ color: 'white' }}>Installed v{versionData.installed_version || versionData.version}</span>
               </p>
               <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                 Network Status: <span style={{ color: 'var(--text-accent)' }}>Latest v{versionData.version}</span>
               </p>
             </div>
          )}
          <p className="np-text-muted" style={{ fontSize: '0.75rem', marginBottom: '1.5rem' }}>© 2026 bantLo org. All Rights Reserved.</p>
          <NeoButton variant="default" onClick={() => navigate('/')}>Back to Gateway</NeoButton>
        </div>
      </div>
    </div>
  );
}
