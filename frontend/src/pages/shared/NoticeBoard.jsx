import { useEffect, useState } from 'react';
import api, { apiError } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { fmtDate } from '../../utils/format.js';

export default function NoticeBoard() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ title: '', body: '', pinned: false });
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');

  const load = () => api.get('/announcements').then((r) => setItems(r.data.data)).catch((e) => setError(apiError(e)));
  useEffect(() => { load(); }, []);

  const reset = () => { setEditId(null); setForm({ title: '', body: '', pinned: false }); };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editId) await api.put(`/announcements/${editId}`, form);
      else await api.post('/announcements', form);
      reset();
      load();
    } catch (err) { setError(apiError(err)); }
  };

  const edit = (a) => { setEditId(a.id); setForm({ title: a.title, body: a.body, pinned: !!Number(a.pinned) }); };
  const remove = async (id) => {
    if (!confirm('Delete this announcement?')) return;
    try { await api.delete(`/announcements/${id}`); load(); } catch (e) { alert(apiError(e)); }
  };

  return (
    <>
      <div className="page-head">
        <div><h4 className="fw-bold">Notice Board</h4>
          <div className="sub">{isAdmin ? 'Post announcements for the whole team' : 'Latest company announcements'}</div></div>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="row g-3">
        {isAdmin && (
          <div className="col-lg-4">
            <div className="card stat-card"><div className="card-body">
              <h6 className="fw-semibold mb-3">{editId ? 'Edit' : 'New'} Announcement</h6>
              <form onSubmit={submit}>
                <input className="form-control mb-2" placeholder="Title" value={form.title} required
                  onChange={(e) => setForm({ ...form, title: e.target.value })} />
                <textarea className="form-control mb-2" rows={5} placeholder="Write your announcement…" value={form.body} required
                  onChange={(e) => setForm({ ...form, body: e.target.value })} />
                <div className="form-check mb-3">
                  <input className="form-check-input" type="checkbox" id="pin" checked={form.pinned}
                    onChange={(e) => setForm({ ...form, pinned: e.target.checked })} />
                  <label className="form-check-label small" htmlFor="pin">📌 Pin to top</label>
                </div>
                <div className="d-flex gap-2">
                  <button className="btn btn-gap flex-grow-1">{editId ? 'Update' : 'Post'}</button>
                  {editId && <button type="button" className="btn btn-light" onClick={reset}>Cancel</button>}
                </div>
              </form>
            </div></div>
          </div>
        )}

        <div className={isAdmin ? 'col-lg-8' : 'col-12'}>
          {items.length === 0 ? (
            <div className="card stat-card"><div className="card-body text-center text-muted py-5">
              <i className="bi bi-megaphone fs-3 d-block mb-2 opacity-50" />No announcements yet.</div></div>
          ) : items.map((a) => (
            <div key={a.id} className={`card stat-card mb-3 ${Number(a.pinned) ? 'border-warning' : ''}`}>
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start">
                  <h6 className="fw-bold mb-1">
                    {Number(a.pinned) ? <i className="bi bi-pin-angle-fill text-warning me-1" /> : null}{a.title}
                  </h6>
                  {isAdmin && (
                    <div className="d-flex gap-1">
                      <button className="btn btn-sm btn-outline-primary" onClick={() => edit(a)}><i className="bi bi-pencil" /></button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => remove(a.id)}><i className="bi bi-trash" /></button>
                    </div>
                  )}
                </div>
                <p className="mb-2" style={{ whiteSpace: 'pre-wrap' }}>{a.body}</p>
                <div className="text-muted small">
                  <i className="bi bi-person me-1" />{a.author || 'Admin'} · <i className="bi bi-clock me-1" />{fmtDate(a.created_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
