import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import NeoButton from '../components/NeoButton';
import Logo from '../components/Logo';

export default function UpdatePassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'error' | 'success' } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Clear the recovery flag since we're now on the recovery page
    localStorage.removeItem('bantlo_recovery');
  }, []);

  // Auto-dismiss messages after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        // Do not auto-dismiss if it's the success message right before redirect
        if (message.type !== 'success') {
          setMessage(null);
        }
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setMessage({ text: 'Password must be at least 8 characters long.', type: 'error' });
      return;
    }
    if (password !== confirmPassword) {
      setMessage({ text: 'Passwords do not match.', type: 'error' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      
      setMessage({ text: 'Password updated successfully! Redirecting...', type: 'success' });
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (error: any) {
      setMessage({ text: error.message || 'Failed to update password.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="np-container" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', justifyContent: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
        <Logo />
      </div>

      <div className="np-section" style={{ boxShadow: 'var(--shadow-neopop)' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', textTransform: 'uppercase' }}>
          Update Password
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

        <form onSubmit={handleUpdate}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.85rem', textTransform: 'uppercase' }}>
              NEW PASSWORD <span style={{ color: 'var(--text-danger)' }}>*</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              style={{
                width: '100%',
                padding: '0.75rem',
                marginBottom: '1rem',
                background: 'var(--bg-dark)',
                border: '2px solid var(--border-color)',
                color: 'var(--text-primary)',
                outline: 'none',
                fontFamily: 'inherit'
              }}
              placeholder="••••••••"
            />
            
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '0.85rem', textTransform: 'uppercase' }}>
              CONFIRM NEW PASSWORD <span style={{ color: 'var(--text-danger)' }}>*</span>
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
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

          <NeoButton 
            type="submit" 
            variant="primary" 
            style={{ width: '100%' }}
            disabled={loading}
          >
            {loading ? 'Updating...' : 'Update Password'}
          </NeoButton>
        </form>
      </div>
    </div>
  );
}
