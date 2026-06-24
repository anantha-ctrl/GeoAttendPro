import { useEffect, useState, useCallback } from 'react';
import api, { apiError } from '../../api/client.js';
import Avatar from '../../components/Avatar.jsx';
import WorkStatusBadge from '../../components/WorkStatusBadge.jsx';

const fmt = (min) => {
  min = Math.max(0, Math.round(min || 0));
  const h = Math.floor(min / 60);
  return h ? `${h}h ${min % 60}m` : `${min}m`;
};
const loginTime = (t) => (t ? new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—');

const CARDS = [
  { key: 'working', label: 'Working', cls: 'ws-working' },
  { key: 'rest', label: 'Rest Mode', cls: 'ws-rest' },
  { key: 'overtime', label: 'Overtime', cls: 'ws-overtime' },
  { key: 'logged_out', label: 'Logged Out', cls: 'ws-logged_out' },
];

export default function LiveStatus() {
  const [data, setData] = useState({ tally: {}, employees: [] });
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [updated, setUpdated] = useState(null);

  const load = useCallback(() => {
    api.get('/dashboard/live-board')
      .then((r) => { setData(r.data.data); setUpdated(new Date()); })
      .catch((e) => setError(apiError(e)));
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15000); // real-time refresh
    return () => clearInterval(id);
  }, [load]);

  const rows = filter ? data.employees.filter((e) => e.status === filter) : data.employees;

  return (
    <>
      <div className="page-head">
        <div><h4 className="fw-bold">Live Employee Status</h4>
          <div className="sub">Real-time work tracking · auto-refresh every 15s
            {updated && <span className="ms-2"><span className="live-dot me-1" />{updated.toLocaleTimeString()}</span>}
          </div>
        </div>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}

      {/* Status tally cards (click to filter) */}
      <div className="row g-3 mb-3">
        {CARDS.map((c) => (
          <div className="col-6 col-lg-3" key={c.key}>
            <div className={`card stat-card h-100 ${filter === c.key ? 'border-primary' : ''}`}
              role="button" onClick={() => setFilter((f) => (f === c.key ? '' : c.key))}>
              <div className="card-body d-flex align-items-center justify-content-between">
                <div>
                  <div className="text-muted small">{c.label}</div>
                  <div className="fs-3 fw-bold">{data.tally?.[c.key] ?? 0}</div>
                </div>
                <span className={`ws-dot ${c.cls}`} style={{ width: 18, height: 18, borderRadius: '50%' }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card stat-card"><div className="card-body p-0">
        <table className="table gap-table table-hover align-middle mb-0">
          <thead><tr>
            <th>Employee</th><th>Status</th><th>Login</th>
            <th>Active</th><th>Rest</th><th>Overtime</th>
          </tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-muted py-4">No employees{filter ? ' in this status' : ''}.</td></tr>
            ) : rows.map((e) => (
              <tr key={e.user_id}>
                <td>
                  <div className="d-flex align-items-center gap-2">
                    <Avatar name={e.full_name} photo={e.profile_photo} size={34} />
                    <div>
                      <div className="fw-semibold">{e.full_name}</div>
                      <div className="small text-muted">{e.employee_code} · {e.department_name || '—'}</div>
                    </div>
                  </div>
                </td>
                <td><WorkStatusBadge status={e.status} live={e.status !== 'logged_out'} /></td>
                <td>{loginTime(e.login_time)}</td>
                <td className="fw-semibold text-success">{fmt(e.active_minutes)}</td>
                <td className="text-warning">{fmt(e.rest_minutes)}</td>
                <td className="text-info">{e.overtime_minutes > 0 ? fmt(e.overtime_minutes) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div></div>
    </>
  );
}
