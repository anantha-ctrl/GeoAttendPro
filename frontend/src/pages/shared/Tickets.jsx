import { useEffect, useState, useCallback } from 'react';
import api, { apiError } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { fmtDate } from '../../utils/format.js';

const CATEGORIES = ['IT', 'HR', 'Facilities', 'Payroll', 'Other'];
const priColor = { high: 'danger', medium: 'warning', low: 'secondary' };
const statusColor = { open: 'primary', in_progress: 'info', resolved: 'success', closed: 'secondary' };
const statusLabel = { open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed' };

export default function Tickets() {
  const { isAdmin } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [filter, setFilter] = useState({ status: '' });
  const [form, setForm] = useState({ subject: '', category: 'IT', description: '', priority: 'medium' });
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    api.get('/tickets', { params: filter }).then((r) => setTickets(r.data.data)).catch((e) => setError(apiError(e)));
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  const raise = async (e) => {
    e.preventDefault();
    setError(''); setMsg('');
    try {
      await api.post('/tickets', form);
      setMsg('Ticket raised. Our team will respond soon.');
      setForm({ subject: '', category: 'IT', description: '', priority: 'medium' });
      load();
    } catch (err) { setError(apiError(err)); }
  };

  const setStatus = async (id, status) => {
    try { await api.patch(`/tickets/${id}`, { status }); load(); } catch (e) { alert(apiError(e)); }
  };
  const addRemark = async (id) => {
    const admin_remarks = prompt('Reply / remark for this ticket:');
    if (admin_remarks === null) return;
    try { await api.patch(`/tickets/${id}`, { admin_remarks }); load(); } catch (e) { alert(apiError(e)); }
  };

  return (
    <>
      <div className="page-head">
        <div><h4 className="fw-bold">Help Desk</h4>
          <div className="sub">{isAdmin ? 'Manage employee support tickets' : 'Raise &amp; track IT / HR requests'}</div></div>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      {msg && <div className="alert alert-success">{msg}</div>}

      <div className="row g-3">
        {!isAdmin && (
          <div className="col-lg-4">
            <div className="card stat-card"><div className="card-body">
              <h6 className="fw-semibold mb-3">Raise a Ticket</h6>
              <form onSubmit={raise}>
                <input className="form-control mb-2" placeholder="Subject" value={form.subject} required
                  onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                <div className="row g-2">
                  <div className="col-7"><select className="form-select mb-2" value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
                  <div className="col-5"><select className="form-select mb-2" value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                    <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                  </select></div>
                </div>
                <textarea className="form-control mb-2" rows={4} placeholder="Describe your issue…" value={form.description} required
                  onChange={(e) => setForm({ ...form, description: e.target.value })} />
                <button className="btn btn-gap w-100">Submit Ticket</button>
              </form>
            </div></div>
          </div>
        )}

        <div className={isAdmin ? 'col-12' : 'col-lg-8'}>
          <div className="card stat-card"><div className="card-body">
            <div className="d-flex justify-content-between mb-2">
              <h6 className="fw-semibold mb-0">Tickets</h6>
              <select className="form-select form-select-sm" style={{ maxWidth: 160 }} value={filter.status}
                onChange={(e) => setFilter({ status: e.target.value })}>
                <option value="">All</option><option value="open">Open</option>
                <option value="in_progress">In Progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option>
              </select>
            </div>
            {tickets.length === 0 ? (
              <p className="text-muted text-center py-4 mb-0">No tickets.</p>
            ) : tickets.map((t) => (
              <div key={t.id} className="border rounded p-3 mb-2">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <span className="fw-semibold">{t.subject}</span>
                    <span className={`badge text-bg-${priColor[t.priority]} ms-2`}>{t.priority}</span>
                    <span className="badge text-bg-light ms-1">{t.category}</span>
                  </div>
                  <span className={`badge text-bg-${statusColor[t.status]}`}>{statusLabel[t.status]}</span>
                </div>
                {isAdmin && <div className="small text-muted mt-1">{t.full_name} · {t.employee_code}</div>}
                <p className="small mb-2 mt-1" style={{ whiteSpace: 'pre-wrap' }}>{t.description}</p>
                {t.admin_remarks && <div className="alert alert-light py-1 px-2 small mb-2"><b>Reply:</b> {t.admin_remarks}</div>}
                <div className="d-flex justify-content-between align-items-center">
                  <span className="text-muted" style={{ fontSize: '.72rem' }}><i className="bi bi-clock me-1" />{fmtDate(t.created_at)}</span>
                  <div className="d-flex gap-1">
                    {isAdmin ? (
                      <>
                        <select className="form-select form-select-sm" style={{ maxWidth: 150 }} value={t.status}
                          onChange={(e) => setStatus(t.id, e.target.value)}>
                          <option value="open">Open</option><option value="in_progress">In Progress</option>
                          <option value="resolved">Resolved</option><option value="closed">Closed</option>
                        </select>
                        <button className="btn btn-sm btn-outline-primary" onClick={() => addRemark(t.id)}><i className="bi bi-reply" /></button>
                      </>
                    ) : t.status !== 'closed' && (
                      <button className="btn btn-sm btn-outline-secondary" onClick={() => setStatus(t.id, 'closed')}>Close</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div></div>
        </div>
      </div>
    </>
  );
}
