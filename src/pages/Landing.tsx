import { useEffect, useState } from 'react';
import NeoButton from '../components/NeoButton';
import Logo from '../components/Logo';

export default function LandingPage() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Detect iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    // Detect Standalone
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    setIsStandalone(standalone);

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
    } else if (isIOS && !isStandalone) {
      alert("To Install on iOS: 1. Tap the 'Share' icon (square with arrow up) at the bottom 2. Scroll down and tap 'Add to Home Screen' (+ icon).");
    } else if (isStandalone) {
      window.location.href = '/dashboard';
    } else {
      alert("Installation prompt isn't natively available. You might already be running the App or your browser is restrictive. For Chrome: Use the Triple Dot menu → Install App.");
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
        <Logo />
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
                style={{ width: '100%', padding: '1rem' }}
              >
                {(() => {
                  if (isStandalone) return 'App Ready › Open Dashboard';
                  if (deferredPrompt) return 'Install App ↓';
                  if (isIOS) return 'Add to Home Screen (Share → +)';
                  return 'Access Web App ❯';
                })()}
              </NeoButton>
              {isIOS && !isStandalone && (
                <p style={{ fontSize: '0.75rem', marginTop: '0.75rem', textAlign: 'center', color: 'var(--text-accent)' }}>
                  (Click above to see iOS instructions)
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right/Bottom Graphic (Features Outline) */}
        <div style={{ flex: 1, width: '100%', maxWidth: '500px' }}>
          <h3 className="np-title" style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Engineered for Reality</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ padding: '1.5rem', border: '2px solid var(--border-color)', background: 'var(--bg-surface)' }}>
              <h4 style={{ color: 'var(--text-accent)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Offline-First Ecosystem</h4>
              <p className="np-text-muted" style={{ fontSize: '0.9rem' }}>Built heavily on Service Workers and IndexedDB. You can load your groups and view debts deep in the mountains without a single cell tower.</p>
            </div>
            
            <div style={{ padding: '1.5rem', border: '2px dashed var(--border-color)', background: 'var(--bg-surface)' }}>
              <h4 style={{ color: 'var(--text-accent)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Mathematical Debt Simplification</h4>
              <p className="np-text-muted" style={{ fontSize: '0.9rem' }}>bantLo natively calculates a "Greedy Matrix" in the background. Instead of raw balances, we tell you exactly who must pay whom to achieve 0.00 balances instantly.</p>
            </div>

            <div style={{ padding: '1.5rem', border: '2px solid var(--border-color)', background: 'var(--bg-surface)' }}>
              <h4 style={{ color: 'var(--text-accent)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Brutalist NeoPop UI</h4>
              <p className="np-text-muted" style={{ fontSize: '0.9rem' }}>No fluff. High-contrast, tactile mechanical buttons, and aggressive visual layouts designed for immediate read-response in pure sunlight.</p>
            </div>
          </div>
        </div>
      </div>

      {/* The bantLo Manual (Detailed Explanations) */}
      <div style={{ backgroundColor: 'var(--bg-surface)', borderTop: '2px solid var(--border-color)', padding: '5rem 0' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 2rem', width: '100%' }}>
          <h2 style={{ fontSize: '2.5rem', textTransform: 'uppercase', marginBottom: '1rem', textAlign: 'center', fontWeight: 900 }}>
            The Architecture of BantLo
          </h2>
          <p className="np-text-muted" style={{ textAlign: 'center', marginBottom: '4rem', maxWidth: '700px', margin: '0 auto 4rem auto', fontSize: '1.1rem' }}>
            A deep dive into exactly how we replaced standard Splitwise mechanics with mathematically strict PostgreSQL ledgers and edge-cached local databases.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
            
            {/* Split Types & Mathematical Routing */}
            <div className="np-section" style={{ borderColor: 'var(--text-accent)' }}>
              <h3 style={{ textTransform: 'uppercase', marginBottom: '1rem', color: 'var(--text-accent)' }}>1. Advanced Splitting & Funding</h3>
              <p className="np-text-muted" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>We completely replicate heavy enterprise algorithms precisely on your device, separating <em>Funding</em> from <em>Consumption</em>:</p>
              <ul style={{ paddingLeft: '1.2rem', fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <li><strong>Multiple Payers:</strong> Did Alice and Bob both throw down a credit card for the same $200 dinner? You can input EXACTLY how much multiple people funded simultaneously!</li>
                <li><strong>Equal & Exact Splits:</strong> Standard equal fractions or strictly assigned absolute dollar amounts (e.g. John ate a $40 steak, Sarah had $12 fries).</li>
                <li><strong>Proportional Shares:</strong> Perfect for couples or families. Assign "2 shares" to a couple and "1 share" to a single person to split proportionally!</li>
                <li><strong>The Matrix Engine:</strong> Instead of confusing "You owe the Group $50" logic, our algorithm analyzes everyone's balances and explicitly spits out instructions like <em>"Dave pays Sarah $50"</em>.</li>
              </ul>
            </div>

            {/* Secure Auth Flow & Social Protocol */}
            <div className="np-section" style={{ borderColor: 'var(--border-color)', borderStyle: 'dashed' }}>
              <h3 style={{ textTransform: 'uppercase', marginBottom: '1rem' }}>2. Strict Backend Security</h3>
              <p className="np-text-muted" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>We operate on strict Supabase PostgreSQL Row-Level-Security protocols to prevent spam, ghost accounts, and payload scraping.</p>
              <ul style={{ paddingLeft: '1.2rem', fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <li>Passwords must absolutely hit our <strong>8-character security limit</strong>.</li>
                <li>When you sign up, an authentication token is explicitly sent to your Email. You <strong>must</strong> open your Inbox and click the confirmation link before your account goes active.</li>
                <li>No one can silently observe your group expenses unless mathematically invited via the <code>add_member_by_email()</code> SQL Remote Procedure Call. Every user inside bantLo is verified!</li>
              </ul>
            </div>

            {/* Offline Sync & Refreshing */}
            <div className="np-section" style={{ borderColor: 'var(--text-danger)', borderStyle: 'solid' }}>
              <h3 style={{ textTransform: 'uppercase', marginBottom: '1rem', color: 'var(--text-danger)' }}>3. Progressive Web Deployment</h3>
              <p className="np-text-muted" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>Because bantLo lives strictly offline natively via PWA Service Workers, updates behave massively different than standard lightweight websites.</p>
              <ul style={{ paddingLeft: '1.2rem', fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <li><strong>Live App Shell:</strong> The moment you load bantLo, the entire application downloads into your browser storage. It launches instantly the next time, even in Airplane Mode.</li>
                <li><strong>Edge Cache Validation:</strong> The engine automatically polls a remote <code>version.info</code> file. If a developer pushes an update, bantLo will automatically throw a massive pop-up prompting you to safely reload and sync the freshest UI!</li>
                <li><strong>Forced Recovery:</strong> If the app ever feels locked on an old version, navigate to the Auth/Login page and click the tiny <em>"Troubleshooting"</em> button at the bottom. This allows you to forcibly nuke the cache and rebuild the binary from scratch!</li>
              </ul>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
