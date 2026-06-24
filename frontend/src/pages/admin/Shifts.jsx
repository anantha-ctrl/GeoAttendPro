import { useEffect, useState } from 'react';
import api, { apiError } from '../../api/client.js';

const blank = { name: '', start_time: '09:30', end_time: '18:30', grace_minutes: 15, status: 'active' };

const toHHMM = (t) => (t ? String(t).slice(0, 5) : '');

export default function Shifts() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(blank);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');

  const load = () => api.get('/shifts').then((r) => setItems(r.data.data)).catch((e) => setError(apiError(e)));
  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const startEdit = (s) => {
    setEditId(s.id);
    setForm({
      name: s.name, start_time: toHHMM(s.start_time), end_time: toHHMM(s.end_time),
      grace_minutes: s.grace_minutes, status: s.status,
    });
  };

  const reset = () => { setEditId(null); setForm(blank); };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editId) await api.put(`/shifts/${editId}`, form);
      else await api.post('/shifts', form);
      reset();
      load();
    } catch (err) { setError(apiError(err)); }
  };

  const remove = async (id) => {
    if (!confirm('Delete this shift?')) return;
    try { await api.delete(`/shifts/${id}`); load(); } catch (e) { alert(apiError(e)); }
  };

  return (
    <>
      <div className="page-head">
        <div><h4 className="fw-bold">Shift Management</h4>
          <div className="sub">Work timings that drive late-detection per employee</div></div>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="row g-3">
        <div className="col-lg-4">
          <div className="card stat-card"><div className="card-body">
            <h6 className="fw-semibold mb-3">{editId ? 'Edit Shift' : 'Add Shift'}</h6>
            <form onSubmit={submit}>
              <label className="form-label small fw-semibold">Shift Name</label>
              <input className="form-control mb-2" placeholder="e.g. General (9:30–6:30)" value={form.name} required onChange={set('name')} />
              <div className="row g-2">
                <div className="col-6">
                  <label className="form-label small fw-semibold">Start</label>
                  <input type="time" className="form-control" value={form.start_time} required onChange={set('start_time')} />
                </div>
                <div className="col-6">
                  <label className="form-label small fw-semibold">End</label>
                  <input type="time" className="form-control" value={form.end_time} required onChange={set('end_time')} />
                </div>
              </div>
              <label className="form-label small fw-semibold mt-2">Grace period (minutes)</label>
              <input type="number" min="0" className="form-control mb-2" value={form.grace_minutes} onChange={set('grace_minutes')} />
              <label className="form-label small fw-semibold">Status</label>
              <select className="form-select mb-3" value={form.status} onChange={set('status')}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <div className="d-flex gap-2">
                <button className="btn btn-gap flex-grow-1">{editId ? 'Update' : 'Add'} Shift</button>
                {editId && <button type="button" className="btn btn-light" onClick={reset}>Cancel</button>}
              </div>
            </form>
          </div></div>
        </div>

        <div className="col-lg-8">
          <div className="card stat-card"><div className="card-body p-0">
            <table className="table gap-table table-hover">
              <thead><tr><th>Shift</th><th>Timing</th><th>Grace</th><th>Employees</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={6} className="text-center text-muted py-4">No shifts yet.</td></tr>
                ) : items.map((s) => (
                  <tr key={s.id}>
                    <td className="fw-semibold">{s.name}</td>
                    <td>{toHHMM(s.start_time)} – {toHHMM(s.end_time)}</td>
                    <td>{s.grace_minutes} min</td>
                    <td><span className="badge text-bg-light">{s.employee_count}</span></td>
                    <td><span className={`badge text-bg-${s.status === 'active' ? 'success' : 'secondary'} badge-status`}>{s.status}</span></td>
                    <td className="text-end">
                      <button className="btn btn-sm btn-outline-primary me-1" onClick={() => startEdit(s)}><i className="bi bi-pencil" /></button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => remove(s.id)}><i className="bi bi-trash" /></button>
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
