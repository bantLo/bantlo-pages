import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null);
  const [isPWA, setIsPWA] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone) {
      setIsPWA(true);
    }
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage({ text: 'Check your email for the confirmation link!', type: 'success' });
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
          <Link to="/" className="np-button" style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}>← Back</Link>
        </div>
      )}

      <h1 className="np-title" style={{ textAlign: 'center', border: 'none', marginBottom: '2rem', marginTop: !isPWA ? '3rem' : '0' }}>bantLo</h1>
      
      <div className="np-section" style={{ boxShadow: 'var(--shadow-neopop)' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', textTransform: 'uppercase' }}>
          {isLogin ? 'Sign In' : 'Create Account'}
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
                fontFamily: 'inherit'
              }}
              placeholder="••••••••"
            />
          </div>
          
          <button 
            type="submit" 
            className="np-button np-button-primary" 
            style={{ width: '100%' }}
            disabled={loading}
          >
            {loading ? 'Processing...' : isLogin ? 'Authenticate' : 'Sign Up'}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <button 
            type="button" 
            onClick={() => setIsLogin(!isLogin)}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: 'var(--text-secondary)', 
              cursor: 'pointer',
              textDecoration: 'underline',
              fontFamily: 'inherit'
            }}
          >
            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
