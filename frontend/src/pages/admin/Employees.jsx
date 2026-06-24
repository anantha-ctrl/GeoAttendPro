import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import api, { apiError } from '../../api/client.js';
import { fmtDate, statusColor } from '../../utils/format.js';
import Avatar from '../../components/Avatar.jsx';

export default function Employees() {
  const [result, setResult] = useState({ data: [], meta: {} });
  const [filters, setFilters] = useState({ search: '', department_id: '', status: '', page: 1 });
  const [departments, setDepartments] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/lookups').then((r) => setDepartments(r.data.data.departments)).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/employees', { params: { ...filters, per_page: 10 } })
      .then((r) => setResult(r.data.data))
      .catch((e) => setError(apiError(e)))
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const remove = async (id) => {
    if (!confirm('Delete this employee? This cannot be undone.')) return;
    try {
      await api.delete(`/employees/${id}`);
      load();
    } catch (e) { alert(apiError(e)); }
  };

  const fileRef = useRef(null);
  const [importing, setImporting] = useState(false);

  const onImport = async (file) => {
    if (!file) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post('/employees/import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const skipped = data.data.skipped || [];
      alert(`${data.message}\n${skipped.length ? '\nSkipped:\n' + skipped.join('\n') : ''}`);
      load();
    } catch (e) {
      alert(apiError(e));
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const meta = result.meta;

  return (
    <>
      <div className="page-head">
        <div>
          <h4 className="fw-bold">Employees</h4>
          <div className="sub">{meta.total ?? 0} total · manage your workforce</div>
        </div>
        <div className="d-flex gap-2">
          <input ref={fileRef} type="file" accept=".csv" className="d-none"
            onChange={(e) => onImport(e.target.files[0])} />
          <button className="btn btn-outline-secondary" disabled={importing}
            onClick={() => fileRef.current?.click()} title="CSV columns: full_name,email,phone,department_id,designation_id,joining_date,password">
            <i className="bi bi-upload me-1" />{importing ? 'Importing…' : 'Import CSV'}
          </button>
          <Link to="/admin/employees/new" className="btn btn-gap"><i className="bi bi-plus-lg me-1" />Add Employee</Link>
        </div>
      </div>

      <div className="card toolbar-card mb-3"><div className="card-body">
        <div className="row g-2">
          <div className="col-md-5">
            <input className="form-control" placeholder="Search name, email, code, phone"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value, page: 1 }))} />
          </div>
          <div className="col-md-4">
            <select className="form-select" value={filters.department_id}
              onChange={(e) => setFilters((f) => ({ ...f, department_id: e.target.value, page: 1 }))}>
              <option value="">All departments</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="col-md-3">
            <select className="form-select" value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, page: 1 }))}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>
      </div></div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card stat-card"><div className="card-body p-0">
        <div className="table-responsive">
          <table className="table gap-table table-hover">
            <thead>
              <tr>
                <th>Employee</th><th>Email</th><th>Department</th>
                <th>Designation</th><th>Joined</th><th>Status</th><th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-5 text-muted">Loading…</td></tr>
              ) : result.data.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-5 text-muted">
                  <i className="bi bi-people fs-3 d-block mb-2 opacity-50" />No employees found.
                </td></tr>
              ) : result.data.map((e) => (
                <tr key={e.id}>
                  <td>
                    <div className="d-flex align-items-center gap-2">
                      <Avatar name={e.full_name} photo={e.profile_photo} />
                      <div>
                        <div className="fw-semibold">{e.full_name}</div>
                        <div className="text-muted" style={{ fontSize: '.72rem' }}>{e.employee_code}</div>
                      </div>
                    </div>
                  </td>
                  <td>{e.email}</td>
                  <td>{e.department_name || '—'}</td>
                  <td>{e.designation_name || '—'}</td>
                  <td>{fmtDate(e.joining_date)}</td>
                  <td><span className={`badge text-bg-${statusColor(e.status)} badge-status`}>{e.status}</span></td>
                  <td className="text-end">
                    <Link to={`/admin/employees/${e.id}/edit`} className="btn btn-sm btn-outline-primary me-1" title="Edit">
                      <i className="bi bi-pencil" />
                    </Link>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => remove(e.id)} title="Delete">
                      <i className="bi bi-trash" />
                    </button>
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
