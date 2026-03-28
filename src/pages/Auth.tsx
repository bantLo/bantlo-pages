import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import BackButton from '../components/BackButton';
import NeoButton from '../components/NeoButton';
import CacheManagerModal from '../components/CacheManagerModal';
import Logo from '../components/Logo';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [viewState, setViewState] = useState<'login' | 'signup' | 'forgot_password'>('login');
  const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null);
  const [isPWA, setIsPWA] = useState(false);
  const [showCacheModal, setShowCacheModal] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone) {
      setIsPWA(true);
    }
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    // Safely nuke any lingering PWA IndexedDB data from previous users
    indexedDB.deleteDatabase('bantlo-data-cache-v1');

    try {
      if (viewState === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (viewState === 'signup') {
        if (!name.trim()) throw new Error('Please enter your full name.');
        if (password !== confirmPassword) throw new Error('Passwords do not match.');
        
        const { error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: { full_name: name },
            emailRedirectTo: window.location.origin
          }
        });
        if (error) throw error;
        setMessage({ text: 'Check your email for the confirmation link!', type: 'success' });
      } else if (viewState === 'forgot_password') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin
        });
        if (error) throw error;
        setMessage({ text: 'Password reset link sent! Check your email.', type: 'success' });
      }
    } catch (error: any) {
      setMessage({ text: error.message || 'Authentication failed', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="np-container" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', justifyContent: 'center' }}>
      
      {!isPWA && (
        <div style={{ position: 'absolute', top: '2rem', left: '2rem' }}>
          <BackButton fallback="/" />
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem', marginTop: !isPWA ? '3rem' : '0' }}>
        <Logo />
      </div>
      
      <div className="np-section" style={{ boxShadow: 'var(--shadow-neopop)' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', textTransform: 'uppercase' }}>
          {viewState === 'login' ? 'Sign In' : viewState === 'signup' ? 'Create Account' : 'Reset Password'}
        </h2>

        {message && (
          <div style={{
            padding: '0.75rem',
            marginBottom: '1rem',
            border: '2px solid',
            borderColor: message.type === 'error' ? 'var(--text-danger)' : 'var(--text-accent)',
            color: message.type === 'error' ? 'var(--text-danger)' : 'var(--text-accent)'
          }}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleAuth}>
          {viewState === 'signup' && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.85rem', textTransform: 'uppercase' }}>
                FULL NAME
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'var(--bg-dark)',
                  border: '2px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  fontFamily: 'inherit'
                }}
                placeholder="John Doe"
              />
            </div>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.85rem', textTransform: 'uppercase' }}>
              EMAIL ADDRESS
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'var(--bg-dark)',
                border: '2px solid var(--border-color)',
                color: 'var(--text-primary)',
                outline: 'none',
                fontFamily: 'inherit'
              }}
              placeholder="you@example.com"
            />
          </div>
          {viewState !== 'forgot_password' && (
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.85rem', textTransform: 'uppercase' }}>
                PASSWORD
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: 'var(--bg-dark)',
                  border: '2px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  fontFamily: 'inherit',
                  marginBottom: viewState === 'signup' ? '1rem' : '0'
                }}
                placeholder="••••••••"
              />
              
              {viewState === 'signup' && (
                <>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.85rem', textTransform: 'uppercase' }}>
                    CONFIRM PASSWORD
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: 'var(--bg-dark)',
                      border: '2px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      fontFamily: 'inherit'
                    }}
                    placeholder="••••••••"
                  />
                </>
              )}
            </div>
          )}
          
          <NeoButton 
            type="submit" 
            variant="primary" 
            style={{ width: '100%' }}
            disabled={loading}
          >
            {loading ? 'Processing...' : viewState === 'login' ? 'Authenticate' : viewState === 'signup' ? 'Sign Up' : 'Send Reset Link'}
          </NeoButton>
        </form>

        <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'center' }}>
          {viewState === 'login' && (
            <>
              <button 
                type="button" 
                onClick={() => setViewState('forgot_password')}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit', padding: '0.5rem' }}
              >
                Forgot Password?
              </button>
              <NeoButton 
                type="button" 
                variant="default"
                onClick={() => setViewState('signup')}
                style={{ width: '100%', marginTop: '0.5rem', borderColor: 'var(--text-accent)' }}
              >
                Create an Account
              </NeoButton>
            </>
          )}
          
          {viewState === 'signup' && (
            <NeoButton 
              type="button" 
              variant="default"
              onClick={() => setViewState('login')}
              style={{ width: '100%', marginTop: '0.5rem' }}
            >
              Already have an account? Sign In
            </NeoButton>
          )}

          {viewState === 'forgot_password' && (
            <NeoButton 
              type="button" 
              variant="default"
              onClick={() => setViewState('login')}
              style={{ width: '100%', marginTop: '0.5rem' }}
            >
              Back to Sign In
            </NeoButton>
          )}
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: 'auto', paddingBottom: '2rem' }}>
        <button 
          onClick={() => setShowCacheModal(true)}
          style={{ 
            background: 'transparent', border: 'none', 
            color: 'var(--text-secondary)', fontSize: '0.75rem', 
            textDecoration: 'underline', cursor: 'pointer', 
            fontFamily: 'inherit', opacity: 0.7 
          }}
        >
          Troubleshooting: Force refresh app or clear cache
        </button>
      </div>

      <CacheManagerModal 
        isOpen={showCacheModal} 
        onClose={() => setShowCacheModal(false)} 
      />
    </div>
  );
}
