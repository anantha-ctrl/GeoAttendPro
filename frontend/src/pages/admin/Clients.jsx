import { useEffect, useState, useCallback } from 'react';
import api, { apiError } from '../../api/client.js';
import { fmtDate } from '../../utils/format.js';

const blank = {
  name: '', company_name: '', email: '', phone: '', address: '',
  gst_number: '', type: 'client', status: 'active', notes: '',
};

const typeBadge = { client: 'primary', customer: 'success', vendor: 'warning' };

export default function Clients() {
  const [result, setResult] = useState({ data: [], meta: {} });
  const [filters, setFilters] = useState({ search: '', type: '', status: '', page: 1 });
  const [form, setForm] = useState(blank);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/clients', { params: { ...filters, per_page: 10 } })
      .then((r) => setResult(r.data.data))
      .catch((e) => setError(apiError(e)))
      .finally(() => setLoading(false));
  }, [filters]);
  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const openAdd = () => { setEditId(null); setForm(blank); setShowForm(true); setError(''); };
  const openEdit = (c) => {
    setEditId(c.id);
    setForm({
      name: c.name || '', company_name: c.company_name || '', email: c.email || '',
      phone: c.phone || '', address: c.address || '', gst_number: c.gst_number || '',
      type: c.type || 'client', status: c.status || 'active', notes: c.notes || '',
    });
    setShowForm(true); setError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editId) await api.put(`/clients/${editId}`, form);
      else await api.post('/clients', form);
      setShowForm(false);
      load();
    } catch (err) { setError(apiError(err)); }
  };

  const remove = async (id) => {
    if (!confirm('Delete this client?')) return;
    try { await api.delete(`/clients/${id}`); load(); } catch (e) { alert(apiError(e)); }
  };

  const meta = result.meta;

  return (
    <>
      <div className="page-head">
        <div>
          <h4 className="fw-bold">Clients &amp; Customers</h4>
          <div className="sub">{meta.total ?? 0} total · manage clients, customers &amp; vendors</div>
        </div>
        <button className="btn btn-gap" onClick={openAdd}><i className="bi bi-plus-lg me-1" />Add Client</button>
      </div>

      {showForm && (
        <div className="card stat-card mb-3"><div className="card-body">
          <h6 className="fw-semibold mb-3">{editId ? 'Edit' : 'New'} Client / Customer</h6>
          {error && <div className="alert alert-danger py-2">{error}</div>}
          <form onSubmit={submit} className="row g-2">
            <div className="col-md-4"><label className="form-label small fw-semibold">Contact Name *</label>
              <input className="form-control" value={form.name} required onChange={set('name')} /></div>
            <div className="col-md-4"><label className="form-label small fw-semibold">Company</label>
              <input className="form-control" value={form.company_name} onChange={set('company_name')} /></div>
            <div className="col-md-4"><label className="form-label small fw-semibold">Type</label>
              <select className="form-select" value={form.type} onChange={set('type')}>
                <option value="client">Client</option><option value="customer">Customer</option><option value="vendor">Vendor</option>
              </select></div>
            <div className="col-md-4"><label className="form-label small fw-semibold">Email</label>
              <input type="email" className="form-control" value={form.email} onChange={set('email')} /></div>
            <div className="col-md-4"><label className="form-label small fw-semibold">Phone</label>
              <input className="form-control" value={form.phone} onChange={set('phone')} /></div>
            <div className="col-md-4"><label className="form-label small fw-semibold">GST / Tax No.</label>
              <input className="form-control" value={form.gst_number} onChange={set('gst_number')} /></div>
            <div className="col-md-8"><label className="form-label small fw-semibold">Address</label>
              <input className="form-control" value={form.address} onChange={set('address')} /></div>
            <div className="col-md-4"><label className="form-label small fw-semibold">Status</label>
              <select className="form-select" value={form.status} onChange={set('status')}>
                <option value="active">Active</option><option value="inactive">Inactive</option>
              </select></div>
            <div className="col-12"><label className="form-label small fw-semibold">Notes</label>
              <textarea className="form-control" rows={2} value={form.notes} onChange={set('notes')} /></div>
            <div className="col-12 d-flex gap-2">
              <button className="btn btn-gap">{editId ? 'Update' : 'Save'} Client</button>
              <button type="button" className="btn btn-light" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div></div>
      )}

      <div className="card toolbar-card mb-3"><div className="card-body">
        <div className="row g-2">
          <div className="col-md-5"><input className="form-control" placeholder="Search name, company, email, phone"
            value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))} /></div>
          <div className="col-md-4"><select className="form-select" value={filters.type}
            onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value, page: 1 }))}>
            <option value="">All types</option><option value="client">Client</option>
            <option value="customer">Customer</option><option value="vendor">Vendor</option>
          </select></div>
          <div className="col-md-3"><select className="form-select" value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}>
            <option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option>
          </select></div>
        </div>
      </div></div>

      <div className="card stat-card"><div className="card-body p-0">
        <div className="table-responsive">
          <table className="table gap-table table-hover align-middle">
            <thead><tr>
              <th>Contact</th><th>Company</th><th>Email</th><th>Phone</th>
              <th>Type</th><th>Status</th><th>Added</th><th className="text-end">Actions</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-5 text-muted">Loading…</td></tr>
              ) : result.data.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-5 text-muted">
                  <i className="bi bi-person-vcard fs-3 d-block mb-2 opacity-50" />No clients yet.</td></tr>
              ) : result.data.map((c) => (
                <tr key={c.id}>
                  <td className="fw-semibold">{c.name}</td>
                  <td>{c.company_name || '—'}</td>
                  <td>{c.email || '—'}</td>
                  <td>{c.phone || '—'}</td>
                  <td><span className={`badge text-bg-${typeBadge[c.type] || 'secondary'}`}>{c.type}</span></td>
                  <td><span className={`badge text-bg-${c.status === 'active' ? 'success' : 'secondary'} badge-status`}>{c.status}</span></td>
                  <td>{fmtDate(c.created_at)}</td>
                  <td className="text-end">
                    <button className="btn btn-sm btn-outline-primary me-1" onClick={() => openEdit(c)}><i className="bi bi-pencil" /></button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => remove(c.id)}><i className="bi bi-trash" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div></div>

      {meta.total_pages > 1 && (
        <nav className="mt-3"><ul className="pagination pagination-sm">
          {Array.from({ length: meta.total_pages }, (_, i) => i + 1).map((p) => (
            <li key={p} className={`page-item ${p === meta.page ? 'active' : ''}`}>
              <button className="page-link" onClick={() => setFilters((f) => ({ ...f, page: p }))}>{p}</button>
            </li>
          ))}
        </ul></nav>
      )}
    </>
  );
}
