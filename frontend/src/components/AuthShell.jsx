import { Link } from 'react-router-dom';
import BrandLogo from './BrandLogo.jsx';

const FEATURES = [
  { icon: 'geo-alt-fill', title: 'GPS Verification', text: 'Location-verified attendance from anywhere in the field.' },
  { icon: 'camera-fill', title: 'Live Selfie Proof', text: 'Real-time selfie capture prevents fake attendance.' },
  { icon: 'clock-history', title: 'Real-Time Tracking', text: 'Live dashboards, working hours & attendance %.' },
  { icon: 'shield-lock-fill', title: 'Secure & Audited', text: 'Role-based access, CSRF protection & full activity logs.' },
];

/**
 * Split-screen auth layout: gradient brand panel (left) + form slot (right).
 * Shared by Login, Forgot Password and Reset Password for a consistent look.
 */
export default function AuthShell({ children }) {
  return (
    <div className="login-split">
      <div className="login-brand">
        <div className="lb-content">
          <div className="lb-logo"><BrandLogo height={36} dark /></div>
          <h2 className="fw-bold mb-2" style={{ lineHeight: 1.15 }}>
            Smart workforce<br />attendance tracking
          </h2>
          <p className="opacity-75 mb-4">
            GPS + live selfie verified attendance for remote and field teams — no office required.
          </p>
          {FEATURES.map((f) => (
            <div className="feat" key={f.title}>
              <div className="feat-ico"><i className={`bi bi-${f.icon}`} /></div>
              <div>
                <div className="fw-semibold">{f.title}</div>
                <div className="opacity-75 small">{f.text}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="login-form-side">
        <Link to="/" className="auth-link auth-home"><i className="bi bi-arrow-left" />Back to home</Link>
        <div className="login-form-box">
          <div className="login-brand-mini">
            <BrandLogo height={34} />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
