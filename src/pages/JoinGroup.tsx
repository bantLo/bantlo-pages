import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { fetchInviteMetadata, acceptGroupInvite } from '../lib/api';
import NeoButton from '../components/NeoButton';
import Logo from '../components/Logo';

export default function JoinGroup() {
  const { inviteId } = useParams<{ inviteId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [invite, setInvite] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string, type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  useEffect(() => {
    if (inviteId) {
      loadInvite(inviteId);
    }
  }, [inviteId]);

  const loadInvite = async (id: string) => {
    try {
      const data = await fetchInviteMetadata(id);
      setInvite(data);
    } catch (err: any) {
      setError('This invite link is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      // Save current URL to redirect back after login
      localStorage.setItem('bantlo_post_login_redirect', window.location.pathname);
      navigate('/auth');
      return;
    }

    setIsProcessing(true);
    try {
      const groupId = await acceptGroupInvite(inviteId!);
      navigate(`/groups/${groupId}`);
    } catch (err: any) {
      setToastMessage({ text: err.message || 'Failed to join group', type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) return (
    <div className="np-container">
      <Logo />
      <div className="np-section" style={{ textAlign: 'center', marginTop: '2rem' }}>
        <p className="np-text-muted" style={{ animation: 'pulse 1.5s infinite' }}>Verifying Invitation...</p>
      </div>
    </div>
  );

  if (error || !invite) return (
    <div className="np-container">
      <Logo />
      <div className="np-section" style={{ textAlign: 'center', marginTop: '2rem', borderStyle: 'dashed' }}>
        <h2 style={{ color: 'var(--text-danger)' }}>Invite Expired</h2>
        <p className="np-text-muted">This link is no longer valid. Ask a group member to generate a fresh one!</p>
        <NeoButton to="/dashboard" style={{ marginTop: '1rem' }}>Go to Dashboard</NeoButton>
      </div>
    </div>
  );

  return (
    <div className="np-container">
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--bg-dark)',
          border: '2px solid',
          borderColor: toastMessage.type === 'error' ? 'var(--text-danger)' : (toastMessage.type === 'info' ? 'cyan' : 'var(--text-accent)'),
          color: toastMessage.type === 'error' ? 'var(--text-danger)' : (toastMessage.type === 'info' ? 'cyan' : 'black'),
          backgroundColor: toastMessage.type === 'success' ? 'var(--text-accent)' : 'var(--bg-dark)',
          padding: '0.75rem 1.5rem',
          zIndex: 9999,
          boxShadow: '4px 4px 0px rgba(0,0,0,0.8)',
          minWidth: '250px',
          textAlign: 'center',
          fontWeight: 'bold',
          transition: 'all 0.3s ease-in-out'
        }}>
          {toastMessage.text}
        </div>
      )}
      <Logo />
      <div className="np-section" style={{ marginTop: '2rem', borderColor: 'var(--text-accent)' }}>
        <p className="np-text-muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Invitation Received ›</p>
        <h1 className="np-title" style={{ border: 'none', fontSize: '2rem', marginBottom: '1.5rem' }}>
          Join {invite.group?.name}?
        </h1>
        
        <p style={{ lineHeight: '1.6', marginBottom: '2rem' }}>
          You've been invited to join this group on <strong>bantLo</strong>. 
          Once you join, you'll be able to view expenses, log new records, and settle up balances with other members.
        </p>

        <NeoButton 
          variant="primary" 
          onClick={handleJoin} 
          disabled={isProcessing}
          style={{ width: '100%', height: '3.5rem', fontSize: '1.1rem' }}
        >
          {isProcessing ? 'Processing...' : 'Accept Invitation ›'}
        </NeoButton>
        
        <NeoButton 
          to="/dashboard" 
          style={{ width: '100%', marginTop: '1rem' }}
        >
          Decline
        </NeoButton>
      </div>
      
      <p style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
        Link expires: {new Date(invite.expires_at).toLocaleString()}
      </p>
    </div>
  );
}
