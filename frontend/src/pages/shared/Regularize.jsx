import { useEffect, useState, useCallback } from 'react';
import api, { apiError } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { fmtDate, fmtTime, statusColor, prettyStatus } from '../../utils/format.js';

const blank = { attendance_date: '', requested_check_in: '', requested_check_out: '', reason: '' };

export default function Regularize() {
  const { isAdmin } = useAuth();
  const [list, setList] = useState({ data: [], meta: {} });
  const [filter, setFilter] = useState({ status: '', page: 1 });
  const [form, setForm] = useState(blank);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    api.get('/regularizations', { params: { ...filter, per_page: 10 } })
      .then((r) => setList(r.data.data)).catch((e) => setError(apiError(e)));
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const apply = async (e) => {
    e.preventDefault();
    setError(''); setMsg('');
    try {
      await api.post('/regularizations', form);
      setMsg('Regularization request submitted.');
      setForm(blank);
      load();
    } catch (err) { setError(apiError(err)); }
  };

  const decide = async (id, action) => {
    const remarks = prompt(`Remarks for ${action} (optional):`) || '';
    try { await api.patch(`/regularizations/${id}/${action}`, { admin_remarks: remarks }); load(); }
    catch (e) { alert(apiError(e)); }
  };

  return (
    <>
      <div className="page-head">
        <div><h4 className="fw-bold">Attendance Regularization</h4>
          <div className="sub">{isAdmin ? 'Review &amp; approve correction requests' : 'Request a correction for a missed or wrong punch'}</div></div>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      {msg && <div className="alert alert-success">{msg}</div>}

      <div className="row g-3">
        {!isAdmin && (
          <div className="col-lg-4">
            <div className="card stat-card"><div className="card-body">
              <h6 className="fw-semibold mb-3">New Request</h6>
              <form onSubmit={apply}>
                <label className="form-label small fw-semibold">Date</label>
                <input type="date" className="form-control mb-2" value={form.attendance_date} required onChange={set('attendance_date')} />
                <label className="form-label small fw-semibold">Check-in time</label>
                <input type="time" className="form-control mb-2" value={form.requested_check_in} onChange={set('requested_check_in')} />
                <label className="form-label small fw-semibold">Check-out time</label>
                <input type="time" className="form-control mb-2" value={form.requested_check_out} onChange={set('requested_check_out')} />
                <textarea className="form-control mb-2" placeholder="Reason (e.g. forgot to check in)" value={form.reason} required onChange={set('reason')} />
                <button className="btn btn-gap w-100">Submit Request</button>
                <p className="text-muted small mt-2 mb-0">Provide at least one time. Admin approval applies it to your attendance.</p>
              </form>
            </div></div>
          </div>
        )}

        <div className={isAdmin ? 'col-12' : 'col-lg-8'}>
          <div className="card stat-card"><div className="card-body">
            <div className="d-flex justify-content-between mb-2">
              <h6 className="fw-semibold mb-0">Requests</h6>
              <select className="form-select form-select-sm" style={{ maxWidth: 180 }} value={filter.status}
                onChange={(e) => setFilter({ status: e.target.value, page: 1 })}>
                <option value="">All</option><option value="pending">Pending</option>
                <option value="approved">Approved</option><option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="table-responsive">
              <table className="table gap-table table-hover">
                <thead><tr>
                  {isAdmin && <th>Employee</th>}<th>Date</th><th>Check-in</th><th>Check-out</th>
                  <th>Reason</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {list.data.length === 0 ? (
                    <tr><td colSpan={isAdmin ? 7 : 6} className="text-center py-3 text-muted">No requests.</td></tr>
                  ) : list.data.map((r) => (
                    <tr key={r.id}>
                      {isAdmin && <td>{r.full_name}<div className="small text-muted">{r.employee_code}</div></td>}
                      <td>{fmtDate(r.attendance_date)}</td>
                      <td>{fmtTime(r.requested_check_in)}</td>
                      <td>{fmtTime(r.requested_check_out)}</td>
                      <td className="small">{r.reason}</td>
                      <td><span className={`badge text-bg-${statusColor(r.status)} badge-status`}>{prettyStatus(r.status)}</span></td>
                      <td className="text-end">
                        {isAdmin && r.status === 'pending' && (
                          <>
                            <button className="btn btn-sm btn-success me-1" onClick={() => decide(r.id, 'approve')}><i className="bi bi-check" /></button>
                            <button className="btn btn-sm btn-danger" onClick={() => decide(r.id, 'reject')}><i className="bi bi-x" /></button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div></div>
        </div>
      </div>
    </>
  );
}
