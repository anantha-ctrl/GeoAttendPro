import { useEffect, useState } from 'react';
import api, { apiError } from '../../api/client.js';
import { fmtDate } from '../../utils/format.js';

const weekday = (d) => new Date(d).toLocaleDateString(undefined, { weekday: 'long' });

export default function HolidayList() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/holidays').then((r) => setItems(r.data.data)).catch((e) => setError(apiError(e)));
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = items.filter((h) => h.holiday_date >= today || Number(h.recurring));

  return (
    <>
      <div className="page-head">
        <div><h4 className="fw-bold">Holidays</h4><div className="sub">Company holiday calendar</div></div>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card stat-card"><div className="card-body p-0">
        <table className="table gap-table table-hover mb-0">
          <thead><tr><th>Holiday</th><th>Date</th><th>Day</th><th>Type</th></tr></thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={4} className="text-center text-muted py-5">
                <i className="bi bi-calendar-event fs-3 d-block mb-2 opacity-50" />No holidays listed.</td></tr>
            ) : items.map((h) => (
              <tr key={h.id} className={h.holiday_date === today ? 'table-warning' : ''}>
                <td className="fw-semibold">{h.name}</td>
                <td>{fmtDate(h.holiday_date)}</td>
                <td>{weekday(h.holiday_date)}</td>
                <td>{Number(h.recurring)
                  ? <span className="badge text-bg-info">Yearly</span>
                  : <span className="badge text-bg-light">One-time</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div></div>
      <p className="text-muted small mt-2">{upcoming.length} upcoming / recurring holiday(s).</p>
    </>
  );
}
