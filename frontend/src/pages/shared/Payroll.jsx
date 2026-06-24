import { useEffect, useState, useCallback } from 'react';
import api, { apiError } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';

const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monthLabel = (m) => new Date(`${m}-01T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
const shiftMonth = (m, delta) => {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export default function Payroll() {
  const { isAdmin } = useAuth();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState({ payroll: [], totals: {} });
  const [error, setError] = useState('');
  const [slip, setSlip] = useState(null); // selected payslip row

  const load = useCallback(() => {
    api.get('/payroll', { params: { month } })
      .then((r) => setData(r.data.data)).catch((e) => setError(apiError(e)));
  }, [month]);
  useEffect(() => { load(); }, [load]);

  // Employees see only their own payslip.
  useEffect(() => {
    if (!isAdmin && data.payroll?.length === 1) setSlip(data.payroll[0]);
  }, [isAdmin, data]);

  const Payslip = ({ p }) => (
    <div className="card stat-card payslip"><div className="card-body">
      <div className="d-flex justify-content-between align-items-start mb-3">
        <div>
          <h5 className="fw-bold mb-0">Payslip</h5>
          <div className="text-muted small">{monthLabel(month)}</div>
        </div>
        <div className="text-end">
          <div className="fw-bold">{p.full_name}</div>
          <div className="text-muted small">{p.employee_code} · {p.department_name || '—'}</div>
        </div>
      </div>
      <div className="row g-2 mb-3">
        {[
          ['Working days', p.working_days], ['Present', p.present_days],
          ['Paid leave', p.leave_days], ['Half days', p.half_days],
          ['Absent (LOP)', p.absent_days], ['Late count', p.late_count],
          ['Overtime', `${p.overtime_hours || 0}h`],
        ].map(([k, v]) => (
          <div className="col-6 col-md-4" key={k}>
            <div className="border rounded p-2 text-center">
              <div className="fs-5 fw-bold">{v}</div><div className="text-muted small">{k}</div>
            </div>
          </div>
        ))}
      </div>
      <table className="table table-sm">
        <tbody>
          <tr><td>Monthly Salary (Gross)</td><td className="text-end fw-semibold">{money(p.monthly_salary)}</td></tr>
          <tr><td>Per-day rate</td><td className="text-end">{money(p.per_day_rate)}</td></tr>
          {p.absent_deduction > 0 && (
            <tr className="text-danger"><td>Absent — {p.absent_days} day{p.absent_days === 1 ? '' : 's'}</td>
              <td className="text-end">− {money(p.absent_deduction)}</td></tr>
          )}
          {p.half_day_deduction > 0 && (
            <tr className="text-danger"><td>Half-days — {p.half_days} (½ each)</td>
              <td className="text-end">− {money(p.half_day_deduction)}</td></tr>
          )}
          {p.late_deduction > 0 && (
            <tr className="text-danger"><td>Late penalty — {p.late_count} lates → {p.late_lop_days} day</td>
              <td className="text-end">− {money(p.late_deduction)}</td></tr>
          )}
          <tr><td className="fw-semibold">Total Deductions ({p.lop_days} LOP day{p.lop_days === 1 ? '' : 's'})</td>
            <td className="text-end fw-semibold text-danger">− {money(p.deductions)}</td></tr>
          {p.overtime_incentive > 0 && (
            <tr className="text-success"><td>Overtime incentive — {p.overtime_hours}h × {money(p.overtime_rate_per_hour)}/h ({p.overtime_days} day{p.overtime_days === 1 ? '' : 's'})</td>
              <td className="text-end">+ {money(p.overtime_incentive)}</td></tr>
          )}
          <tr className="table-light"><td className="fw-bold">Net Pay</td>
            <td className="text-end fw-bold fs-5 text-success">{money(p.net_pay)}</td></tr>
        </tbody>
      </table>
      <button className="btn btn-outline-secondary btn-sm" onClick={() => window.print()}>
        <i className="bi bi-printer me-1" />Print / Save PDF
      </button>
    </div></div>
  );

  return (
    <>
      <div className="page-head">
        <div><h4 className="fw-bold">{isAdmin ? 'Payroll' : 'My Payslip'}</h4>
          <div className="sub">Attendance-based salary for {monthLabel(month)}</div></div>
        <div className="btn-group">
          <button className="btn btn-outline-secondary" onClick={() => setMonth((m) => shiftMonth(m, -1))}><i className="bi bi-chevron-left" /></button>
          <button className="btn btn-light fw-semibold" style={{ minWidth: 160 }}>{monthLabel(month)}</button>
          <button className="btn btn-outline-secondary" onClick={() => setMonth((m) => shiftMonth(m, 1))}><i className="bi bi-chevron-right" /></button>
        </div>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}

      {!isAdmin ? (
        data.payroll?.[0] ? <Payslip p={data.payroll[0]} /> : <div className="text-muted">No payroll data.</div>
      ) : (
        <>
          <div className="row g-3 mb-3">
            <div className="col-md-4"><div className="card stat-card"><div className="card-body">
              <div className="text-muted small">Employees</div><div className="fs-3 fw-bold">{data.totals?.count ?? 0}</div></div></div></div>
            <div className="col-md-4"><div className="card stat-card"><div className="card-body">
              <div className="text-muted small">Total Gross</div><div className="fs-3 fw-bold">{money(data.totals?.gross)}</div></div></div></div>
            <div className="col-md-4"><div className="card stat-card"><div className="card-body">
              <div className="text-muted small">Total Net Payable</div><div className="fs-3 fw-bold text-success">{money(data.totals?.net)}</div></div></div></div>
          </div>

          <div className="row g-3">
            <div className={slip ? 'col-lg-7' : 'col-12'}>
              <div className="card stat-card"><div className="card-body p-0">
                <table className="table gap-table table-hover align-middle mb-0">
                  <thead><tr><th>Employee</th><th>Salary</th><th>Present</th><th>LOP</th><th>Net Pay</th><th></th></tr></thead>
                  <tbody>
                    {data.payroll.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-4 text-muted">No employees.</td></tr>
                    ) : data.payroll.map((p) => (
                      <tr key={p.user_id} className={slip?.user_id === p.user_id ? 'table-active' : ''}>
                        <td>{p.full_name}<div className="small text-muted">{p.employee_code}</div></td>
                        <td>{money(p.monthly_salary)}</td>
                        <td>{p.present_days}</td>
                        <td>{p.lop_days}</td>
                        <td className="fw-semibold text-success">{money(p.net_pay)}</td>
                        <td className="text-end">
                          <button className="btn btn-sm btn-outline-primary" onClick={() => setSlip(p)}>
                            <i className="bi bi-receipt me-1" />Payslip
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div></div>
            </div>
            {slip && <div className="col-lg-5"><Payslip p={slip} /></div>}
          </div>
        </>
      )}
    </>
  );
}
