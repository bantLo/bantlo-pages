import { useEffect, useState } from 'react';
import NeoButton from '../components/NeoButton';

export default function LandingPage() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    
    window.addEventListener('beforeinstallprompt', handler);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      alert("Installation prompt isn't available. You might already be running the App, or your browser doesn't cleanly enforce `beforeinstallprompt` natively (e.g. Safari).");
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-dark)' }}>
      <style>
        {`
          .landing-hero {
            display: flex;
            flex-direction: column;
            padding: 2rem;
            max-width: 1200px;
            margin: 0 auto;
            align-items: center;
          }
          
          .desktop-only { display: none; }
          .mobile-only { display: block; }
          
          @media (min-width: 768px) {
            .landing-hero {
              flex-direction: row;
              padding: 4rem 2rem;
              gap: 4rem;
            }
            .desktop-only { display: flex; }
            .mobile-only { display: none; }
          }
        `}
      </style>

      {/* Navbar Minimalist */}
      <nav className="np-flex-between" style={{ padding: '1.5rem 2rem', maxWidth: '1200px', margin: '0 auto', width: '100%', borderBottom: '2px solid var(--border-color)' }}>
        <h1 className="np-title" style={{ margin: 0, border: 'none', fontSize: '1.5rem' }}>bantLo</h1>
        <NeoButton to="/auth" style={{ padding: '0.4rem 1rem' }}>Login</NeoButton>
      </nav>

      {/* Hero Section */}
      <div className="landing-hero" style={{ flex: 1, width: '100%' }}>
        
        {/* Left/Top Content */}
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '3.5rem', fontWeight: 900, textTransform: 'uppercase', lineHeight: 1.1, marginBottom: '1.5rem' }}>
            Split Offline. <br/>
            <span style={{ color: 'var(--text-accent)' }}>Sync Later.</span>
          </h2>
          
          <p className="np-text-muted" style={{ fontSize: '1.25rem', marginBottom: '2.5rem', maxWidth: '500px' }}>
            The brutalist, offline-first expense manager that doesn't hold your money hostage when the network drops. Engineered for precision sharing.
          </p>

          <div className="np-section" style={{ borderStyle: 'solid', padding: '1.5rem', marginBottom: '2.5rem', maxWidth: '500px' }}>
            {/* Desktop Dashboard Link */}
            <div className="desktop-only" style={{ flexDirection: 'column' }}>
              <p style={{ fontWeight: 'bold', marginBottom: '1rem', textTransform: 'uppercase' }}>Access your Dashboard</p>
              <NeoButton to="/dashboard" variant="primary" style={{ minWidth: '100%', justifyContent: 'center', padding: '1rem' }}>
                Go to Web App →
              </NeoButton>
            </div>

            {/* Mobile PWA Install */}
            <div className="mobile-only">
              <p style={{ fontWeight: 'bold', marginBottom: '1rem', textTransform: 'uppercase' }}>Get the Mobile App</p>
              <NeoButton 
                variant="primary" 
                onClick={handleInstallClick}
                disabled={!deferredPrompt}
                style={{ width: '100%', padding: '1rem' }}
              >
                {deferredPrompt ? 'Install App ↓' : 'App Installed / Use Share Sheet'}
              </NeoButton>
            </div>
          </div>
        </div>

        {/* Right/Bottom Graphic (Features Outline) */}
        <div style={{ flex: 1, width: '100%', maxWidth: '500px' }}>
          <h3 className="np-title" style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Engineered for Reality</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ padding: '1.5rem', border: '2px solid var(--border-color)', background: 'var(--bg-surface)' }}>
              <h4 style={{ color: 'var(--text-accent)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Offline-First</h4>
              <p className="np-text-muted">Built with advanced CacheStorage & IndexedDB to let you create groups and split bills deep in the mountains.</p>
            </div>
            
            <div style={{ padding: '1.5rem', border: '2px dashed var(--border-color)', background: 'var(--bg-surface)' }}>
              <h4 style={{ color: 'var(--text-accent)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Mathematical Precision</h4>
              <p className="np-text-muted">Equal, Exact, and Proportional Share splitting ensure you track owed money exactly how you intend.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
