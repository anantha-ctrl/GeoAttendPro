import { useEffect, useState } from 'react';
import api from '../../api/client.js';

export default function SecurityLogs() {
  const [tab, setTab] = useState('login');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const url = tab === 'login' ? '/security/login-history' : '/security/activity-logs';
    api.get(url, { params: { per_page: 50 } })
      .then((r) => setRows(r.data.data.data))
      .finally(() => setLoading(false));
  }, [tab]);

  return (
    <>
      <div className="page-head">
        <div><h4 className="fw-bold">Security &amp; Audit Logs</h4><div className="sub">Login history &amp; activity trail</div></div>
      </div>
      <ul className="nav nav-pills mb-3">
        <li className="nav-item">
          <button className={`nav-link ${tab === 'login' ? 'active' : ''}`} onClick={() => setTab('login')}>
            Login History
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${tab === 'activity' ? 'active' : ''}`} onClick={() => setTab('activity')}>
            Activity Logs
          </button>
        </li>
      </ul>

      <div className="card stat-card"><div className="card-body p-0">
        <div className="table-responsive">
          {tab === 'login' ? (
            <table className="table gap-table table-sm table-hover">
              <thead><tr>
                <th>User</th><th>Email</th><th>Login</th><th>Logout</th><th>IP</th><th>Status</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={6} className="text-center py-3">Loading…</td></tr> :
                  rows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.full_name || '—'}</td><td>{r.email}</td>
                      <td>{r.login_at || '—'}</td><td>{r.logout_at || '—'}</td>
                      <td>{r.ip_address}</td>
                      <td><span className={`badge text-bg-${r.status === 'success' ? 'success' : r.status === 'failed' ? 'danger' : 'secondary'}`}>{r.status}</span></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ) : (
            <table className="table gap-table table-sm table-hover">
              <thead><tr>
                <th>User</th><th>Action</th><th>Entity</th><th>Description</th><th>IP</th><th>When</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={6} className="text-center py-3">Loading…</td></tr> :
                  rows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.full_name || '—'}</td>
                      <td><code>{r.action}</code></td>
                      <td>{r.entity || '—'}</td>
                      <td>{r.description || '—'}</td>
                      <td>{r.ip_address}</td>
                      <td>{r.created_at}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </div></div>
    </>
  );
}
