import { useEffect, useState, useCallback, useRef } from 'react';
import api, { apiError } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';

const STATUS_COLOR = { scheduled: 'info', ongoing: 'success', completed: 'secondary', cancelled: 'danger' };
const RESP_COLOR = { invited: 'secondary', accepted: 'success', declined: 'danger' };

// Auto-generated links are Jitsi rooms we can embed in-page (same origin-free
// IFrame API). External links (Zoom/custom) can't be embedded → open in a tab.
const jitsiRoom = (link) => {
  const m = /meet\.jit\.si\/([^?#]+)/.exec(link || '');
  return m ? decodeURIComponent(m[1]) : null;
};
const loadJitsiApi = () => new Promise((resolve, reject) => {
  if (window.JitsiMeetExternalAPI) return resolve();
  const s = document.createElement('script');
  s.src = 'https://meet.jit.si/external_api.js';
  s.async = true; s.onload = resolve; s.onerror = reject;
  document.body.appendChild(s);
});

const fmtWhen = (dt) => {
  if (!dt) return '—';
  const d = new Date(dt.replace(' ', 'T'));
  return d.toLocaleString([], { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};
const isPast = (dt, mins = 0) => {
  if (!dt) return false;
  return new Date(dt.replace(' ', 'T')).getTime() + mins * 60000 < Date.now();
};

const EMPTY = { title: '', agenda: '', meeting_date: '', meeting_link: '', attendees: [] };

export default function Meetings() {
  const { isAdmin, user } = useAuth();
  const [list, setList] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [filter, setFilter] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [active, setActive] = useState(null); // meeting joined in-page
  const frameRef = useRef(null);              // container for the embedded call
  const apiRef = useRef(null);                // JitsiMeetExternalAPI instance

  const load = useCallback(() => {
    api.get('/meetings', { params: filter ? { status: filter } : {} })
      .then((r) => setList(r.data.data)).catch((e) => setError(apiError(e)));
  }, [filter]);

  useEffect(() => { load(); }, [load]);
  // Anyone can schedule a meeting and invite colleagues, so everyone needs the list.
  useEffect(() => {
    api.get('/lookups').then((r) => setEmployees(r.data.data.managers || [])).catch(() => {});
  }, []);

  const toggleAttendee = (id) => setForm((f) => ({
    ...f,
    attendees: f.attendees.includes(id) ? f.attendees.filter((x) => x !== id) : [...f.attendees, id],
  }));
  const allSelected = employees.length > 0 && form.attendees.length === employees.length;
  const toggleAll = () => setForm((f) => ({ ...f, attendees: allSelected ? [] : employees.map((e) => e.id) }));

  const schedule = async (e) => {
    e.preventDefault();
    setError(''); setMsg('');
    try {
      await api.post('/meetings', { ...form, attendees: form.attendees });
      setMsg('Meeting scheduled.');
      setForm(EMPTY);
      load();
    } catch (err) { setError(apiError(err)); }
  };

  const remove = async (id) => {
    if (!confirm('Delete this meeting?')) return;
    try { await api.delete(`/meetings/${id}`); load(); } catch (e) { alert(apiError(e)); }
  };
  const copyLink = async (link) => {
    try { await navigator.clipboard.writeText(link); setMsg('Meeting link copied.'); setTimeout(() => setMsg(''), 2000); }
    catch { /* clipboard blocked — ignore */ }
  };
  const respond = async (id, response) => {
    try { await api.patch(`/meetings/${id}/respond`, { response }); load(); } catch (e) { alert(apiError(e)); }
  };
  // Join in-page: mark attendance (ignored if not an invitee, e.g. admins), then
  // embed the Jitsi room right here. External links fall back to a new tab.
  const join = async (m) => {
    try { await api.post(`/meetings/${m.id}/attend`, {}); } catch { /* not invited — ignore */ }
    load();
    const room = jitsiRoom(m.meeting_link);
    if (!room) { if (m.meeting_link) window.open(m.meeting_link, '_blank', 'noopener'); return; }
    setActive(m);
  };

  const closeCall = useCallback(() => {
    if (apiRef.current) { try { apiRef.current.dispose(); } catch { /* ignore */ } apiRef.current = null; }
    setActive(null);
  }, []);

  // Mount / unmount the embedded Jitsi call when a meeting is active.
  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    (async () => {
      try { await loadJitsiApi(); } catch { return; }
      if (cancelled || !frameRef.current) return;
      apiRef.current = new window.JitsiMeetExternalAPI('meet.jit.si', {
        roomName: jitsiRoom(active.meeting_link),
        parentNode: frameRef.current,
        width: '100%', height: '100%',
        userInfo: { displayName: user?.full_name || 'Guest' },
        configOverwrite: { prejoinPageEnabled: false },
        interfaceConfigOverwrite: { MOBILE_APP_PROMO: false },
      });
      apiRef.current.addListener('readyToClose', () => closeCall());
    })();
    return () => {
      cancelled = true;
      if (apiRef.current) { try { apiRef.current.dispose(); } catch { /* ignore */ } apiRef.current = null; }
    };
  }, [active, user, closeCall]);

  return (
    <>
      <div className="page-head">
        <div><h4 className="fw-bold">{isAdmin ? 'Meetings' : 'My Meetings'}</h4>
          <div className="sub">Schedule meetings, invite colleagues & track attendance</div></div>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      {msg && <div className="alert alert-success">{msg}</div>}

      <div className="row g-3">
        {(
          <div className="col-lg-4">
            <div className="card stat-card"><div className="card-body">
              <h6 className="fw-semibold mb-3"><i className="bi bi-calendar-plus me-1 text-primary" />Schedule Meeting</h6>
              <form onSubmit={schedule}>
                <input className="form-control mb-2" placeholder="Meeting title" value={form.title} required
                  onChange={(e) => setForm({ ...form, title: e.target.value })} />
                <textarea className="form-control mb-2" rows={2} placeholder="Agenda (optional)" value={form.agenda}
                  onChange={(e) => setForm({ ...form, agenda: e.target.value })} />
                <label className="form-label small fw-semibold mb-1">Date &amp; time</label>
                <input type="datetime-local" className="form-control mb-2" value={form.meeting_date} required
                  onChange={(e) => setForm({ ...form, meeting_date: e.target.value })} />
                <input className="form-control" placeholder="Meeting link (optional)" value={form.meeting_link}
                  onChange={(e) => setForm({ ...form, meeting_link: e.target.value })} />
                <div className="text-muted mb-2" style={{ fontSize: '.72rem' }}>
                  <i className="bi bi-magic me-1" />Leave empty to auto-generate an instant video-call link.
                </div>

                <div className="d-flex justify-content-between align-items-center mb-1">
                  <label className="form-label small fw-semibold mb-0">Attendees</label>
                  <button type="button" className="btn btn-link btn-sm p-0 small" onClick={toggleAll}>
                    {allSelected ? 'Clear all' : 'Select all'}
                  </button>
                </div>
                <div className="border rounded p-2 mb-2" style={{ maxHeight: 180, overflowY: 'auto' }}>
                  {employees.length === 0 ? <div className="text-muted small">No employees.</div> : employees.map((m) => (
                    <label key={m.id} className="d-flex align-items-center gap-2 small py-1" style={{ cursor: 'pointer' }}>
                      <input type="checkbox" className="form-check-input m-0" checked={form.attendees.includes(m.id)}
                        onChange={() => toggleAttendee(m.id)} />
                      <span>{m.full_name} <span className="text-muted">({m.employee_code})</span></span>
                    </label>
                  ))}
                </div>
                <div className="text-muted small mb-2">{form.attendees.length} selected</div>
                <button className="btn btn-gap w-100">Schedule Meeting</button>
              </form>
            </div></div>
          </div>
        )}

        <div className="col-lg-8">
          <div className="card stat-card"><div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="fw-semibold mb-0"><i className="bi bi-calendar-event me-1 text-primary" />
                {isAdmin ? 'All Meetings' : 'Upcoming & Past'}</h6>
              <select className="form-select form-select-sm" style={{ maxWidth: 160 }} value={filter}
                onChange={(e) => setFilter(e.target.value)}>
                <option value="">All</option><option value="scheduled">Scheduled</option>
                <option value="ongoing">Ongoing</option><option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {list.length === 0 ? (
              <div className="text-center py-5 text-muted">
                <i className="bi bi-calendar-x fs-1 opacity-50 d-block mb-2" />No meetings.
              </div>
            ) : (
              <div className="d-flex flex-column gap-2">
                {list.map((m) => {
                  const canManage = isAdmin || Number(m.is_organizer) === 1;
                  const isInvitee = m.response != null;
                  const past = isPast(m.meeting_date, m.duration_minutes);
                  return (
                  <div key={m.id} className="border rounded p-3">
                    <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
                      <div className="flex-grow-1">
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                          <span className="fw-semibold">{m.title}</span>
                          <span className={`badge text-bg-${STATUS_COLOR[m.status] || 'secondary'} badge-status text-capitalize`}>{m.status}</span>
                          {Number(m.is_organizer) === 1 && (
                            <span className="badge text-bg-primary badge-status"><i className="bi bi-star me-1" />Organizer</span>
                          )}
                          {isInvitee && (
                            <span className={`badge text-bg-${RESP_COLOR[m.response]} badge-status text-capitalize`}>{m.response}</span>
                          )}
                          {Number(m.attended) === 1 && (
                            <span className="badge text-bg-success badge-status"><i className="bi bi-check2-circle me-1" />Attended</span>
                          )}
                        </div>
                        <div className="text-muted small mt-1">
                          <i className="bi bi-clock me-1" />{fmtWhen(m.meeting_date)}
                          {m.organizer && <> · by {m.organizer}</>}
                        </div>
                        {m.agenda && <div className="small mt-1" style={{ whiteSpace: 'pre-wrap' }}>{m.agenda}</div>}
                        {m.meeting_link && (
                          <button type="button" className="meet-link-chip mt-2" onClick={() => join(m)} title={m.meeting_link}>
                            <i className="bi bi-camera-video" />
                            <span>{m.meeting_link.replace(/^https?:\/\//, '')}</span>
                          </button>
                        )}
                        {canManage && (
                          <div className="text-muted small mt-1">
                            <i className="bi bi-people me-1" />{m.invitee_count} invited · {m.attended_count} attended
                          </div>
                        )}
                      </div>

                      <div className="d-flex flex-column gap-1 align-items-end">
                        {m.meeting_link && m.status !== 'cancelled' && (
                          <button className="btn btn-sm btn-gap" onClick={() => join(m)}>
                            <i className="bi bi-camera-video me-1" />{Number(m.attended) === 1 ? 'Rejoin' : 'Join'}
                          </button>
                        )}
                        {canManage && m.meeting_link && (
                          <button className="btn btn-sm btn-light" title="Copy link" onClick={() => copyLink(m.meeting_link)}>
                            <i className="bi bi-clipboard" />
                          </button>
                        )}
                        {canManage && (
                          <button className="btn btn-sm btn-outline-danger" onClick={() => remove(m.id)}>
                            <i className="bi bi-trash" />
                          </button>
                        )}
                        {isInvitee && m.status !== 'cancelled' && !past && (
                          <>
                            {m.response !== 'accepted' && (
                              <button className="btn btn-sm btn-outline-success" onClick={() => respond(m.id, 'accepted')}>Accept</button>
                            )}
                            {m.response !== 'declined' && (
                              <button className="btn btn-sm btn-outline-secondary" onClick={() => respond(m.id, 'declined')}>Decline</button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div></div>
        </div>
      </div>

      {/* In-page video call (embedded Jitsi) — no tab switch */}
      {active && (
        <div className="meet-overlay" role="dialog" aria-modal="true">
          <div className="meet-modal">
            <div className="meet-head">
              <div className="fw-semibold text-truncate"><i className="bi bi-camera-video me-2 text-primary" />{active.title}</div>
              <button className="btn btn-sm btn-outline-danger" onClick={closeCall}>
                <i className="bi bi-box-arrow-left me-1" />Leave
              </button>
            </div>
            <div className="meet-frame" ref={frameRef} />
          </div>
        </div>
      )}
    </>
  );
}
