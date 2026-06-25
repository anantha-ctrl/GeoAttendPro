import { useEffect, useState, useCallback } from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement,
  LineElement, ArcElement, Tooltip, Legend, Filler,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import api, { apiError, API_BASE } from '../../api/client.js';
import StatCard from '../../components/StatCard.jsx';
import Celebrations from '../../components/Celebrations.jsx';
import { fmtTime, statusColor, prettyStatus } from '../../utils/format.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler);

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [acting, setActing] = useState(null);

  const load = useCallback(() => {
    api.get('/dashboard/admin')
      .then((r) => setData(r.data.data))
      .catch((e) => setErr(apiError(e, 'Failed to load dashboard.')));
  }, []);

  // Live data: initial load + auto-refresh every 30s.
  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  const decide = async (id, action) => {
    setActing(id);
    try {
      await api.patch(`/leaves/${id}/${action}`, { admin_remarks: '' });
      load();
    } catch (e) {
      alert(apiError(e));
    } finally {
      setActing(null);
    }
  };

  if (err) return <div className="alert alert-danger">{err}</div>;
  if (!data) return <div className="spinner-border text-primary" />;

  const c = data.counters;
  const sb = data.status_breakdown;

  const dailyChart = {
    labels: data.daily_trend.map((d) => d.date?.slice(5)),
    datasets: [{
      label: 'Present', data: data.daily_trend.map((d) => +d.present),
      borderColor: '#4f46e5', backgroundColor: 'rgba(79,70,229,.15)', tension: 0.35, fill: true,
    }],
  };
  const statusChart = {
    labels: ['Present', 'Late', 'Half Day', 'Leave', 'WFH', 'Absent'],
    datasets: [{
      data: [sb.present, sb.late, sb.half_day, sb.leave, sb.wfh, sb.absent],
      backgroundColor: ['#10b981', '#f59e0b', '#0ea5e9', '#64748b', '#7c3aed', '#ef4444'],
      borderWidth: 0,
    }],
  };
  const monthlyChart = {
    labels: data.monthly_trend.map((m) => MONTHS[m.month - 1]),
    datasets: [{ label: 'Present', data: data.monthly_trend.map((m) => +m.present), backgroundColor: '#4f46e5', borderRadius: 6 }],
  };
  const deptChart = {
    labels: data.department_breakdown.map((d) => d.department || '—'),
    datasets: [{
      label: 'Present', data: data.department_breakdown.map((d) => +d.present),
      backgroundColor: '#0ea5e9', borderRadius: 6,
    }],
  };

  return (
    <>
      {/* Header banner */}
      <div className="dash-hero mb-4">
        <div>
          <h4 className="fw-bold mb-1">Admin Dashboard</h4>
          <div className="small opacity-75">
            <i className="bi bi-calendar3 me-1" />{new Date().toDateString()} · Live workforce overview
          </div>
        </div>
        <i className="bi bi-graph-up-arrow dash-hero-icon" />
      </div>

      {/* Widgets */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3"><StatCard icon="people-fill" label="Total Employees" value={c.total_employees} color="#4f46e5" /></div>
        <div className="col-6 col-lg-3"><StatCard icon="check-circle-fill" label="Present Today" value={c.present_today} color="#10b981" /></div>
        <div className="col-6 col-lg-3"><StatCard icon="x-circle-fill" label="Absent Today" value={c.absent_today} color="#ef4444" /></div>
        <div className="col-6 col-lg-3"><StatCard icon="clock-fill" label="Late Today" value={c.late_today} color="#f59e0b" /></div>
        <div className="col-6 col-lg-3"><StatCard icon="box-arrow-in-right" label="Check-Ins Today" value={c.total_check_ins} color="#0ea5e9" /></div>
        <div className="col-6 col-lg-3"><StatCard icon="house-check" label="WFH Today" value={c.wfh_today} color="#7c3aed" /></div>
        <div className="col-6 col-lg-3"><StatCard icon="hourglass-split" label="Half Days" value={c.half_day_today} color="#14b8a6" /></div>
        <div className="col-6 col-lg-3"><StatCard icon="calendar-x" label="On Leave" value={c.on_leave_today} color="#64748b" /></div>
        <div className="col-6 col-lg-3"><StatCard icon="diagram-3-fill" label="Departments" value={c.total_departments} color="#6366f1" /></div>
        <div className="col-6 col-lg-3"><StatCard icon="hourglass" label="Pending Leaves" value={data.pending_leaves_count} color="#f97316" /></div>
        <div className="col-6 col-lg-3"><StatCard icon="stopwatch" label="Avg Hours Today" value={c.avg_work_hours_today} suffix="h" color="#0d9488" /></div>
        <div className="col-6 col-lg-3"><StatCard icon="graph-up" label="Attendance %" value={c.attendance_percent} suffix="%" color="#22c55e" /></div>
      </div>

      {/* Charts */}
      <div className="row g-3 mb-4">
        <div className="col-lg-8">
          <div className="card stat-card h-100"><div className="card-body">
            <h6 className="fw-semibold mb-3">Daily Attendance (last 7 days)</h6>
            <Line data={dailyChart} options={{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }} />
          </div></div>
        </div>
        <div className="col-lg-4">
          <div className="card stat-card h-100"><div className="card-body">
            <h6 className="fw-semibold mb-3">Today's Status</h6>
            <Doughnut data={statusChart} options={{ plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } } }} />
          </div></div>
        </div>
        <div className="col-lg-6">
          <div className="card stat-card h-100"><div className="card-body">
            <h6 className="fw-semibold mb-3">Monthly Attendance ({new Date().getFullYear()})</h6>
            <Bar data={monthlyChart} options={{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }} />
          </div></div>
        </div>
        <div className="col-lg-6">
          <div className="card stat-card h-100"><div className="card-body">
            <h6 className="fw-semibold mb-3">Present by Department (today)</h6>
            <Bar data={deptChart} options={{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }} />
          </div></div>
        </div>
      </div>

      {/* Activity lists — equal-height cards so the bottoms align */}
      <div className="row g-3 align-items-stretch">
        {/* Recent check-ins */}
        <div className="col-md-6 col-xl-3">
          <div className="card stat-card h-100"><div className="card-body">
            <h6 className="fw-semibold mb-3"><i className="bi bi-clock-history me-1" />Recent Check-Ins</h6>
            {data.recent_check_ins.length === 0 ? (
              <p className="text-muted small mb-0">No check-ins yet.</p>
            ) : (
              <ul className="list-group list-group-flush">
                {data.recent_check_ins.slice(0, 3).map((r, i) => (
                  <li key={i} className="list-group-item d-flex align-items-center gap-2 px-0">
                    {r.check_in_selfie
                      ? <img src={`${API_BASE}${r.check_in_selfie}`} alt="" className="flex-shrink-0" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: '50%' }} />
                      : <span className="rounded-circle bg-light d-inline-grid flex-shrink-0" style={{ width: 36, height: 36, placeItems: 'center' }}><i className="bi bi-person" /></span>}
                    <div className="flex-grow-1 text-truncate">
                      <div className="small fw-semibold text-truncate">{r.full_name}</div>
                      <div className="text-muted text-truncate" style={{ fontSize: '.72rem' }}>{r.employee_code} · {fmtTime(r.check_in_time)}</div>
                    </div>
                    <span className={`badge text-bg-${statusColor(r.status)} badge-status flex-shrink-0 text-center`}
                      style={{ minWidth: 72 }}>{prettyStatus(r.status)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div></div>
        </div>

        {/* Pending leave requests with approve/reject */}
        <div className="col-md-6 col-xl-3">
          <div className="card stat-card h-100"><div className="card-body">
            <h6 className="fw-semibold mb-3"><i className="bi bi-calendar-check me-1" />Pending Leave Requests</h6>
            {data.pending_leaves.length === 0 ? (
              <p className="text-muted small mb-0">No pending requests. 🎉</p>
            ) : data.pending_leaves.map((l) => (
              <div key={l.id} className="border rounded p-2 mb-2">
                <div className="d-flex justify-content-between">
                  <span className="small fw-semibold">{l.full_name}</span>
                  <span className="badge text-bg-light">{l.total_days}d</span>
                </div>
                <div className="text-muted" style={{ fontSize: '.72rem' }}>
                  {l.leave_type_name || 'Leave'} · {l.from_date} → {l.to_date}
                </div>
                <div className="small text-truncate" title={l.reason}>{l.reason}</div>
                <div className="d-flex gap-1 mt-1">
                  <button className="btn btn-sm btn-success py-0 flex-grow-1" disabled={acting === l.id}
                    onClick={() => decide(l.id, 'approve')}><i className="bi bi-check-lg" /> Approve</button>
                  <button className="btn btn-sm btn-outline-danger py-0 flex-grow-1" disabled={acting === l.id}
                    onClick={() => decide(l.id, 'reject')}><i className="bi bi-x-lg" /> Reject</button>
                </div>
              </div>
            ))}
          </div></div>
        </div>

        {/* Late today */}
        <div className="col-md-6 col-xl-3">
          <div className="card stat-card h-100"><div className="card-body">
            <h6 className="fw-semibold mb-3"><i className="bi bi-exclamation-triangle me-1 text-warning" />Late Today</h6>
            {data.late_today.length === 0 ? (
              <p className="text-muted small mb-0">No late arrivals.</p>
            ) : (
              <ul className="list-group list-group-flush">
                {data.late_today.map((r, i) => (
                  <li key={i} className="list-group-item px-0 d-flex justify-content-between">
                    <span className="small">{r.full_name}</span>
                    <span className="badge text-bg-warning">{fmtTime(r.check_in_time)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div></div>
        </div>

        {/* Celebrations */}
        <div className="col-md-6 col-xl-3">
          <Celebrations />
        </div>
      </div>
    </>
  );
}
