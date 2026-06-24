import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import api, { apiError } from '../api/client.js';
import AuthShell from '../components/AuthShell.jsx';
import PasswordInput from '../components/PasswordInput.jsx';

export default function ResetPassword() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const email = sp.get('email') || '';
  const token = sp.get('token') || '';

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      await api.post('/auth/reset-password', {
        email, token, password, password_confirmation: confirm,
      });
      nav('/login?reset=1');
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <h3 className="fw-bold mb-1">Reset Password</h3>
      <p className="text-muted mb-4">Set a new password for your account.</p>
      {!token && <div className="alert alert-warning py-2 small">Missing reset token.</div>}
      {error && <div className="alert alert-danger py-2 small">{error}</div>}
      <form onSubmit={submit}>
        <label className="form-label small fw-semibold">New password</label>
        <div className="mb-3">
          <PasswordInput className="form-control-lg" value={password} required minLength={8}
            onChange={(e) => setPassword(e.target.value)} />
        </div>
        <label className="form-label small fw-semibold">Confirm password</label>
        <div className="mb-3">
          <PasswordInput className="form-control-lg" value={confirm} required
            onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <button className="btn btn-gap btn-lg w-100" disabled={busy || !token}>
          {busy ? 'Updating…' : 'Update password'}
        </button>
      </form>
      <div className="text-center mt-3 small"><Link to="/login">Back to login</Link></div>
    </AuthShell>
  );
}
