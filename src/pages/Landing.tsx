import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

export default function LandingPage() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    
    window.addEventListener('beforeinstallprompt', handler);
    
    return () => {
      window.removeEventListener('resize', handleResize);
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
      alert("Installation prompt isn't available right now. Make sure you are not already in the app, or try 'Add to Home Screen' from your browser menu.");
    }
  };

  return (
    <div className="np-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Navbar Minimalist */}
      <nav className="np-flex-between" style={{ padding: '1.5rem 0', borderBottom: '2px solid var(--border-color)' }}>
        <h1 className="np-title" style={{ margin: 0, border: 'none', fontSize: '1.5rem' }}>bantLo</h1>
        <Link to="/auth" className="np-button" style={{ padding: '0.4rem 1rem' }}>Login</Link>
      </nav>

      {/* Hero Section */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', margin: '4rem 0' }}>
        <h2 style={{ fontSize: '3rem', fontWeight: 900, textTransform: 'uppercase', lineHeight: 1, marginBottom: '1.5rem' }}>
          Split Offline. <br/>
          <span style={{ color: 'var(--text-accent)' }}>Sync Later.</span>
        </h2>
        
        <p className="np-text-muted" style={{ fontSize: '1.2rem', marginBottom: '2.5rem', maxWidth: '400px' }}>
          The brutalist, offline-first expense manager that doesn't hold your money hostage when the network drops.
        </p>

        <div className="np-section" style={{ borderStyle: 'dashed', padding: '1.5rem', marginBottom: '2.5rem' }}>
          <p style={{ fontWeight: 'bold', marginBottom: '1rem', textTransform: 'uppercase' }}>
            {isMobile ? 'Get the Mobile App' : 'Access the Dashboard'}
          </p>
          
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {isMobile ? (
              <button 
                className="np-button np-button-primary" 
                onClick={handleInstallClick}
                disabled={!deferredPrompt}
                style={{ flex: 1, minWidth: '100%', padding: '1rem' }}
              >
                {deferredPrompt ? 'Install PWA ↓' : 'App Installed or Unsupported'}
              </button>
            ) : (
              <Link to="/dashboard" className="np-button np-button-primary" style={{ flex: 1, minWidth: '100%', justifyContent: 'center', padding: '1rem' }}>
                Go to Web App →
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Features Outline */}
      <div style={{ marginBottom: '4rem' }}>
        <h3 className="np-title" style={{ fontSize: '1.5rem' }}>Engineered for Reality</h3>
        
        <div className="np-section" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', border: 'none', padding: 0 }}>
          <div style={{ padding: '1.5rem', border: '2px solid var(--border-color)', background: 'var(--bg-surface)' }}>
            <h4 style={{ color: 'var(--text-accent)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Offline-First</h4>
            <p className="np-text-muted">Built with advanced CacheStorage & IndexedDB to let you create groups and split bills deep in the mountains.</p>
          </div>
          <div style={{ padding: '1.5rem', border: '2px solid var(--border-color)', background: 'var(--bg-surface)' }}>
            <h4 style={{ color: 'var(--text-accent)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Equal, Exact, Shares</h4>
            <p className="np-text-muted">Mathematical precision to track owed money exactly how you intend. Never mess up a penny.</p>
          </div>
        </div>
      </div>
      
    </div>
  );
}
