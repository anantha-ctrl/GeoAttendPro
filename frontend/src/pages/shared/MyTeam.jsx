import { useEffect, useState, useCallback } from 'react';
import api, { apiError } from '../../api/client.js';
import Avatar from '../../components/Avatar.jsx';
import { fmtTime, fmtHours, statusColor, prettyStatus } from '../../utils/format.js';

export default function MyTeam() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [team, setTeam] = useState({ members: [], summary: {} });
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get('/team', { params: { date } })
      .then((r) => setTeam(r.data.data)).catch((e) => setError(apiError(e)));
  }, [date]);

  // Live: refresh every 30s.
  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  const s = team.summary || {};
  const cards = [
    { label: 'Team Size', value: s.total ?? 0, icon: 'people', color: '#6366f1' },
    { label: 'Present', value: s.present ?? 0, icon: 'check-circle', color: '#10b981' },
    { label: 'Late', value: s.late ?? 0, icon: 'clock-history', color: '#f59e0b' },
    { label: 'Not In', value: s.absent ?? 0, icon: 'dash-circle', color: '#ef4444' },
  ];

  return (
    <>
      <div className="page-head">
        <div><h4 className="fw-bold">My Team</h4>
          <div className="sub">Live attendance of your direct reports</div></div>
        <input type="date" className="form-control" style={{ maxWidth: 190 }}
          value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="row g-3 mb-3">
        {cards.map((c) => (
          <div className="col-6 col-lg-3" key={c.label}>
            <div className="card stat-card h-100"><div className="card-body d-flex align-items-center gap-3">
              <span className="d-inline-flex align-items-center justify-content-center rounded-3"
                style={{ width: 46, height: 46, background: `${c.color}1a`, color: c.color }}>
                <i className={`bi bi-${c.icon} fs-5`} />
              </span>
              <div><div className="fs-4 fw-bold lh-1">{c.value}</div>
                <div className="text-muted small">{c.label}</div></div>
            </div></div>
          </div>
        ))}
      </div>

      <div className="card stat-card"><div className="card-body p-0">
        <div className="table-responsive">
          <table className="table gap-table table-hover">
            <thead><tr>
              <th>Member</th><th>Department</th><th>Shift</th>
              <th>Check-in</th><th>Check-out</th><th>Hours</th><th>Status</th></tr></thead>
            <tbody>
              {team.members.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-5 text-muted">
                  <i className="bi bi-people fs-3 d-block mb-2 opacity-50" />No team members assigned to you yet.
                </td></tr>
              ) : team.members.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      <Avatar name={m.full_name} photo={m.profile_photo} />
                      <div><div className="fw-semibold">{m.full_name}</div>
                        <div className="text-muted" style={{ fontSize: '.72rem' }}>{m.employee_code}</div></div>
                    </div>
                  </td>
                  <td>{m.department_name || '—'}</td>
                  <td>{m.shift_name || '—'}</td>
                  <td>{fmtTime(m.check_in_time)}{m.is_late ? <span className="badge text-bg-warning ms-1">late</span> : ''}</td>
                  <td>{fmtTime(m.check_out_time)}</td>
                  <td>{fmtHours(m.working_minutes)}</td>
                  <td>
                    {m.check_in_time
                      ? <span className={`badge text-bg-${statusColor(m.attendance_status)} badge-status`}>{prettyStatus(m.attendance_status)}</span>
                      : <span className="badge text-bg-light">Not in</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div></div>
    </>
  );
}
