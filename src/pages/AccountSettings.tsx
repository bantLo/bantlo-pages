import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { deleteAccount } from '../lib/api';
import BackButton from '../components/BackButton';
import NeoButton from '../components/NeoButton';

export default function AccountSettings() {
  const [deleteStage, setDeleteStage] = useState<'none' | 'confirm' | 'countdown'>('none');
  const [timer, setTimer] = useState(30);

  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');

  const [newDisplayName, setNewDisplayName] = useState('');
  const [displayNameMsg, setDisplayNameMsg] = useState('');

  useEffect(() => {
    let interval: any;
    if (deleteStage === 'countdown' && timer > 0) {
      interval = setInterval(() => {
        setTimer((t) => t - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [deleteStage, timer]);

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      setPasswordMsg('Password must be at least 6 characters.');
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setPasswordMsg(error.message);
    } else {
      setPasswordMsg('Password instantly updated!');
      setNewPassword('');
    }
  };

  const handleUpdateDisplayName = async () => {
    if (!newDisplayName || newDisplayName.length < 2) {
      setDisplayNameMsg('Display Name must be at least 2 characters.');
      return;
    }
    const { error } = await supabase.auth.updateUser({ data: { full_name: newDisplayName } });
    if (error) {
      setDisplayNameMsg(error.message);
    } else {
      setDisplayNameMsg('Display Name instantly updated!');
      setNewDisplayName('');
    }
  };

  const handleDeleteAccount = async () => {
    if (timer > 0) return;
    try {
      await deleteAccount();
      localStorage.clear();
      await supabase.auth.signOut();
      alert("ACCOUNT DELETED. All your financial data and profile have been permanently purged from our primary database.");
      window.location.assign('/');
    } catch (err: any) {
      alert(err.message || 'Deletion failed');
      setDeleteStage('none');
      setTimer(30);
    }
  };

  return (
    <div className="np-container">
      <div className="np-flex-between" style={{ marginBottom: '1.5rem' }}>
        <h1 className="np-title" style={{ margin: 0 }}>Account Settings</h1>
        <BackButton fallback="/settings" />
      </div>

      <div className="np-section" style={{ borderStyle: 'dotted', marginBottom: '1.5rem' }}>
        <p className="np-text-muted" style={{ marginBottom: '1rem', textTransform: 'uppercase', fontSize: '0.8rem' }}>Profile Identity</p>
        <input 
          type="text" 
          value={newDisplayName}
          onChange={e => {
            setNewDisplayName(e.target.value);
            setDisplayNameMsg('');
          }}
          placeholder="New Display Name..." 
          maxLength={30}
          style={{ width: '100%', padding: '0.75rem', marginBottom: '0.75rem', background: 'var(--bg-dark)', border: '2px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit' }}
        />
        <NeoButton style={{ width: '100%', borderColor: 'var(--text-secondary)' }} onClick={handleUpdateDisplayName}>
          Update Display Name
        </NeoButton>
        {displayNameMsg && (
          <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: displayNameMsg.includes('updated') ? 'var(--text-accent)' : 'var(--text-danger)' }}>
            {displayNameMsg}
          </p>
        )}
      </div>

      <div className="np-section" style={{ borderStyle: 'dotted', marginBottom: '1.5rem' }}>
        <p className="np-text-muted" style={{ marginBottom: '1rem', textTransform: 'uppercase', fontSize: '0.8rem' }}>Security & Credentials</p>
        <input 
          type="password" 
          value={newPassword}
          onChange={e => {
            setNewPassword(e.target.value);
            setPasswordMsg('');
          }}
          placeholder="Enter new password..." 
          style={{ width: '100%', padding: '0.75rem', marginBottom: '0.75rem', background: 'var(--bg-dark)', border: '2px solid var(--border-color)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit' }}
        />
        <NeoButton style={{ width: '100%', borderColor: 'var(--text-secondary)' }} onClick={handleUpdatePassword}>
          Update Password
        </NeoButton>
        {passwordMsg && (
          <p style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: passwordMsg.includes('updated') ? 'var(--text-accent)' : 'var(--text-danger)' }}>
            {passwordMsg}
          </p>
        )}
      </div>

      {/* Danger Zone */}
      <div className="np-section" style={{ borderColor: 'var(--text-danger)', marginTop: '2.5rem' }}>
        <h3 className="np-title" style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-danger)', border: 'none' }}>DANGER ZONE</h3>
        
        {deleteStage === 'none' && (
          <>
            <p className="np-text-muted" style={{ fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Permanent Account Deletion. This will remove your financial history and all group memberships.
            </p>
            <NeoButton 
              variant="danger" 
              style={{ width: '100%', borderColor: 'var(--text-danger)', color: 'var(--text-danger)' }}
              onClick={() => setDeleteStage('confirm')}
            >
              Delete User Account
            </NeoButton>
          </>
        )}

        {deleteStage === 'confirm' && (
          <div style={{ padding: '1rem', background: 'rgba(255, 100, 100, 0.1)', border: '2px solid var(--text-danger)' }}>
            <p style={{ color: 'var(--text-danger)', fontWeight: 'bold', marginBottom: '1rem' }}>WARNING: IRREVERSIBLE ACTION</p>
            <p className="np-text-muted" style={{ fontSize: '0.8rem', marginBottom: '1rem' }}>
              Your debt data and profile will be wiped. To remove your email from our auth registry after deletion, contact <strong>bantlo.expenses@gmail.com</strong>.
            </p>
            <div style={{ display: 'flex', gap: '1rem' }}>
               <NeoButton 
                variant="primary" 
                style={{ flex: 1, backgroundColor: 'var(--text-danger)', border: 'none' }}
                onClick={() => setDeleteStage('countdown')}
              >
                I Understand, Proceed
              </NeoButton>
              <NeoButton 
                variant="default" 
                style={{ flex: 1 }}
                onClick={() => setDeleteStage('none')}
              >
                Abort
              </NeoButton>
            </div>
          </div>
        )}

        {deleteStage === 'countdown' && (
          <div style={{ textAlign: 'center', padding: '1.5rem', border: '2px solid var(--text-danger)' }}>
            <h4 style={{ color: 'var(--text-danger)', marginBottom: '1rem' }}>CALCULATING WIPE MATRIX...</h4>
            <p style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '1.5rem' }}>{timer}s</p>
            <NeoButton 
              variant="primary" 
              disabled={timer > 0}
              onClick={handleDeleteAccount}
              style={{ width: '100%', backgroundColor: timer === 0 ? 'var(--text-danger)' : 'var(--bg-dark)', border: timer === 0 ? 'none' : '2px solid var(--border-color)' }}
            >
              {timer > 0 ? 'WAITING FOR CONFIRMATION' : 'DELETE FOREVER'}
            </NeoButton>
            <button 
              onClick={() => { setDeleteStage('none'); setTimer(30); }}
              style={{ marginTop: '1rem', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', opacity: 0.7 }}
            >
              STOP AND RE-INITIALIZE (CANCEL)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
