import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useI18n } from '../context/I18nContext.jsx';
import api from '../api/client.js';
import Avatar from './Avatar.jsx';
import BrandLogo from './BrandLogo.jsx';
import WorkdayMonitor from './WorkdayMonitor.jsx';

const adminNav = [
  { to: '/admin', icon: 'speedometer2', label: 'Dashboard', end: true },
  { to: '/admin/employees', icon: 'people', label: 'Employees' },
  { to: '/admin/departments', icon: 'diagram-3', label: 'Departments' },
  { to: '/admin/designations', icon: 'briefcase', label: 'Designations' },
  { to: '/admin/attendance', icon: 'geo-alt', label: 'Attendance' },
  { to: '/admin/map', icon: 'map', label: 'Live Map' },
  { to: '/admin/live', icon: 'broadcast', label: 'Live Status' },
  { to: '/calendar', icon: 'calendar3', label: 'Calendar' },
  { to: '/leaves', icon: 'calendar-check', label: 'Leaves' },
  { to: '/regularize', icon: 'pencil-square', label: 'Regularization' },
  { to: '/expenses', icon: 'receipt', label: 'Expenses' },
  { to: '/tasks', icon: 'list-task', label: 'Tasks' },
  { to: '/meetings', icon: 'camera-video', label: 'Meetings' },
  { to: '/help-desk', icon: 'headset', label: 'Help Desk' },
  { to: '/notice-board', icon: 'megaphone', label: 'Notice Board' },
  { to: '/documents', icon: 'folder', label: 'Documents' },
  { to: '/admin/holidays', icon: 'calendar-event', label: 'Holidays' },
  { to: '/admin/shifts', icon: 'clock', label: 'Shifts' },
  { to: '/admin/clients', icon: 'person-vcard', label: 'Clients' },
  { to: '/admin/purchases', icon: 'bag-check', label: 'Purchases' },
  { to: '/payroll', icon: 'cash-coin', label: 'Payroll' },
  { to: '/admin/reports', icon: 'file-earmark-bar-graph', label: 'Reports' },
  { to: '/admin/security', icon: 'shield-lock', label: 'Security Logs' },
  { to: '/admin/settings', icon: 'gear', label: 'Settings' },
];

const employeeNav = [
  { to: '/me', icon: 'speedometer2', label: 'Dashboard', end: true },
  { to: '/me/attendance', icon: 'camera', label: 'Mark Attendance' },
  { to: '/me/history', icon: 'clock-history', label: 'Attendance History' },
  { to: '/calendar', icon: 'calendar3', label: 'Calendar' },
  { to: '/leaves', icon: 'calendar-check', label: 'My Leaves' },
  { to: '/regularize', icon: 'pencil-square', label: 'Regularization' },
  { to: '/notice-board', icon: 'megaphone', label: 'Notice Board' },
  { to: '/holidays', icon: 'calendar-event', label: 'Holidays' },
  { to: '/expenses', icon: 'receipt', label: 'Expenses' },
  { to: '/tasks', icon: 'list-task', label: 'My Tasks' },
  { to: '/meetings', icon: 'camera-video', label: 'Meetings' },
  { to: '/help-desk', icon: 'headset', label: 'Help Desk' },
  { to: '/documents', icon: 'folder', label: 'My Documents' },
  { to: '/payroll', icon: 'cash-coin', label: 'Payslip' },
  { to: '/profile', icon: 'person-circle', label: 'Profile' },
];

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState({ items: [], unread_count: 0 });
  const [bellOpen, setBellOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const bellRef = useRef(null);
  const profileRef = useRef(null);

  // Managers (anyone with direct reports) get a "My Team" link.
  const teamLink = { to: '/team', icon: 'diagram-2', label: 'My Team' };
  const baseLinks = isAdmin ? adminNav : employeeNav;
  const links = user?.is_manager
    ? [baseLinks[0], teamLink, ...baseLinks.slice(1)]
    : baseLinks;

  useEffect(() => { setOpen(false); setBellOpen(false); setProfileOpen(false); }, [location.pathname]);

  // Poll notifications every 30s (near real-time).
  const loadNotifs = () =>
    api.get('/notifications', { params: { limit: 15 } })
      .then((r) => setNotifs(r.data.data))
      .catch(() => {});

  useEffect(() => {
    loadNotifs();
    const id = setInterval(loadNotifs, 30000);
    return () => clearInterval(id);
  }, []);

  // Close dropdowns on outside click.
  useEffect(() => {
    const onClick = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const toggleBell = async () => {
    const next = !bellOpen;
    setBellOpen(next);
    if (next) await loadNotifs();
  };

  const markAllRead = async () => {
    await api.patch('/notifications/read', {});
    loadNotifs();
  };

  const handleLogout = async () => {
    await logout();
    nav('/');
  };

  return (
    <div className="app-shell">
      <WorkdayMonitor />
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand"><BrandLogo height={30} dark /></div>
        <div className="nav-label">{t(isAdmin ? 'Management' : 'Menu')}</div>
        <nav className="pb-3">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}
              className={({ isActive }) => (isActive ? 'active' : '')}>
              <i className={`bi bi-${l.icon}`} />{t(l.label)}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="content">
        <header className="topbar">
          {/* Left: menu (mobile/tablet) / live indicator (desktop) */}
          <button className="btn btn-sm btn-light d-lg-none" onClick={() => setOpen((o) => !o)} aria-label="Menu">
            <i className="bi bi-list fs-5" />
          </button>
          <div className="d-none d-lg-flex align-items-center gap-2 text-muted small">
            <span className="live-dot" /> {t('Live')}
          </div>

          {/* Centre: brand (mobile/tablet only) */}
          <div className="topbar-brand d-lg-none"><BrandLogo height={26} /></div>

          <div className="ms-auto d-flex align-items-center gap-2 gap-md-3">
            {/* Notification dropdown */}
            <div className="position-relative" ref={bellRef}>
              <button className="bell-btn" onClick={toggleBell} title="Notifications">
                <i className="bi bi-bell fs-6" />
                {notifs.unread_count > 0 && (
                  <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger"
                    style={{ fontSize: '.6rem' }}>
                    {notifs.unread_count}
                  </span>
                )}
              </button>
              {bellOpen && (
                <div className="notif-panel">
                  <div className="d-flex justify-content-between align-items-center px-3 py-2 border-bottom">
                    <span className="fw-semibold small">{t('Notifications')}</span>
                    {notifs.unread_count > 0 && (
                      <button className="btn btn-link btn-sm p-0 small" onClick={markAllRead}>{t('Mark all read')}</button>
                    )}
                  </div>
                  {notifs.items.length === 0 ? (
                    <div className="text-muted small text-center py-4">{t('No notifications.')}</div>
                  ) : notifs.items.map((n) => (
                    <div key={n.id} className={`notif-item d-flex gap-2 ${n.is_read ? '' : 'unread'}`}>
                      {!n.is_read && <span className="notif-dot mt-1" />}
                      <div className="flex-grow-1">
                        <div className="small fw-semibold">{n.title}</div>
                        <div className="text-muted" style={{ fontSize: '.78rem' }}>{n.message}</div>
                        <div className="text-muted" style={{ fontSize: '.68rem' }}>{n.created_at}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Profile dropdown */}
            <div className="position-relative" ref={profileRef}>
              <button type="button" className="topbar-user" onClick={() => setProfileOpen((o) => !o)}>
                <Avatar name={user?.full_name} photo={user?.profile_photo} size={38} />
                <div className="text-end d-none d-sm-block">
                  <div className="fw-semibold small lh-1">{user?.full_name}</div>
                  <div className="text-muted" style={{ fontSize: '.72rem' }}>{user?.role_name}</div>
                </div>
                <i className="bi bi-chevron-down small d-none d-sm-block text-muted" />
              </button>
              {profileOpen && (
                <div className="profile-menu">
                  <div className="profile-menu-head">
                    <Avatar name={user?.full_name} photo={user?.profile_photo} size={40} />
                    <div className="overflow-hidden">
                      <div className="fw-semibold small text-truncate">{user?.full_name}</div>
                      <div className="text-muted text-truncate" style={{ fontSize: '.72rem' }}>{user?.email}</div>
                    </div>
                  </div>
                  <Link to="/profile" className="profile-menu-item"><i className="bi bi-person" />{t('My Profile')}</Link>
                  <Link to="/profile#change-password" className="profile-menu-item"><i className="bi bi-shield-lock" />{t('Change Password')}</Link>
                  {isAdmin && (
                    <Link to="/admin/settings" className="profile-menu-item"><i className="bi bi-gear" />{t('Settings')}</Link>
                  )}
                  <button type="button" className="profile-menu-item text-danger" onClick={handleLogout}>
                    <i className="bi bi-box-arrow-right" />{t('Logout')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="page">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
