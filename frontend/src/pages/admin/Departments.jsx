import { useEffect, useState } from 'react';
import api, { apiError } from '../../api/client.js';

export default function Departments() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ id: null, name: '', description: '', status: 'active' });
  const [error, setError] = useState('');

  const load = () => api.get('/departments').then((r) => setItems(r.data.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (form.id) await api.put(`/departments/${form.id}`, form);
      else await api.post('/departments', form);
      setForm({ id: null, name: '', description: '', status: 'active' });
      load();
    } catch (err) { setError(apiError(err)); }
  };

  const remove = async (id) => {
    if (!confirm('Delete department?')) return;
    try { await api.delete(`/departments/${id}`); load(); }
    catch (e) { alert(apiError(e)); }
  };

  return (
    <>
      <div className="page-head">
        <div><h4 className="fw-bold">Departments</h4><div className="sub">Organize your teams</div></div>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="row g-3">
        <div className="col-lg-4">
          <div className="card stat-card"><div className="card-body">
            <h6 className="fw-semibold">{form.id ? 'Edit' : 'New'} Department</h6>
            <form onSubmit={submit}>
              <input className="form-control mb-2" placeholder="Name" value={form.name} required
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <textarea className="form-control mb-2" placeholder="Description" value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <select className="form-select mb-2" value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="active">Active</option><option value="inactive">Inactive</option>
              </select>
              <button className="btn btn-gap w-100">{form.id ? 'Update' : 'Add'}</button>
              {form.id && <button type="button" className="btn btn-link w-100"
                onClick={() => setForm({ id: null, name: '', description: '', status: 'active' })}>Cancel edit</button>}
            </form>
          </div></div>
        </div>
        <div className="col-lg-8">
          <div className="card stat-card"><div className="card-body p-0">
            <table className="table gap-table table-hover">
              <thead><tr><th>Name</th><th>Employees</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {items.map((d) => (
                  <tr key={d.id}>
                    <td className="fw-semibold">{d.name}<div className="small text-muted">{d.description}</div></td>
                    <td>{d.employee_count}</td>
                    <td><span className={`badge text-bg-${d.status === 'active' ? 'success' : 'secondary'}`}>{d.status}</span></td>
                    <td className="text-end">
                      <button className="btn btn-sm btn-outline-primary me-1" onClick={() => setForm(d)}><i className="bi bi-pencil" /></button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => remove(d.id)}><i className="bi bi-trash" /></button>
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
