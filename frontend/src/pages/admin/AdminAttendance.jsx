import { useEffect, useState } from 'react';
import api, { API_BASE } from '../../api/client.js';
import { fmtTime, fmtHours, statusColor, prettyStatus } from '../../utils/format.js';

export default function AdminAttendance() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/reports/daily', { params: { date } })
      .then((r) => setRows(r.data.data.rows))
      .finally(() => setLoading(false));
  }, [date]);

  return (
    <>
      <div className="page-head">
        <div><h4 className="fw-bold">Daily Attendance</h4><div className="sub">GPS &amp; selfie verified check-ins</div></div>
        <input type="date" className="form-control" style={{ maxWidth: 200 }}
          value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div className="card stat-card"><div className="card-body p-0">
        <div className="table-responsive">
          <table className="table gap-table table-hover">
            <thead>
              <tr><th>Code</th><th>Name</th><th>Dept</th><th>Check In</th><th>Check Out</th>
                <th>Hours</th><th>Status</th><th>Location</th><th>Selfie</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-4">Loading…</td></tr>
              ) : rows.map((r) => (
                <tr key={r.user_id}>
                  <td>{r.employee_code}</td>
                  <td className="fw-semibold">{r.full_name}</td>
                  <td>{r.department_name || '—'}</td>
                  <td>{fmtTime(r.check_in_time)} {r.is_late ? <span className="badge text-bg-warning">late</span> : null}</td>
                  <td>{fmtTime(r.check_out_time)}</td>
                  <td>{fmtHours(r.working_minutes)}</td>
                  <td><span className={`badge text-bg-${statusColor(r.status || 'absent')} badge-status`}>
                    {prettyStatus(r.status || 'absent')}</span></td>
                  <td>
                    {r.check_in_lat ? (
                      <a target="_blank" rel="noreferrer"
                        href={`https://www.google.com/maps?q=${r.check_in_lat},${r.check_in_lng}`}>
                        <i className="bi bi-geo-alt-fill text-danger" /> Map
                      </a>
                    ) : '—'}
                  </td>
                  <td>
                    {r.check_in_selfie ? (
                      <a target="_blank" rel="noreferrer" href={`${API_BASE}${r.check_in_selfie}`}>
                        <img src={`${API_BASE}${r.check_in_selfie}`} alt="selfie"
                          style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6 }} />
                      </a>
                    ) : '—'}
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
