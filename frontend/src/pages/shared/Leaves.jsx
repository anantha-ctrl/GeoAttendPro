import { useEffect, useState, useCallback } from 'react';
import api, { apiError } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { fmtDate, statusColor, prettyStatus } from '../../utils/format.js';

export default function Leaves() {
  const { isAdmin } = useAuth();
  const [list, setList] = useState({ data: [], meta: {} });
  const [types, setTypes] = useState([]);
  const [filter, setFilter] = useState({ status: '', page: 1 });
  const [form, setForm] = useState({ leave_type_id: '', from_date: '', to_date: '', reason: '' });
  const [balance, setBalance] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    api.get('/leaves', { params: { ...filter, per_page: 10 } })
      .then((r) => setList(r.data.data)).catch((e) => setError(apiError(e)));
  }, [filter]);

  useEffect(() => {
    api.get('/leaves/types').then((r) => setTypes(r.data.data)).catch(() => {});
    if (!isAdmin) api.get('/leaves/balance').then((r) => setBalance(r.data.data.balance)).catch(() => {});
  }, [isAdmin]);
  useEffect(() => { load(); }, [load]);

  const apply = async (e) => {
    e.preventDefault();
    setError(''); setMsg('');
    try {
      await api.post('/leaves', form);
      setMsg('Leave request submitted.');
      setForm({ leave_type_id: '', from_date: '', to_date: '', reason: '' });
      load();
    } catch (err) { setError(apiError(err)); }
  };

  const decide = async (id, action) => {
    const remarks = action !== 'cancel' ? prompt(`Remarks for ${action} (optional):`) || '' : '';
    try { await api.patch(`/leaves/${id}/${action}`, { admin_remarks: remarks }); load(); }
    catch (e) { alert(apiError(e)); }
  };

  return (
    <>
      <div className="page-head">
        <div><h4 className="fw-bold">{isAdmin ? 'Leave Management' : 'My Leaves'}</h4>
          <div className="sub">{isAdmin ? 'Review &amp; approve requests' : 'Apply &amp; track your leaves'}</div></div>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      {msg && <div className="alert alert-success">{msg}</div>}

      {!isAdmin && balance.length > 0 && (
        <div className="row g-3 mb-1">
          {balance.map((b) => (
            <div className="col-6 col-lg-3" key={b.id}>
              <div className="card stat-card h-100"><div className="card-body py-3">
                <div className="text-muted small">{b.name}</div>
                <div className="fs-4 fw-bold">
                  {b.remaining ?? '∞'}<span className="text-muted fs-6 fw-normal">{b.max_days_year ? ` / ${b.max_days_year}` : ''} left</span>
                </div>
                <div className="text-muted" style={{ fontSize: '.72rem' }}>Used {b.used} day(s) this year</div>
              </div></div>
            </div>
          ))}
        </div>
      )}

      <div className="row g-3">
        {!isAdmin && (
          <div className="col-lg-4">
            <div className="card stat-card"><div className="card-body">
              <h6 className="fw-semibold">Apply for Leave</h6>
              <form onSubmit={apply}>
                <select className="form-select mb-2" value={form.leave_type_id} required
                  onChange={(e) => setForm({ ...form, leave_type_id: e.target.value })}>
                  <option value="">Leave type…</option>
                  {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <label className="form-label small">From</label>
                <input type="date" className="form-control mb-2" value={form.from_date} required
                  onChange={(e) => setForm({ ...form, from_date: e.target.value })} />
                <label className="form-label small">To</label>
                <input type="date" className="form-control mb-2" value={form.to_date} required
                  onChange={(e) => setForm({ ...form, to_date: e.target.value })} />
                <textarea className="form-control mb-2" placeholder="Reason" value={form.reason} required
                  onChange={(e) => setForm({ ...form, reason: e.target.value })} />
                <button className="btn btn-gap w-100">Submit Request</button>
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
                  {isAdmin && <th>Employee</th>}<th>Type</th><th>From</th><th>To</th>
                  <th>Days</th><th>Reason</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {list.data.length === 0 ? (
                    <tr><td colSpan={isAdmin ? 8 : 7} className="text-center py-3 text-muted">No requests.</td></tr>
                  ) : list.data.map((l) => (
                    <tr key={l.id}>
                      {isAdmin && <td>{l.full_name}<div className="small text-muted">{l.employee_code}</div></td>}
                      <td>{l.leave_type_name || '—'}</td>
                      <td>{fmtDate(l.from_date)}</td>
                      <td>{fmtDate(l.to_date)}</td>
                      <td>{l.total_days}</td>
                      <td className="small">{l.reason}</td>
                      <td><span className={`badge text-bg-${statusColor(l.status)} badge-status`}>{prettyStatus(l.status)}</span></td>
                      <td className="text-end">
                        {isAdmin && l.status === 'pending' && (
                          <>
                            <button className="btn btn-sm btn-success me-1" onClick={() => decide(l.id, 'approve')}><i className="bi bi-check" /></button>
                            <button className="btn btn-sm btn-danger" onClick={() => decide(l.id, 'reject')}><i className="bi bi-x" /></button>
                          </>
                        )}
                        {!isAdmin && l.status === 'pending' && (
                          <button className="btn btn-sm btn-outline-secondary" onClick={() => decide(l.id, 'cancel')}>Cancel</button>
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
