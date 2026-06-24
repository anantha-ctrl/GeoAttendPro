import { useEffect, useState, useCallback, useRef } from 'react';
import api, { apiError, API_BASE } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { fmtDate } from '../../utils/format.js';
const CATEGORIES = ['ID Proof', 'Address Proof', 'Education', 'Experience', 'Contract', 'Certificate', 'Other'];

const fileIcon = (mime = '') => {
  if (mime.includes('pdf')) return 'file-earmark-pdf';
  if (mime.includes('image')) return 'file-earmark-image';
  if (mime.includes('word')) return 'file-earmark-word';
  if (mime.includes('sheet') || mime.includes('excel')) return 'file-earmark-spreadsheet';
  return 'file-earmark';
};
const prettySize = (b) => (!b ? '' : b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.ceil(b / 1024)} KB`);

export default function Documents() {
  const { isAdmin } = useAuth();
  const [docs, setDocs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [userId, setUserId] = useState('');
  const [form, setForm] = useState({ title: '', category: 'ID Proof' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    if (isAdmin) {
      api.get('/employees', { params: { per_page: 100, status: 'active' } })
        .then((r) => setEmployees(r.data.data.data)).catch(() => {});
    }
  }, [isAdmin]);

  const load = useCallback(() => {
    const params = {};
    if (isAdmin && userId) params.user_id = userId;
    api.get('/documents', { params }).then((r) => setDocs(r.data.data)).catch((e) => setError(apiError(e)));
  }, [isAdmin, userId]);

  useEffect(() => { load(); }, [load]);

  const upload = async (e) => {
    e.preventDefault();
    setError(''); setMsg('');
    const file = fileRef.current?.files?.[0];
    if (!file) return setError('Please choose a file.');
    if (!form.title.trim()) return setError('Please enter a title.');
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', form.title);
      fd.append('category', form.category);
      if (isAdmin && userId) fd.append('user_id', userId);
      await api.post('/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setMsg('Document uploaded.');
      setForm({ title: '', category: 'ID Proof' });
      if (fileRef.current) fileRef.current.value = '';
      load();
    } catch (err) { setError(apiError(err)); }
    finally { setBusy(false); }
  };

  const remove = async (id) => {
    if (!confirm('Delete this document?')) return;
    try { await api.delete(`/documents/${id}`); load(); } catch (e) { alert(apiError(e)); }
  };

  return (
    <>
      <div className="page-head">
        <div><h4 className="fw-bold">Documents</h4>
          <div className="sub">{isAdmin ? 'Upload &amp; manage employee documents' : 'Upload your ID proofs, certificates &amp; more'}</div></div>
        {isAdmin && (
          <select className="form-select" style={{ maxWidth: 240 }} value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">My documents</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
          </select>
        )}
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      {msg && <div className="alert alert-success">{msg}</div>}

      <div className="row g-3">
        <div className="col-lg-4">
          <div className="card stat-card"><div className="card-body">
            <h6 className="fw-semibold mb-3">Upload {isAdmin && userId ? 'for employee' : ''}</h6>
            <form onSubmit={upload}>
              <label className="form-label small fw-semibold">Title</label>
              <input className="form-control mb-2" value={form.title} required
                onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Aadhaar Card" />
              <label className="form-label small fw-semibold">Category</label>
              <select className="form-select mb-2" value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <label className="form-label small fw-semibold">File</label>
              <input ref={fileRef} type="file" className="form-control mb-1"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx" />
              <p className="text-muted small">PDF, image, Word or Excel · max 10 MB</p>
              <button className="btn btn-gap w-100" disabled={busy}>
                <i className="bi bi-upload me-1" />{busy ? 'Uploading…' : 'Upload Document'}
              </button>
            </form>
          </div></div>
        </div>

        <div className="col-lg-8">
          <div className="card stat-card"><div className="card-body p-0">
            <table className="table gap-table table-hover align-middle">
              <thead><tr>
                <th>Document</th><th>Category</th>{isAdmin && <th>Owner</th>}<th>Uploaded</th><th className="text-end">Actions</th></tr></thead>
              <tbody>
                {docs.length === 0 ? (
                  <tr><td colSpan={isAdmin ? 5 : 4} className="text-center py-5 text-muted">
                    <i className="bi bi-folder2-open fs-3 d-block mb-2 opacity-50" />No documents yet.</td></tr>
                ) : docs.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <i className={`bi bi-${fileIcon(d.mime)} fs-4 text-primary`} />
                        <div><div className="fw-semibold">{d.title}</div>
                          <div className="text-muted" style={{ fontSize: '.72rem' }}>{prettySize(d.size_bytes)}</div></div>
                      </div>
                    </td>
                    <td><span className="badge text-bg-light">{d.category}</span></td>
                    {isAdmin && <td>{d.full_name}<div className="small text-muted">{d.employee_code}</div></td>}
                    <td>{fmtDate(d.created_at)}</td>
                    <td className="text-end">
                      <a className="btn btn-sm btn-outline-primary me-1" href={`${API_BASE}${d.file_path}`} target="_blank" rel="noreferrer" title="View / download">
                        <i className="bi bi-box-arrow-up-right" />
                      </a>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => remove(d.id)} title="Delete">
                        <i className="bi bi-trash" />
                      </button>
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
