import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import api from '../../api/client.js';
import StatCard from '../../components/StatCard.jsx';
import Celebrations from '../../components/Celebrations.jsx';
import WorkStatusBadge from '../../components/WorkStatusBadge.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { fmtTime, fmtHours, statusColor, prettyStatus, fmtDate } from '../../utils/format.js';

ChartJS.register(ArcElement, Tooltip, Legend);

const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const TL_LABELS = { login: 'Logged in', rest_start: 'Rest started', rest_end: 'Rest ended', overtime_start: 'Overtime started', logout: 'Logged out' };
const priColor = (p) => (p === 'high' ? 'danger' : p === 'medium' ? 'warning' : 'secondary');
const taskStatus = (s) => (s === 'in_progress' ? 'In Progress' : s === 'todo' ? 'To Do' : s);

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [live, setLive] = useState(null); // live login/rest/active from ActivityTracker

  useEffect(() => {
    const load = () => api.get('/dashboard/employee').then((r) => setData(r.data.data)).catch(() => {});
    load();
    const id = setInterval(load, 30000); // live auto-refresh
    const onActivity = (e) => setLive((prev) => ({ ...e.detail, timeline: e.detail?.timeline ?? prev?.timeline ?? [] }));
    window.addEventListener('activity-update', onActivity);
    return () => { clearInterval(id); window.removeEventListener('activity-update', onActivity); };
  }, []);

  if (!data) return <div className="spinner-border text-primary" />;

  const today = data.today.attendance;
  const m = data.monthly;
  const c = m.counts;
  const presentDays = c.present + c.late + c.wfh;
  const pay = data.payroll || {};
  const hoursToday = today?.working_minutes ? Math.round((today.working_minutes / 60) * 100) / 100 : 0;

  // Login (gross) vs rest (sleep/screen-off) vs active time for today — live from ActivityTracker.
  const grossMinToday   = live?.gross_minutes ?? (today?.working_minutes || 0);
  const restMinToday    = live?.rest_minutes ?? Math.round((today?.rest_seconds || 0) / 60);
  const activeMinToday  = live?.active_minutes ?? Math.max(0, grossMinToday - restMinToday);
  const overtimeMinToday = live?.overtime_minutes ?? 0;
  const liveTimeline    = live?.timeline || [];

  const ctaLabel = data.today.can_checkin ? 'Check In' : data.today.can_checkout ? 'Check Out' : 'Mark Attendance';

  const donut = {
    labels: ['Present', 'Late', 'Half Day', 'Leave', 'WFH', 'Absent'],
    datasets: [{
      data: [c.present, c.late, c.half_day, c.leave, c.wfh, c.absent],
      backgroundColor: ['#10b981', '#f59e0b', '#0ea5e9', '#64748b', '#7c3aed', '#ef4444'],
      borderWidth: 0,
    }],
  };

  const quickLinks = [
    { to: '/me/attendance', icon: 'camera', label: 'Mark Attendance', color: '#4f46e5' },
    { to: '/leaves', icon: 'calendar-plus', label: 'Apply Leave', color: '#0ea5e9' },
    { to: '/expenses', icon: 'receipt', label: 'Claim Expense', color: '#10b981' },
    { to: '/help-desk', icon: 'life-preserver', label: 'Help Desk', color: '#f59e0b' },
  ];

  return (
    <>
      {/* Hero */}
      <div className="dash-hero mb-4">
        <div>
          <h4 className="fw-bold mb-1">Welcome, {user.full_name.split(' ')[0]} 👋</h4>
          <div className="small opacity-75"><i className="bi bi-calendar3 me-1" />{new Date().toDateString()}</div>
        </div>
        <Link to="/me/attendance" className="btn btn-light btn-lg fw-semibold">
          <i className="bi bi-camera me-1" />{ctaLabel}
        </Link>
      </div>

      {/* Quick actions */}
      <div className="row g-3 mb-4">
        {quickLinks.map((q) => (
          <div className="col-6 col-lg-3" key={q.to}>
            <Link to={q.to} className="card stat-card h-100 text-decoration-none quick-link">
              <div className="card-body d-flex align-items-center gap-3 py-3">
                <span className="quick-ico" style={{ background: `${q.color}1a`, color: q.color }}>
                  <i className={`bi bi-${q.icon}`} />
                </span>
                <span className="fw-semibold text-body">{q.label}</span>
              </div>
            </Link>
          </div>
        ))}
      </div>

      {/* Widgets */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3"><StatCard icon="graph-up-arrow" label="Attendance %" value={m.attendance_percent} suffix="%" color="#22c55e" /></div>
        <div className="col-6 col-lg-3"><StatCard icon="clock-fill" label="Hours Today" value={hoursToday} suffix="h" color="#6366f1" /></div>
        <div className="col-6 col-lg-3"><StatCard icon="clock-history" label="Hours This Month" value={m.total_work_hours} suffix="h" color="#0ea5e9" /></div>
        <div className="col-6 col-lg-3"><StatCard icon="check-circle-fill" label="Present Days" value={presentDays} color="#4f46e5" /></div>
        <div className="col-6 col-lg-3"><StatCard icon="clock" label="Late Days" value={c.late} color="#f59e0b" /></div>
        <div className="col-6 col-lg-3"><StatCard icon="cash-stack" label="Est. Net Pay" value={money(pay.net_pay)} color="#16a34a" /></div>
        <div className="col-6 col-lg-3"><StatCard icon="list-check" label="Open Tasks" value={data.open_tasks_count ?? 0} color="#7c3aed" /></div>
        <div className="col-6 col-lg-3"><StatCard icon="hourglass" label="Pending Leaves" value={data.pending_leaves} color="#f97316" /></div>
      </div>

      {/* Monthly working-hours target */}
      <div className="card stat-card mb-4"><div className="card-body">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
          <h6 className="fw-semibold mb-0"><i className="bi bi-clock-history me-1 text-primary" />Monthly Working Hours</h6>
          <div className="small text-muted d-flex align-items-center gap-2">
            {pay.overtime_hours > 0 && (
              <span className="badge text-bg-success badge-status">
                <i className="bi bi-stopwatch me-1" />+{pay.overtime_hours}h OT · +{money(pay.overtime_incentive)}
              </span>
            )}
            <span>Target <b>{m.required_hours}h</b> ({m.days_in_month} days × {m.full_day_hours}h)</span>
          </div>
        </div>
        <div className="d-flex justify-content-between align-items-end mb-1">
          <div>
            <span className="fs-3 fw-bold text-success">{m.worked_hours}h</span>
            <span className="text-muted"> / {m.required_hours}h worked</span>
          </div>
          <div className="text-end">
            <div className="fw-bold">{m.hours_percent}%</div>
            <div className="text-muted small">{m.remaining_hours}h remaining</div>
          </div>
        </div>
        <div className="progress" style={{ height: 12, borderRadius: 8 }}>
          <div className={`progress-bar ${m.hours_percent >= 100 ? 'bg-success' : 'bg-primary'}`}
            role="progressbar" style={{ width: `${Math.min(100, m.hours_percent)}%` }}
            aria-valuenow={m.hours_percent} aria-valuemin={0} aria-valuemax={100} />
        </div>
      </div></div>

      <div className="row g-3 mb-4">
        {/* Today's status */}
        <div className="col-lg-5">
          <div className="card stat-card h-100"><div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="fw-semibold mb-0">Today's Status</h6>
              {data.today.can_checkout && <WorkStatusBadge status={live?.status || 'working'} live />}
            </div>
            {today ? (
              <>
                <span className={`badge text-bg-${statusColor(today.status)} badge-status mb-3`}>
                  {prettyStatus(today.status)}
                </span>
                <div className="row text-center g-2 mb-2">
                  <div className="col-6"><div className="text-muted small">Check-in</div><div className="fw-bold">{fmtTime(today.check_in_time)}</div></div>
                  <div className="col-6"><div className="text-muted small">Check-out</div><div className="fw-bold">{fmtTime(today.check_out_time)}</div></div>
                </div>
                <div className="row text-center g-2">
                  <div className="col-3"><div className="text-muted small">Login</div><div className="fw-bold text-primary">{fmtHours(grossMinToday)}</div></div>
                  <div className="col-3"><div className="text-muted small"><i className="bi bi-moon-stars" /> Rest</div><div className="fw-bold text-warning">{fmtHours(restMinToday)}</div></div>
                  <div className="col-3"><div className="text-muted small"><i className="bi bi-lightning-charge" /> Active</div><div className="fw-bold text-success">{fmtHours(activeMinToday)}</div></div>
                  <div className="col-3"><div className="text-muted small"><i className="bi bi-stopwatch" /> OT</div><div className="fw-bold text-info">{fmtHours(overtimeMinToday)}</div></div>
                </div>
                {data.today.can_checkout && (
                  <div className="text-muted small mt-2 text-center">
                    <span className="live-dot me-1" />Live · screen-off / lock / sleep counts as rest
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-3">
                <i className="bi bi-fingerprint fs-1 text-muted opacity-50" />
                <p className="text-muted mt-2 mb-3">You haven't checked in yet.</p>
                <Link to="/me/attendance" className="btn btn-gap"><i className="bi bi-camera me-1" />Check In Now</Link>
              </div>
            )}
          </div></div>
        </div>

        {/* This month chart */}
        <div className="col-lg-4">
          <div className="card stat-card h-100"><div className="card-body">
            <h6 className="fw-semibold mb-3">This Month</h6>
            <Doughnut data={donut} options={{ plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } } }} />
          </div></div>
        </div>

        {/* Monthly summary */}
        <div className="col-lg-3">
          <div className="card stat-card h-100"><div className="card-body">
            <h6 className="fw-semibold mb-3">Summary ({m.days_in_month}d)</h6>
            <div className="d-flex justify-content-between small mb-2"><span>Present</span><b>{c.present}</b></div>
            <div className="d-flex justify-content-between small mb-2"><span>Late</span><b>{c.late}</b></div>
            <div className="d-flex justify-content-between small mb-2"><span>Half Day</span><b>{c.half_day}</b></div>
            <div className="d-flex justify-content-between small mb-2"><span>WFH</span><b>{c.wfh}</b></div>
            <div className="d-flex justify-content-between small mb-2"><span>Leave</span><b>{c.leave}</b></div>
            <div className="d-flex justify-content-between small"><span>Absent</span><b>{c.absent}</b></div>
          </div></div>
        </div>
      </div>

      {/* Today's work timeline (horizontal) */}
      {liveTimeline.length > 0 && (
        <div className="card stat-card mb-4"><div className="card-body">
          <h6 className="fw-semibold mb-3"><i className="bi bi-clock-history me-1 text-primary" />Today's Timeline</h6>
          <div className="wm-htimeline">
            {liveTimeline.slice(-12).map((ev, i) => (
              <div key={i} className={`htl-item tl-${ev.event_type}`}>
                <span className="htl-dot" />
                <div className="htl-label">{TL_LABELS[ev.event_type] || ev.event_type}</div>
                <div className="htl-time">{fmtTime(ev.event_time)}</div>
              </div>
            ))}
          </div>
        </div></div>
      )}

      {/* Notice + Tasks + Holidays */}
      <div className="row g-3 mb-4">
        {/* Latest notice */}
        <div className="col-lg-4">
          <div className="card stat-card h-100"><div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="fw-semibold mb-0"><i className="bi bi-megaphone me-1 text-primary" />Latest Notice</h6>
              <Link to="/notice-board" className="small link-gap">All</Link>
            </div>
            {data.latest_announcement ? (
              <>
                {data.latest_announcement.pinned === 1 && <span className="badge text-bg-warning badge-status mb-2"><i className="bi bi-pin-angle me-1" />Pinned</span>}
                <div className="fw-semibold">{data.latest_announcement.title}</div>
                <p className="text-muted small mt-1 mb-2" style={{ whiteSpace: 'pre-wrap' }}>
                  {data.latest_announcement.body?.length > 160 ? `${data.latest_announcement.body.slice(0, 160)}…` : data.latest_announcement.body}
                </p>
                <div className="text-muted" style={{ fontSize: '.72rem' }}>
                  {data.latest_announcement.author || 'Admin'} · {fmtDate(data.latest_announcement.created_at)}
                </div>
              </>
            ) : <p className="text-muted small mb-0">No announcements yet.</p>}
          </div></div>
        </div>

        {/* My tasks */}
        <div className="col-lg-4">
          <div className="card stat-card h-100"><div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="fw-semibold mb-0"><i className="bi bi-list-check me-1 text-purple" />My Tasks</h6>
              <Link to="/tasks" className="small link-gap">All</Link>
            </div>
            {data.my_tasks?.length ? (
              <ul className="list-group list-group-flush">
                {data.my_tasks.map((t) => (
                  <li key={t.id} className="list-group-item px-0 d-flex justify-content-between align-items-start gap-2">
                    <div>
                      <div className="small fw-semibold">{t.title}</div>
                      <div className="text-muted" style={{ fontSize: '.72rem' }}>
                        {taskStatus(t.status)}{t.due_date ? ` · due ${fmtDate(t.due_date)}` : ''}
                      </div>
                    </div>
                    <span className={`badge text-bg-${priColor(t.priority)} badge-status text-capitalize`}>{t.priority}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-muted small mb-0">No open tasks. 🎉</p>}
          </div></div>
        </div>

        {/* Upcoming holidays */}
        <div className="col-lg-4">
          <div className="card stat-card h-100"><div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="fw-semibold mb-0"><i className="bi bi-calendar-event me-1 text-success" />Upcoming Holidays</h6>
              <Link to="/holidays" className="small link-gap">All</Link>
            </div>
            {data.upcoming_holidays?.length ? (
              <ul className="list-group list-group-flush">
                {data.upcoming_holidays.map((h, i) => (
                  <li key={i} className="list-group-item px-0 d-flex align-items-center gap-2">
                    <span className="quick-ico" style={{ background: '#16a34a1a', color: '#16a34a', width: 34, height: 34 }}>
                      <i className="bi bi-calendar-heart" />
                    </span>
                    <div className="flex-grow-1">
                      <div className="small fw-semibold">{h.name}</div>
                      <div className="text-muted" style={{ fontSize: '.72rem' }}>{fmtDate(h.holiday_date)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="text-muted small mb-0">No upcoming holidays.</p>}
          </div></div>
        </div>
      </div>

      {/* Recent attendance + celebrations */}
      <div className="row g-3">
        <div className="col-lg-8">
          <div className="card stat-card h-100"><div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="fw-semibold mb-0">Recent Attendance</h6>
              <Link to="/me/history" className="small link-gap">View all <i className="bi bi-arrow-right" /></Link>
            </div>
            <div className="table-responsive">
              <table className="table gap-table table-sm">
                <thead><tr><th>Date</th><th>In</th><th>Out</th><th>Hours</th><th>Status</th></tr></thead>
                <tbody>
                  {data.recent_attendance.map((r) => (
                    <tr key={r.attendance_date}>
                      <td>{fmtDate(r.attendance_date)}</td>
                      <td>{fmtTime(r.check_in_time)}</td>
                      <td>{fmtTime(r.check_out_time)}</td>
                      <td>{fmtHours(r.working_minutes)}</td>
                      <td><span className={`badge text-bg-${statusColor(r.status)} badge-status`}>{prettyStatus(r.status)}</span></td>
                    </tr>
                  ))}
                  {data.recent_attendance.length === 0 && <tr><td colSpan={5} className="text-muted text-center py-3">No records yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div></div>
        </div>
        <div className="col-lg-4">
          <Celebrations />
        </div>
      </div>
    </>
  );
}
