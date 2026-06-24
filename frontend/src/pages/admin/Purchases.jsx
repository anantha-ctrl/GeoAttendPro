import { useEffect, useState, useCallback } from 'react';
import api, { apiError } from '../../api/client.js';
import { fmtDate } from '../../utils/format.js';

const CATEGORIES = ['Office Supplies', 'Electronics', 'Furniture', 'Software', 'Stationery', 'Maintenance', 'Utilities', 'Other'];
const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const blank = {
  item_name: '', category: 'Office Supplies', vendor: '', quantity: 1,
  unit_price: '', purchase_date: new Date().toISOString().slice(0, 10),
  payment_status: 'paid', invoice_no: '', notes: '',
};

export default function Purchases() {
  const [result, setResult] = useState({ data: [], meta: {}, summary: {} });
  const [filters, setFilters] = useState({ search: '', category: '', payment_status: '', page: 1 });
  const [form, setForm] = useState(blank);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/purchases', { params: { ...filters, per_page: 10 } })
      .then((r) => setResult(r.data.data))
      .catch((e) => setError(apiError(e)))
      .finally(() => setLoading(false));
  }, [filters]);
  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const openAdd = () => { setEditId(null); setForm(blank); setShowForm(true); setError(''); };
  const openEdit = (p) => {
    setEditId(p.id);
    setForm({
      item_name: p.item_name || '', category: p.category || 'Office Supplies', vendor: p.vendor || '',
      quantity: p.quantity || 1, unit_price: p.unit_price || '', purchase_date: p.purchase_date || '',
      payment_status: p.payment_status || 'paid', invoice_no: p.invoice_no || '', notes: p.notes || '',
    });
    setShowForm(true); setError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editId) await api.put(`/purchases/${editId}`, form);
      else await api.post('/purchases', form);
      setShowForm(false);
      load();
    } catch (err) { setError(apiError(err)); }
  };

  const remove = async (id) => {
    if (!confirm('Delete this purchase entry?')) return;
    try { await api.delete(`/purchases/${id}`); load(); } catch (e) { alert(apiError(e)); }
  };

  const meta = result.meta;
  const summary = result.summary || {};
  const livePreview = (Number(form.quantity) || 0) * (Number(form.unit_price) || 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h4 className="fw-bold">Purchases &amp; Expenses</h4>
          <div className="sub">Record office product purchases &amp; track spend</div>
        </div>
        <button className="btn btn-gap" onClick={openAdd}><i className="bi bi-plus-lg me-1" />Add Purchase</button>
      </div>

      {/* Summary */}
      <div className="row g-3 mb-3">
        <div className="col-md-4"><div className="card stat-card"><div className="card-body">
          <div className="text-muted small">Total Entries</div><div className="fs-3 fw-bold">{summary.count ?? 0}</div></div></div></div>
        <div className="col-md-4"><div className="card stat-card"><div className="card-body">
          <div className="text-muted small">Total Spent</div><div className="fs-3 fw-bold">{money(summary.total_spent)}</div></div></div></div>
        <div className="col-md-4"><div className="card stat-card"><div className="card-body">
          <div className="text-muted small">Pending Payment</div><div className="fs-3 fw-bold text-danger">{money(summary.pending_amount)}</div></div></div></div>
      </div>

      {showForm && (
        <div className="card stat-card mb-3"><div className="card-body">
          <h6 className="fw-semibold mb-3">{editId ? 'Edit' : 'New'} Purchase Entry</h6>
          {error && <div className="alert alert-danger py-2">{error}</div>}
          <form onSubmit={submit} className="row g-2">
            <div className="col-md-5"><label className="form-label small fw-semibold">Item / Product *</label>
              <input className="form-control" value={form.item_name} required onChange={set('item_name')} placeholder="e.g. Office Chairs" /></div>
            <div className="col-md-4"><label className="form-label small fw-semibold">Category</label>
              <select className="form-select" value={form.category} onChange={set('category')}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select></div>
            <div className="col-md-3"><label className="form-label small fw-semibold">Vendor / Supplier</label>
              <input className="form-control" value={form.vendor} onChange={set('vendor')} /></div>
            <div className="col-md-2"><label className="form-label small fw-semibold">Quantity</label>
              <input type="number" min="1" className="form-control" value={form.quantity} onChange={set('quantity')} /></div>
            <div className="col-md-3"><label className="form-label small fw-semibold">Unit Price (₹)</label>
              <input type="number" min="0" step="0.01" className="form-control" value={form.unit_price} onChange={set('unit_price')} /></div>
            <div className="col-md-3"><label className="form-label small fw-semibold">Total</label>
              <input className="form-control bg-light fw-bold" value={money(livePreview)} readOnly /></div>
            <div className="col-md-2"><label className="form-label small fw-semibold">Date</label>
              <input type="date" className="form-control" value={form.purchase_date} onChange={set('purchase_date')} /></div>
            <div className="col-md-2"><label className="form-label small fw-semibold">Payment</label>
              <select className="form-select" value={form.payment_status} onChange={set('payment_status')}>
                <option value="paid">Paid</option><option value="pending">Pending</option>
              </select></div>
            <div className="col-md-4"><label className="form-label small fw-semibold">Invoice No.</label>
              <input className="form-control" value={form.invoice_no} onChange={set('invoice_no')} /></div>
            <div className="col-md-8"><label className="form-label small fw-semibold">Notes</label>
              <input className="form-control" value={form.notes} onChange={set('notes')} /></div>
            <div className="col-12 d-flex gap-2">
              <button className="btn btn-gap">{editId ? 'Update' : 'Save'} Purchase</button>
              <button type="button" className="btn btn-light" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div></div>
      )}

      <div className="card toolbar-card mb-3"><div className="card-body">
        <div className="row g-2">
          <div className="col-md-5"><input className="form-control" placeholder="Search item, vendor, invoice"
            value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))} /></div>
          <div className="col-md-4"><select className="form-select" value={filters.category}
            onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value, page: 1 }))}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select></div>
          <div className="col-md-3"><select className="form-select" value={filters.payment_status}
            onChange={(e) => setFilters((f) => ({ ...f, payment_status: e.target.value, page: 1 }))}>
            <option value="">All payments</option><option value="paid">Paid</option><option value="pending">Pending</option>
          </select></div>
        </div>
      </div></div>

      <div className="card stat-card"><div className="card-body p-0">
        <div className="table-responsive">
          <table className="table gap-table table-hover align-middle">
            <thead><tr>
              <th>Item</th><th>Category</th><th>Vendor</th><th>Qty</th><th>Unit</th>
              <th>Total</th><th>Date</th><th>Payment</th><th className="text-end">Actions</th></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-5 text-muted">Loading…</td></tr>
              ) : result.data.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-5 text-muted">
                  <i className="bi bi-bag fs-3 d-block mb-2 opacity-50" />No purchases recorded.</td></tr>
              ) : result.data.map((p) => (
                <tr key={p.id}>
                  <td className="fw-semibold">{p.item_name}{p.invoice_no && <div className="small text-muted">#{p.invoice_no}</div>}</td>
                  <td><span className="badge text-bg-light">{p.category}</span></td>
                  <td>{p.vendor || '—'}</td>
                  <td>{p.quantity}</td>
                  <td>{money(p.unit_price)}</td>
                  <td className="fw-semibold">{money(p.total_amount)}</td>
                  <td>{fmtDate(p.purchase_date)}</td>
                  <td><span className={`badge text-bg-${p.payment_status === 'paid' ? 'success' : 'warning'}`}>{p.payment_status}</span></td>
                  <td className="text-end">
                    <button className="btn btn-sm btn-outline-primary me-1" onClick={() => openEdit(p)}><i className="bi bi-pencil" /></button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => remove(p.id)}><i className="bi bi-trash" /></button>
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
