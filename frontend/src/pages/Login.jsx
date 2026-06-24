import { useState, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../context/I18nContext.jsx';
import { apiError } from '../api/client.js';
import AuthShell from '../components/AuthShell.jsx';
import PasswordInput from '../components/PasswordInput.jsx';

export default function Login() {
  const { login } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const email = (emailRef.current?.value || '').trim();
    const password = passwordRef.current?.value || '';
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setBusy(true);
    try {
      const user = await login(email, password);
      nav(['super_admin', 'admin'].includes(user.role) ? '/admin' : '/me');
    } catch (err) {
      setError(apiError(err, 'Login failed.'));
    } finally {
      setBusy(false);
    }
  };

  const fillDemo = (demoEmail, demoPass) => {
    if (emailRef.current) emailRef.current.value = demoEmail;
    if (passwordRef.current) passwordRef.current.value = demoPass;
    setError('');
  };

  return (
    <AuthShell>
      <h3 className="fw-bold mb-1">{t('Welcome back')} 👋</h3>
      <p className="text-muted mb-4">{t('Sign in to your account')}.</p>

      {sp.get('expired') && (
        <div className="alert alert-warning py-2 small">Your session expired. Please log in again.</div>
      )}
      {error && <div className="alert alert-danger py-2 small">{error}</div>}

      <form onSubmit={submit}>
        <div className="mb-3">
          <label className="form-label small fw-semibold">{t('Email')}</label>
          <input ref={emailRef} type="email" name="email" className="form-control form-control-lg" required autoFocus
            autoComplete="username" placeholder="you@company.com" />
        </div>
        <div className="mb-2">
          <label className="form-label small fw-semibold">{t('Password')}</label>
          <PasswordInput ref={passwordRef} name="password" className="form-control-lg" required
            autoComplete="current-password" placeholder="••••••••" />
        </div>
        <div className="text-end mb-4">
          <Link to="/forgot-password" className="small link-gap">{t('Forgot password?')}</Link>
        </div>
        <button className="btn btn-gap btn-lg w-100" disabled={busy}>
          {busy ? t('Signing in…') : t('Sign In')}
        </button>
      </form>

      <div className="mt-4 text-center">
        <div className="small text-muted mb-1">Quick demo login — click to fill:</div>
        <div className="d-flex gap-2 justify-content-center flex-wrap">
          <button type="button" className="btn btn-sm btn-outline-secondary"
            onClick={() => fillDemo('superadmin@geoattend.test', 'Admin@123')}>Super Admin</button>
          <button type="button" className="btn btn-sm btn-outline-secondary"
            onClick={() => fillDemo('hr@geoattend.test', 'Admin@123')}>HR / Admin</button>
          <button type="button" className="btn btn-sm btn-outline-secondary"
            onClick={() => fillDemo('john@geoattend.test', 'Employee@123')}>Employee</button>
        </div>
      </div>
    </AuthShell>
  );
}
