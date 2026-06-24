import { useEffect, useState, useCallback } from 'react';
import api, { apiError } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { fmtTime, fmtHours, prettyStatus } from '../../utils/format.js';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const monthLabel = (m) =>
  new Date(`${m}-01T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

const shiftMonth = (m, delta) => {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const STATUS_LEGEND = [
  { key: 'present', label: 'Present' },
  { key: 'late', label: 'Late' },
  { key: 'half_day', label: 'Half day' },
  { key: 'leave', label: 'Leave' },
  { key: 'absent', label: 'Absent' },
  { key: 'holiday', label: 'Holiday' },
  { key: 'weekend', label: 'Week off (Sun)' },
];

export default function Calendar() {
  const { isAdmin } = useAuth();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState({ days: {}, holidays: {}, counts: {} });
  const [employees, setEmployees] = useState([]);
  const [userId, setUserId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAdmin) {
      api.get('/employees', { params: { per_page: 100, status: 'active' } })
        .then((r) => setEmployees(r.data.data.data)).catch(() => {});
    }
  }, [isAdmin]);

  const load = useCallback(() => {
    const params = { month };
    if (isAdmin && userId) params.user_id = userId;
    api.get('/attendance/calendar', { params })
      .then((r) => setData(r.data.data)).catch((e) => setError(apiError(e)));
  }, [month, userId, isAdmin]);

  useEffect(() => { load(); }, [load]);

  const [y, mo] = month.split('-').map(Number);
  const firstDow = new Date(y, mo - 1, 1).getDay();
  const daysInMonth = new Date(y, mo, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const cellFor = (d) => {
    const date = `${month}-${String(d).padStart(2, '0')}`;
    const holiday = data.holidays?.[date];
    const rec = data.days?.[date];
    const dow = new Date(y, mo - 1, d).getDay();
    const status = rec?.status || (holiday ? 'holiday' : (dow === 0 ? 'weekend' : 'none'));
    return { date, d, holiday, rec, status, dow };
  };

  return (
    <>
      <div className="page-head">
        <div><h4 className="fw-bold">Attendance Calendar</h4>
          <div className="sub">Monthly view of attendance, leaves &amp; holidays</div></div>
        <div className="d-flex gap-2 align-items-center">
          {isAdmin && (
            <select className="form-select" style={{ maxWidth: 220 }} value={userId}
              onChange={(e) => setUserId(e.target.value)}>
              <option value="">My calendar</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </select>
          )}
          <div className="btn-group">
            <button className="btn btn-outline-secondary" onClick={() => setMonth((m) => shiftMonth(m, -1))}><i className="bi bi-chevron-left" /></button>
            <button className="btn btn-light fw-semibold" style={{ minWidth: 160 }}>{monthLabel(month)}</button>
            <button className="btn btn-outline-secondary" onClick={() => setMonth((m) => shiftMonth(m, 1))}><i className="bi bi-chevron-right" /></button>
          </div>
        </div>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}

      {/* Summary chips */}
      <div className="d-flex flex-wrap gap-2 mb-3">
        {STATUS_LEGEND.filter((s) => s.key !== 'holiday' && s.key !== 'weekend').map((s) => (
          <span key={s.key} className={`cal-chip cal-${s.key}`}>
            <b>{data.counts?.[s.key] ?? 0}</b> {s.label}
          </span>
        ))}
      </div>

      <div className="card stat-card"><div className="card-body">
        <div className="cal-grid cal-head">
          {WEEKDAYS.map((w) => <div key={w} className="cal-dow">{w}</div>)}
        </div>
        <div className="cal-grid">
          {cells.map((d, i) => {
            if (!d) return <div key={`b${i}`} className="cal-cell cal-empty" />;
            const c = cellFor(d);
            return (
              <div key={c.date} className={`cal-cell cal-${c.status}`} title={c.holiday || prettyStatus(c.rec?.status) || ''}>
                <div className="cal-date">{d}</div>
                {c.holiday ? (
                  <div className="cal-tag"><i className="bi bi-calendar-event" /> {c.holiday}</div>
                ) : c.status === 'weekend' ? (
                  <div className="cal-tag"><i className="bi bi-cup-hot" /> Week Off</div>
                ) : c.rec ? (
                  <>
                    <div className="cal-tag">{prettyStatus(c.rec.status)}</div>
                    {c.rec.check_in_time && <div className="cal-sub">{fmtTime(c.rec.check_in_time)}</div>}
                    {c.rec.working_minutes ? <div className="cal-sub">{fmtHours(c.rec.working_minutes)}</div> : null}
                    {Number(c.rec.face_verified) ? <i className="bi bi-patch-check-fill cal-face" title="Face verified" /> : null}
                  </>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="d-flex flex-wrap gap-3 mt-3 small">
          {STATUS_LEGEND.map((s) => (
            <span key={s.key} className="d-inline-flex align-items-center gap-1">
              <span className={`cal-swatch cal-${s.key}`} />{s.label}
            </span>
          ))}
        </div>
      </div></div>
    </>
  );
}
