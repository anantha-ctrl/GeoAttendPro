import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import BrandLogo from '../components/BrandLogo.jsx';

const FEATURES = [
  { icon: 'geo-alt-fill', color: '#4f46e5', title: 'GPS Geofencing', text: 'Check-in only inside your office geofence — with multi-branch support and Work-From-Home exceptions.' },
  { icon: 'person-bounding-box', color: '#7c3aed', title: 'Live Selfie + Face Match', text: 'A live selfie is matched against the enrolled face to make proxy or fake attendance impossible.' },
  { icon: 'broadcast', color: '#0ea5e9', title: 'Smart Work-Tracking', text: 'Auto-tracks working & overtime hours from check-in, with a real-time admin live-status board.' },
  { icon: 'speedometer2', color: '#06b6d4', title: 'Real-Time Dashboards', text: 'Live widgets, charts and timelines for present, late, WFH, today vs monthly hours and more.' },
  { icon: 'calendar-check-fill', color: '#10b981', title: 'Leave & WFH', text: 'Apply, approve and track leave & WFH with per-type balances and instant notifications.' },
  { icon: 'cash-coin', color: '#16a34a', title: 'Attendance-Driven Payroll', text: 'Auto payslips with overtime incentive, deductions and a printable, downloadable breakdown.' },
  { icon: 'camera-video-fill', color: '#4f46e5', title: 'Meetings & Video Calls', text: 'Schedule meetings, invite colleagues and join an in-app video call — attendance tracked live.' },
  { icon: 'file-earmark-bar-graph-fill', color: '#f59e0b', title: 'Reports & Analytics', text: 'Live preview, summary analytics and CSV / PDF / print export of attendance & leave data.' },
  { icon: 'shield-lock-fill', color: '#ef4444', title: 'Secure & Audited', text: 'Role-based access, CSRF protection, token sessions and a full activity & security audit log.' },
];

const STEPS = [
  { n: 1, title: 'Sign in', text: 'Employees log in securely from any device, anywhere.' },
  { n: 2, title: 'Verify GPS + Selfie + Face', text: 'Capture live location and a selfie, matched against the enrolled face.' },
  { n: 3, title: 'Check in & work', text: 'Working & overtime hours, status and attendance % are tracked automatically.' },
];

export default function Landing() {
  const { user } = useAuth();
  const dashHref = user ? (['super_admin', 'admin'].includes(user.role) ? '/admin' : '/me') : '/login';

  return (
    <div className="landing">
      {/* Navbar */}
      <nav className="lp-nav">
        <div className="lp-logo"><BrandLogo height={32} /></div>
        <div className="lp-nav-links">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="#contact">Contact</a>
          <Link to={dashHref} className="btn btn-gap btn-sm px-3">
            {user ? 'Go to Dashboard' : 'Login'}
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <header className="lp-hero">
        <div className="container">
          <div className="row align-items-center g-5">
            <div className="col-lg-6">
              <span className="lp-badge"><i className="bi bi-broadcast" /> Live workforce tracking</span>
              <h1 className="mb-3">Smart attendance &amp; workforce platform for modern teams</h1>
              <p className="lead mb-4">
                CloudHawk verifies attendance with <b>GPS geofencing + live selfie + face match</b>, then
                tracks work &amp; overtime in real time — with leave, payroll, meetings, tasks and reports
                in one place. For office, remote and field teams alike.
              </p>
              <div className="d-flex gap-2 flex-wrap">
                <Link to={user ? dashHref : '/login'} className="btn btn-hero btn-lg px-4">
                  {user ? 'Open Dashboard' : 'Get Started'} <i className="bi bi-arrow-right ms-1" />
                </Link>
                <a href="#features" className="btn btn-hero-outline btn-lg px-4">Explore features</a>
              </div>
            </div>

            {/* App preview mockup */}
            <div className="col-lg-6">
              <div className="lp-mock mx-auto" style={{ maxWidth: 380 }}>
                <div className="mock-card">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="fw-bold">Mark Attendance</span>
                    <span className="badge text-bg-success">Present</span>
                  </div>
                  <div className="mock-selfie mb-3"><i className="bi bi-person-bounding-box" /></div>
                  <div className="d-flex align-items-center gap-2 small text-muted mb-1">
                    <i className="bi bi-geo-alt-fill text-danger" /> 12.9716° N, 77.5946° E
                  </div>
                  <div className="d-flex align-items-center gap-2 small text-muted mb-3">
                    <i className="bi bi-clock" /> Checked in 09:28 AM · On time
                  </div>
                  <button className="btn btn-gap w-100" disabled>
                    <i className="bi bi-box-arrow-in-right me-1" /> Checked In
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="lp-stat-bar py-4">
        <div className="container">
          <div className="row text-center g-3">
            <div className="col-6 col-md-3 lp-stat"><h3>GPS + Face</h3><div className="text-muted small">Verified check-in</div></div>
            <div className="col-6 col-md-3 lp-stat"><h3>Live</h3><div className="text-muted small">Work &amp; overtime tracking</div></div>
            <div className="col-6 col-md-3 lp-stat"><h3>All-in-one</h3><div className="text-muted small">Leave · Payroll · Meetings</div></div>
            <div className="col-6 col-md-3 lp-stat"><h3>3</h3><div className="text-muted small">Role levels (RBAC)</div></div>
          </div>
        </div>
      </div>

      {/* Features */}
      <section className="lp-section" id="features">
        <div className="container">
          <div className="text-center mb-5">
            <div className="eyebrow mb-2">Features</div>
            <h2>Everything you need to track your workforce</h2>
          </div>
          <div className="row g-4">
            {FEATURES.map((f) => (
              <div className="col-md-6 col-lg-4" key={f.title}>
                <div className="lp-feature">
                  <div className="fic" style={{ background: `${f.color}1a`, color: f.color }}>
                    <i className={`bi bi-${f.icon}`} />
                  </div>
                  <h5 className="fw-bold">{f.title}</h5>
                  <p className="text-muted mb-0">{f.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="lp-section bg-light" id="how">
        <div className="container">
          <div className="text-center mb-5">
            <div className="eyebrow mb-2">How it works</div>
            <h2>Attendance in three simple steps</h2>
          </div>
          <div className="row g-4">
            {STEPS.map((s) => (
              <div className="col-md-4" key={s.n}>
                <div className="d-flex flex-column align-items-center text-center">
                  <div className="lp-step-num mb-3">{s.n}</div>
                  <h5 className="fw-bold">{s.title}</h5>
                  <p className="text-muted">{s.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="lp-section">
        <div className="container">
          <div className="lp-cta">
            <h2 className="fw-bold mb-2">Ready to modernize your attendance?</h2>
            <p className="opacity-75 mb-4">Start tracking your remote and field workforce in minutes.</p>
            <Link to={user ? dashHref : '/login'} className="btn btn-hero btn-lg px-4">
              {user ? 'Open Dashboard' : 'Get Started Free'} <i className="bi bi-arrow-right ms-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="lp-footer" id="contact">
        <div className="container">
          <div className="row g-3 align-items-center">
            <div className="col-md-6">
              <div className="lp-logo text-white mb-2"><BrandLogo height={34} dark /></div>
              <p className="small mb-0" style={{ opacity: 0.7 }}>
                Smart web-based employee attendance & workforce tracking system.
              </p>
            </div>
            <div className="col-md-6 text-md-end small" style={{ opacity: 0.8 }}>
              <div>© {new Date().getFullYear()} CloudHawk. All rights reserved.</div>
              <div className="mt-1">Designed and Developed by <a href="https://cloudhawk.in" target="_blank" rel="noopener noreferrer">CloudHawk</a></div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
