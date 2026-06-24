import { useEffect, useState } from 'react';
import api from '../../api/client.js';
import { fmtDate, fmtTime, fmtHours, statusColor, prettyStatus } from '../../utils/format.js';

export default function AttendanceHistory() {
  const [result, setResult] = useState({ data: [], meta: {} });
  const [range, setRange] = useState({ from: '', to: '', page: 1 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/attendance/history', { params: { ...range, per_page: 15 } })
      .then((r) => setResult(r.data.data))
      .finally(() => setLoading(false));
  }, [range]);

  const meta = result.meta;

  return (
    <>
      <div className="page-head">
        <div><h4 className="fw-bold">Attendance History</h4><div className="sub">Your past check-ins</div></div>
      </div>
      <div className="card toolbar-card mb-3"><div className="card-body">
        <div className="row g-2 align-items-end">
          <div className="col-auto"><label className="form-label small">From</label>
            <input type="date" className="form-control" value={range.from}
              onChange={(e) => setRange((r) => ({ ...r, from: e.target.value, page: 1 }))} /></div>
          <div className="col-auto"><label className="form-label small">To</label>
            <input type="date" className="form-control" value={range.to}
              onChange={(e) => setRange((r) => ({ ...r, to: e.target.value, page: 1 }))} /></div>
        </div>
      </div></div>

      <div className="card stat-card"><div className="card-body p-0">
        <table className="table gap-table table-hover">
          <thead><tr>
            <th>Date</th><th>Check In</th><th>Check Out</th><th>Hours</th><th>Late</th><th>Status</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="text-center py-4">Loading…</td></tr> :
              result.data.length === 0 ? <tr><td colSpan={6} className="text-center py-4 text-muted">No records.</td></tr> :
              result.data.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDate(r.attendance_date)}</td>
                  <td>{fmtTime(r.check_in_time)}</td>
                  <td>{fmtTime(r.check_out_time)}</td>
                  <td>{fmtHours(r.working_minutes)}</td>
                  <td>{r.is_late ? <span className="badge text-bg-warning">Late</span> : '—'}</td>
                  <td><span className={`badge text-bg-${statusColor(r.status)} badge-status`}>{prettyStatus(r.status)}</span></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div></div>

      {meta.total_pages > 1 && (
        <nav className="mt-3"><ul className="pagination pagination-sm">
          {Array.from({ length: meta.total_pages }, (_, i) => i + 1).map((p) => (
            <li key={p} className={`page-item ${p === meta.page ? 'active' : ''}`}>
              <button className="page-link" onClick={() => setRange((r) => ({ ...r, page: p }))}>{p}</button>
            </li>
          ))}
        </ul></nav>
      )}
    </>
  );
}
