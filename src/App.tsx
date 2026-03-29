import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { useVersionChecker } from './versionPoller';
import Dashboard from './pages/Dashboard';
import GroupDetails from './pages/GroupDetails';
import Settings from './pages/Settings';
import Auth from './pages/Auth';

import LandingPage from './pages/Landing';
import JoinGroup from './pages/JoinGroup';
import About from './pages/About';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPWA, setIsPWA] = useState(false);

  useVersionChecker();

  useEffect(() => {
    // Detect if app is running in standard PWA standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone) {
      setIsPWA(true);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="np-container" style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <p className="np-title" style={{ border: 'none', fontSize: '1.2rem', animation: 'pulse 1.5s infinite' }}>Loading bantLo...</p>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* If installed as PWA and not logged in, force to Auth. Otherwise Landing Page. Logged in always goes to Dashboard. */}
        <Route path="/" element={!session ? (isPWA ? <Navigate to="/auth" /> : <LandingPage />) : <Navigate to="/dashboard" />} />
        
        <Route path="/auth" element={!session ? <Auth /> : (
          localStorage.getItem('bantlo_post_login_redirect') ? (
            (() => {
              const url = localStorage.getItem('bantlo_post_login_redirect')!;
              localStorage.removeItem('bantlo_post_login_redirect');
              return <Navigate to={url} />;
            })()
          ) : <Navigate to="/dashboard" />
        )} />
        
        {/* Protected Dashboard Routes */}
        <Route path="/dashboard" element={session ? <Dashboard /> : <Navigate to="/auth" />} />
        <Route path="/groups/:id" element={session ? <GroupDetails /> : <Navigate to="/auth" />} />
        <Route path="/settings" element={session ? <Settings /> : <Navigate to="/auth" />} />
        <Route path="/join/:inviteId" element={<JoinGroup />} />
        <Route path="/about" element={<About />} />
        
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
