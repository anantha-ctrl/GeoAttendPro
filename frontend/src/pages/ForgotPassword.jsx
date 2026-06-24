import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { apiError } from '../api/client.js';
import AuthShell from '../components/AuthShell.jsx';
import PasswordInput from '../components/PasswordInput.jsx';

export default function ForgotPassword() {
  const nav = useNavigate();
  const [step, setStep] = useState(1); // 1 = email, 2 = OTP + new password
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const sendOtp = async (e) => {
    e.preventDefault();
    setMsg(''); setError(''); setBusy(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email });
      setMsg(data.message);
      setStep(2);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  const resetWithOtp = async (e) => {
    e.preventDefault();
    setMsg(''); setError('');
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      await api.post('/auth/reset-password', {
        email, otp, password, password_confirmation: confirm,
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
      <p className="text-muted mb-4">
        {step === 1 ? 'Enter your email and we will send you a 6-digit OTP.' : `Enter the OTP sent to ${email}`}
      </p>

      {msg && <div className="alert alert-success py-2 small">{msg}</div>}
      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      {step === 1 ? (
          <form onSubmit={sendOtp}>
            <label className="form-label small fw-semibold">Registered email</label>
            <input type="email" className="form-control mb-3" value={email} required
              onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
            <button className="btn btn-gap w-100" disabled={busy}>
              {busy ? 'Sending…' : 'Send OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={resetWithOtp}>
            <label className="form-label small fw-semibold">6-digit OTP</label>
            <input className="form-control mb-3 text-center" value={otp} required
              maxLength={6} inputMode="numeric" placeholder="••••••"
              style={{ letterSpacing: '0.5rem', fontWeight: 600 }}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} />
            <label className="form-label small fw-semibold">New password</label>
            <div className="mb-3">
              <PasswordInput value={password} required minLength={8}
                onChange={(e) => setPassword(e.target.value)} />
            </div>
            <label className="form-label small fw-semibold">Confirm new password</label>
            <div className="mb-3">
              <PasswordInput value={confirm} required
                onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <button className="btn btn-gap w-100 mb-2" disabled={busy}>
              {busy ? 'Resetting…' : 'Reset Password'}
            </button>
            <div className="auth-actions">
              <button type="button" className="auth-link"
                onClick={() => { setStep(1); setMsg(''); setError(''); }}>
                <i className="bi bi-arrow-left" />Change email
              </button>
              <button type="button" className="auth-link" onClick={sendOtp} disabled={busy}>
                <i className="bi bi-arrow-clockwise" />Resend OTP
              </button>
            </div>
          </form>
        )}

      <div className="auth-back">
        <Link to="/login" className="auth-link"><i className="bi bi-box-arrow-in-left" />Back to login</Link>
      </div>
    </AuthShell>
  );
}
