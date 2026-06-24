import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { apiError } from '../../api/client.js';
import PasswordInput from '../../components/PasswordInput.jsx';

const empty = {
  full_name: '', email: '', phone: '', role_id: 3, department_id: '',
  designation_id: '', shift_id: '', manager_id: '', monthly_salary: '', date_of_birth: '',
  address: '', joining_date: '', status: 'active', password: '',
};

export default function EmployeeForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const nav = useNavigate();
  const [form, setForm] = useState(empty);
  const [lookups, setLookups] = useState({ roles: [], departments: [], designations: [], shifts: [], managers: [] });
  const [photo, setPhoto] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/lookups').then((r) => setLookups(r.data.data)).catch(() => {});
    if (editing) {
      api.get(`/employees/${id}`).then((r) => {
        const e = r.data.data;
        setForm({
          full_name: e.full_name || '', email: e.email || '', phone: e.phone || '',
          role_id: e.role_id, department_id: e.department_id || '',
          designation_id: e.designation_id || '', shift_id: e.shift_id || '',
          manager_id: e.manager_id || '', monthly_salary: e.monthly_salary || '',
          date_of_birth: e.date_of_birth || '', address: e.address || '',
          joining_date: e.joining_date || '', status: e.status, password: '',
        });
      }).catch((e) => setError(apiError(e)));
    }
  }, [id, editing]);

  const onPhoto = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result);
    reader.readAsDataURL(file);
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    const payload = { ...form };
    if (photo) payload.profile_photo = photo;
    if (editing && !payload.password) delete payload.password;
    try {
      if (editing) await api.put(`/employees/${id}`, payload);
      else await api.post('/employees', payload);
      nav('/admin/employees');
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h4 className="fw-bold mb-3">{editing ? 'Edit' : 'Add'} Employee</h4>
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="card stat-card"><div className="card-body">
        <form onSubmit={submit} className="row g-3">
          <div className="col-md-6">
            <label className="form-label small fw-semibold">Full Name *</label>
            <input className="form-control" value={form.full_name} required onChange={set('full_name')} />
          </div>
          <div className="col-md-6">
            <label className="form-label small fw-semibold">Email *</label>
            <input type="email" className="form-control" value={form.email} required onChange={set('email')} />
          </div>
          <div className="col-md-6">
            <label className="form-label small fw-semibold">Phone</label>
            <input className="form-control" value={form.phone} onChange={set('phone')} />
          </div>
          <div className="col-md-6">
            <label className="form-label small fw-semibold">Role *</label>
            <select className="form-select" value={form.role_id} onChange={set('role_id')}>
              {lookups.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label small fw-semibold">Department</label>
            <select className="form-select" value={form.department_id} onChange={set('department_id')}>
              <option value="">—</option>
              {lookups.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label small fw-semibold">Designation</label>
            <select className="form-select" value={form.designation_id} onChange={set('designation_id')}>
              <option value="">—</option>
              {lookups.designations.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label small fw-semibold">Shift</label>
            <select className="form-select" value={form.shift_id} onChange={set('shift_id')}>
              <option value="">— No shift —</option>
              {lookups.shifts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label small fw-semibold">Reporting Manager</label>
            <select className="form-select" value={form.manager_id} onChange={set('manager_id')}>
              <option value="">— No manager —</option>
              {lookups.managers
                .filter((m) => String(m.id) !== String(id))
                .map((m) => <option key={m.id} value={m.id}>{m.full_name} ({m.employee_code})</option>)}
            </select>
          </div>
          <div className="col-md-6">
            <label className="form-label small fw-semibold">Monthly Salary (₹)</label>
            <input type="number" min="0" step="0.01" className="form-control" value={form.monthly_salary}
              onChange={set('monthly_salary')} placeholder="e.g. 30000" />
          </div>
          <div className="col-md-6">
            <label className="form-label small fw-semibold">Date of Birth</label>
            <input type="date" className="form-control" value={form.date_of_birth} onChange={set('date_of_birth')} />
          </div>
          <div className="col-md-6">
            <label className="form-label small fw-semibold">Joining Date</label>
            <input type="date" className="form-control" value={form.joining_date} onChange={set('joining_date')} />
          </div>
          <div className="col-md-6">
            <label className="form-label small fw-semibold">Status</label>
            <select className="form-select" value={form.status} onChange={set('status')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
          <div className="col-12">
            <label className="form-label small fw-semibold">Address</label>
            <textarea className="form-control" rows={2} value={form.address} onChange={set('address')} />
          </div>
          <div className="col-md-6">
            <label className="form-label small fw-semibold">
              Password {editing && <span className="text-muted">(leave blank to keep)</span>} {!editing && '*'}
            </label>
            <PasswordInput value={form.password}
              required={!editing} minLength={8} onChange={set('password')} />
          </div>
          <div className="col-md-6">
            <label className="form-label small fw-semibold">Profile Photo</label>
            <input type="file" accept="image/*" className="form-control" onChange={(e) => onPhoto(e.target.files[0])} />
          </div>
          {photo && <div className="col-12"><img src={photo} alt="preview" className="selfie-preview" /></div>}
          <div className="col-12 d-flex gap-2">
            <button className="btn btn-gap" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
            <button type="button" className="btn btn-light" onClick={() => nav('/admin/employees')}>Cancel</button>
          </div>
        </form>
      </div></div>
    </>
  );
}
