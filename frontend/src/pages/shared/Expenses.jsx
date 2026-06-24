import { useEffect, useState, useCallback, useRef } from 'react';
import api, { apiError, API_BASE } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { fmtDate, statusColor, prettyStatus } from '../../utils/format.js';

const CATEGORIES = ['Travel', 'Food', 'Accommodation', 'Supplies', 'Communication', 'Other'];
const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Expenses() {
  const { isAdmin } = useAuth();
  const [data, setData] = useState({ data: [], summary: {} });
  const [filter, setFilter] = useState({ status: '' });
  const [form, setForm] = useState({ title: '', category: 'Travel', amount: '', expense_date: new Date().toISOString().slice(0, 10), notes: '' });
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(() => {
    api.get('/expenses', { params: filter }).then((r) => setData(r.data.data)).catch((e) => setError(apiError(e)));
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setMsg(''); setBusy(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      const file = fileRef.current?.files?.[0];
      if (file) fd.append('receipt', file);
      await api.post('/expenses', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setMsg('Expense claim submitted.');
      setForm({ title: '', category: 'Travel', amount: '', expense_date: new Date().toISOString().slice(0, 10), notes: '' });
      if (fileRef.current) fileRef.current.value = '';
      load();
    } catch (err) { setError(apiError(err)); }
    finally { setBusy(false); }
  };

  const decide = async (id, action) => {
    const remarks = prompt(`Remarks for ${action} (optional):`) || '';
    try { await api.patch(`/expenses/${id}/${action}`, { admin_remarks: remarks }); load(); }
    catch (e) { alert(apiError(e)); }
  };
  const remove = async (id) => {
    if (!confirm('Delete this claim?')) return;
    try { await api.delete(`/expenses/${id}`); load(); } catch (e) { alert(apiError(e)); }
  };

  const s = data.summary || {};

  return (
    <>
      <div className="page-head">
        <div><h4 className="fw-bold">{isAdmin ? 'Expense Claims' : 'My Reimbursements'}</h4>
          <div className="sub">{isAdmin ? 'Review &amp; approve employee claims' : 'Submit travel, food &amp; other claims'}</div></div>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      {msg && <div className="alert alert-success">{msg}</div>}

      <div className="row g-3 mb-3">
        <div className="col-md-4"><div className="card stat-card"><div className="card-body">
          <div className="text-muted small">Total Claimed</div><div className="fs-4 fw-bold">{money(s.total)}</div></div></div></div>
        <div className="col-md-4"><div className="card stat-card"><div className="card-body">
          <div className="text-muted small">Approved</div><div className="fs-4 fw-bold text-success">{money(s.approved)}</div></div></div></div>
        <div className="col-md-4"><div className="card stat-card"><div className="card-body">
          <div className="text-muted small">Pending</div><div className="fs-4 fw-bold text-warning">{money(s.pending)}</div></div></div></div>
      </div>

      <div className="row g-3">
        {!isAdmin && (
          <div className="col-lg-4">
            <div className="card stat-card"><div className="card-body">
              <h6 className="fw-semibold mb-3">New Claim</h6>
              <form onSubmit={submit}>
                <input className="form-control mb-2" placeholder="Title (e.g. Client visit cab)" value={form.title} required
                  onChange={(e) => setForm({ ...form, title: e.target.value })} />
                <div className="row g-2">
                  <div className="col-7"><select className="form-select mb-2" value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
                  <div className="col-5"><input type="number" min="0" step="0.01" className="form-control mb-2" placeholder="Amount ₹"
                    value={form.amount} required onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
                </div>
                <label className="form-label small fw-semibold">Expense date</label>
                <input type="date" className="form-control mb-2" value={form.expense_date}
                  onChange={(e) => setForm({ ...form, expense_date: e.target.value })} />
                <label className="form-label small fw-semibold">Receipt (optional)</label>
                <input ref={fileRef} type="file" className="form-control mb-2" accept=".pdf,.jpg,.jpeg,.png,.webp" />
                <textarea className="form-control mb-2" rows={2} placeholder="Notes" value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                <button className="btn btn-gap w-100" disabled={busy}>{busy ? 'Submitting…' : 'Submit Claim'}</button>
              </form>
            </div></div>
          </div>
        )}

        <div className={isAdmin ? 'col-12' : 'col-lg-8'}>
          <div className="card stat-card"><div className="card-body">
            <div className="d-flex justify-content-between mb-2">
              <h6 className="fw-semibold mb-0">Claims</h6>
              <select className="form-select form-select-sm" style={{ maxWidth: 160 }} value={filter.status}
                onChange={(e) => setFilter({ status: e.target.value })}>
                <option value="">All</option><option value="pending">Pending</option>
                <option value="approved">Approved</option><option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="table-responsive">
              <table className="table gap-table table-hover align-middle">
                <thead><tr>
                  {isAdmin && <th>Employee</th>}<th>Title</th><th>Category</th><th>Amount</th>
                  <th>Date</th><th>Receipt</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {data.data.length === 0 ? (
                    <tr><td colSpan={isAdmin ? 8 : 7} className="text-center py-4 text-muted">No claims.</td></tr>
                  ) : data.data.map((c) => (
                    <tr key={c.id}>
                      {isAdmin && <td>{c.full_name}<div className="small text-muted">{c.employee_code}</div></td>}
                      <td className="fw-semibold">{c.title}</td>
                      <td><span className="badge text-bg-light">{c.category}</span></td>
                      <td className="fw-semibold">{money(c.amount)}</td>
                      <td>{fmtDate(c.expense_date)}</td>
                      <td>{c.receipt_path
                        ? <a href={`${API_BASE}${c.receipt_path}`} target="_blank" rel="noreferrer"><i className="bi bi-paperclip" /></a> : '—'}</td>
                      <td><span className={`badge text-bg-${statusColor(c.status)} badge-status`}>{prettyStatus(c.status)}</span></td>
                      <td className="text-end">
                        {isAdmin && c.status === 'pending' && (
                          <>
                            <button className="btn btn-sm btn-success me-1" onClick={() => decide(c.id, 'approve')}><i className="bi bi-check" /></button>
                            <button className="btn btn-sm btn-danger" onClick={() => decide(c.id, 'reject')}><i className="bi bi-x" /></button>
                          </>
                        )}
                        {!isAdmin && c.status === 'pending' && (
                          <button className="btn btn-sm btn-outline-danger" onClick={() => remove(c.id)}><i className="bi bi-trash" /></button>
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
