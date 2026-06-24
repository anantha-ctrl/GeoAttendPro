import { useEffect, useState } from 'react';
import api, { apiError } from '../../api/client.js';
import { fmtDate } from '../../utils/format.js';

export default function Holidays() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ name: '', holiday_date: '', recurring: false });
  const [error, setError] = useState('');

  const load = () => api.get('/holidays').then((r) => setItems(r.data.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/holidays', form);
      setForm({ name: '', holiday_date: '', recurring: false });
      load();
    } catch (err) { setError(apiError(err)); }
  };

  const remove = async (id) => {
    if (!confirm('Remove this holiday?')) return;
    try { await api.delete(`/holidays/${id}`); load(); } catch (e) { alert(apiError(e)); }
  };

  return (
    <>
      <div className="page-head">
        <div><h4 className="fw-bold">Holiday Calendar</h4>
          <div className="sub">Holidays are excluded from absent marking</div></div>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="row g-3">
        <div className="col-lg-4">
          <div className="card stat-card"><div className="card-body">
            <h6 className="fw-semibold mb-3">Add Holiday</h6>
            <form onSubmit={submit}>
              <input className="form-control mb-2" placeholder="Holiday name" value={form.name} required
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input type="date" className="form-control mb-2" value={form.holiday_date} required
                onChange={(e) => setForm({ ...form, holiday_date: e.target.value })} />
              <div className="form-check mb-3">
                <input className="form-check-input" type="checkbox" id="rec" checked={form.recurring}
                  onChange={(e) => setForm({ ...form, recurring: e.target.checked })} />
                <label className="form-check-label small" htmlFor="rec">Repeats every year</label>
              </div>
              <button className="btn btn-gap w-100">Add Holiday</button>
            </form>
          </div></div>
        </div>
        <div className="col-lg-8">
          <div className="card stat-card"><div className="card-body p-0">
            <table className="table gap-table table-hover">
              <thead><tr><th>Holiday</th><th>Date</th><th>Recurring</th><th></th></tr></thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={4} className="text-center text-muted py-4">No holidays added.</td></tr>
                ) : items.map((h) => (
                  <tr key={h.id}>
                    <td className="fw-semibold">{h.name}</td>
                    <td>{fmtDate(h.holiday_date)}</td>
                    <td>{Number(h.recurring) ? <span className="badge text-bg-info">Yearly</span> : '—'}</td>
                    <td className="text-end">
                      <button className="btn btn-sm btn-outline-danger" onClick={() => remove(h.id)}><i className="bi bi-trash" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div></div>
        </div>
      </div>
    </>
  );
}
