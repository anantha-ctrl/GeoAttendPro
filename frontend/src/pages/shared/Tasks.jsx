import { useEffect, useState, useCallback } from 'react';
import api, { apiError } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { fmtDate } from '../../utils/format.js';

const priColor = { high: 'danger', medium: 'warning', low: 'secondary' };
const statusColor = { todo: 'secondary', in_progress: 'info', done: 'success' };
const statusLabel = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' };

export default function Tasks() {
  const { isAdmin } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState({ status: '' });
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', assigned_to: '', priority: 'medium', due_date: '' });
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get('/tasks', { params: filter }).then((r) => setTasks(r.data.data)).catch((e) => setError(apiError(e)));
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (isAdmin) api.get('/lookups').then((r) => setEmployees(r.data.data.managers || [])).catch(() => {});
  }, [isAdmin]);

  const assign = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/tasks', form);
      setForm({ title: '', description: '', assigned_to: '', priority: 'medium', due_date: '' });
      load();
    } catch (err) { setError(apiError(err)); }
  };

  const setStatus = async (id, status) => {
    try { await api.patch(`/tasks/${id}/status`, { status }); load(); } catch (e) { alert(apiError(e)); }
  };
  const remove = async (id) => {
    if (!confirm('Delete this task?')) return;
    try { await api.delete(`/tasks/${id}`); load(); } catch (e) { alert(apiError(e)); }
  };

  return (
    <>
      <div className="page-head">
        <div><h4 className="fw-bold">{isAdmin ? 'Task Management' : 'My Tasks'}</h4>
          <div className="sub">{isAdmin ? 'Assign &amp; track team tasks' : 'Your assigned tasks — update progress'}</div></div>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="row g-3">
        {isAdmin && (
          <div className="col-lg-4">
            <div className="card stat-card"><div className="card-body">
              <h6 className="fw-semibold mb-3">Assign Task</h6>
              <form onSubmit={assign}>
                <input className="form-control mb-2" placeholder="Task title" value={form.title} required
                  onChange={(e) => setForm({ ...form, title: e.target.value })} />
                <textarea className="form-control mb-2" rows={2} placeholder="Description" value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })} />
                <select className="form-select mb-2" value={form.assigned_to} required
                  onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}>
                  <option value="">Assign to…</option>
                  {employees.map((m) => <option key={m.id} value={m.id}>{m.full_name} ({m.employee_code})</option>)}
                </select>
                <div className="row g-2">
                  <div className="col-6"><select className="form-select mb-2" value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                    <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                  </select></div>
                  <div className="col-6"><input type="date" className="form-control mb-2" value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
                </div>
                <button className="btn btn-gap w-100">Assign Task</button>
              </form>
            </div></div>
          </div>
        )}

        <div className={isAdmin ? 'col-lg-8' : 'col-12'}>
          <div className="card stat-card"><div className="card-body">
            <div className="d-flex justify-content-between mb-2">
              <h6 className="fw-semibold mb-0">Tasks</h6>
              <select className="form-select form-select-sm" style={{ maxWidth: 160 }} value={filter.status}
                onChange={(e) => setFilter({ status: e.target.value })}>
                <option value="">All</option><option value="todo">To Do</option>
                <option value="in_progress">In Progress</option><option value="done">Done</option>
              </select>
            </div>
            <div className="table-responsive">
              <table className="table gap-table table-hover align-middle">
                <thead><tr>
                  <th>Task</th>{isAdmin && <th>Assignee</th>}<th>Priority</th><th>Due</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {tasks.length === 0 ? (
                    <tr><td colSpan={isAdmin ? 6 : 5} className="text-center py-4 text-muted">No tasks.</td></tr>
                  ) : tasks.map((t) => (
                    <tr key={t.id}>
                      <td><div className="fw-semibold">{t.title}</div>
                        {t.description && <div className="small text-muted">{t.description}</div>}</td>
                      {isAdmin && <td>{t.assignee_name}<div className="small text-muted">{t.assignee_code}</div></td>}
                      <td><span className={`badge text-bg-${priColor[t.priority]}`}>{t.priority}</span></td>
                      <td>{t.due_date ? fmtDate(t.due_date) : '—'}</td>
                      <td>
                        <select className={`form-select form-select-sm badge-status-select`} style={{ maxWidth: 140 }}
                          value={t.status} onChange={(e) => setStatus(t.id, e.target.value)}>
                          <option value="todo">To Do</option>
                          <option value="in_progress">In Progress</option>
                          <option value="done">Done</option>
                        </select>
                      </td>
                      <td className="text-end">
                        <span className={`badge text-bg-${statusColor[t.status]} me-2`}>{statusLabel[t.status]}</span>
                        {isAdmin && <button className="btn btn-sm btn-outline-danger" onClick={() => remove(t.id)}><i className="bi bi-trash" /></button>}
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
