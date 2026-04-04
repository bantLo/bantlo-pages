import { useEffect, useState } from 'react';
import { checkVersion, forceCacheUpdate } from '../versionPoller';
import NeoButton from './NeoButton';
import Logo from './Logo';

export default function UpdatePrompt() {
  const [updateData, setUpdateData] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const runCheck = async () => {
      const data = await checkVersion();
      if (data && data.isUpdateAvailable) {
        setUpdateData(data);
        setIsVisible(true);
      }
    };

    // Initial check on mount
    runCheck();

    // Re-check every 5 minutes while dashboard is open
    const interval = setInterval(runCheck, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (!isVisible || !updateData) return null;

  return (
    <div 
      style={{ 
        position: 'fixed', 
        top: 0, left: 0, width: '100%', height: '100%', 
        background: 'rgba(0,0,0,0.85)', 
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '1.5rem'
      }}
    >
      <div 
        className="np-section" 
        style={{ 
          maxWidth: '400px', 
          width: '100%', 
          borderColor: 'var(--text-accent)',
          background: 'var(--bg-dark)',
          textAlign: 'center',
          boxShadow: '0 20px 50px rgba(0,0,0,0.5), 0 0 20px rgba(0,183,114,0.2)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
          <Logo />
        </div>

        <h2 style={{ fontSize: '1.3rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>New Update Found!</h2>
        <p className="np-text-muted" style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Version <strong>v{updateData.version}</strong> is ready for you.
        </p>

        {updateData.message && (
          <div 
            style={{ 
              background: 'rgba(255,255,255,0.03)', 
              padding: '1rem', 
              borderRadius: '8px', 
              marginBottom: '2rem',
              fontSize: '0.85rem',
              lineHeight: '1.5',
              border: '1px solid rgba(255,255,255,0.05)',
              textAlign: 'left'
            }}
          >
            <p className="np-text-muted" style={{ textTransform: 'uppercase', fontSize: '0.65rem', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--text-accent)' }}>What's New</p>
            {updateData.message}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <NeoButton 
            variant="primary" 
            onClick={() => forceCacheUpdate()} 
            style={{ width: '100%', height: '3.5rem', fontSize: '1rem' }}
          >
            Update Now
          </NeoButton>
        </div>
      </div>
    </div>
  );
}
