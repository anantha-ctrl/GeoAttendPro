import { useState } from 'react';
import { API_BASE } from '../../api/client.js';

const REPORTS = [
  { key: 'daily', label: 'Daily Attendance', fields: ['date'] },
  { key: 'monthly', label: 'Monthly Attendance', fields: ['year', 'month'] },
  { key: 'employee', label: 'Employee-wise', fields: ['user_id', 'from', 'to'] },
  { key: 'department', label: 'Department-wise', fields: ['date'] },
  { key: 'late', label: 'Late Attendance', fields: ['from', 'to'] },
  { key: 'leave', label: 'Leave Report', fields: ['from', 'to', 'status'] },
];

export default function Reports() {
  const [type, setType] = useState('daily');
  const [params, setParams] = useState({ date: new Date().toISOString().slice(0, 10) });
  const def = REPORTS.find((r) => r.key === type);
  const token = localStorage.getItem('gap_token');

  // Report GETs are auth-protected, so we fetch with the Bearer header:
  //  - CSV  -> download as a Blob
  //  - HTML -> open the print-friendly view in a new tab
  const download = async (format) => {
    const q = new URLSearchParams({ ...params, format }).toString();
    const res = await fetch(`${API_BASE}/reports/${type}?${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (format === 'csv') {
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${type}-report.csv`;
      a.click();
    } else {
      const html = await res.text();
      const w = window.open('', '_blank');
      w.document.write(html);
      w.document.close();
    }
  };

  // Real PDF export via jsPDF + AutoTable (fetches JSON, renders a table).
  const exportPdf = async () => {
    const jsPDFCtor = window.jspdf?.jsPDF;
    if (!jsPDFCtor) { alert('PDF library still loading — try again in a moment.'); return; }
    const q = new URLSearchParams({ ...params, format: 'json' }).toString();
    const res = await fetch(`${API_BASE}/reports/${type}?${q}`, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    const { title, headers, matrix } = json.data || {};
    const body = (matrix || []).map((row) => row.map((c) => (c === null || c === undefined ? '' : String(c))));
    const doc = new jsPDFCtor({ orientation: headers.length > 6 ? 'landscape' : 'portrait' });
    doc.setFontSize(14); doc.text(title || 'Report', 14, 16);
    doc.setFontSize(9); doc.setTextColor(120);
    doc.text(`CloudHawk · Generated ${new Date().toLocaleString()}`, 14, 22);
    doc.autoTable({
      head: [headers], body, startY: 27, styles: { fontSize: 8 },
      headStyles: { fillColor: [79, 70, 229] }, alternateRowStyles: { fillColor: [245, 247, 250] },
    });
    doc.save(`${type}-report.pdf`);
  };

  const set = (k) => (e) => setParams((p) => ({ ...p, [k]: e.target.value }));

  return (
    <>
      <div className="page-head">
        <div><h4 className="fw-bold">Reports</h4><div className="sub">Export attendance &amp; leave data</div></div>
      </div>
      <div className="card stat-card"><div className="card-body">
        <div className="row g-3 align-items-end">
          <div className="col-md-3">
            <label className="form-label small fw-semibold">Report Type</label>
            <select className="form-select" value={type}
              onChange={(e) => { setType(e.target.value); setParams({}); }}>
              {REPORTS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </div>
          {def.fields.includes('date') && (
            <div className="col-md-3"><label className="form-label small fw-semibold">Date</label>
              <input type="date" className="form-control" onChange={set('date')} value={params.date || ''} /></div>
          )}
          {def.fields.includes('year') && (
            <div className="col-md-2"><label className="form-label small fw-semibold">Year</label>
              <input type="number" className="form-control" placeholder="2026" onChange={set('year')} value={params.year || ''} /></div>
          )}
          {def.fields.includes('month') && (
            <div className="col-md-2"><label className="form-label small fw-semibold">Month</label>
              <input type="number" min="1" max="12" className="form-control" onChange={set('month')} value={params.month || ''} /></div>
          )}
          {def.fields.includes('user_id') && (
            <div className="col-md-2"><label className="form-label small fw-semibold">Employee ID</label>
              <input type="number" className="form-control" onChange={set('user_id')} value={params.user_id || ''} /></div>
          )}
          {def.fields.includes('from') && (
            <div className="col-md-2"><label className="form-label small fw-semibold">From</label>
              <input type="date" className="form-control" onChange={set('from')} value={params.from || ''} /></div>
          )}
          {def.fields.includes('to') && (
            <div className="col-md-2"><label className="form-label small fw-semibold">To</label>
              <input type="date" className="form-control" onChange={set('to')} value={params.to || ''} /></div>
          )}
          {def.fields.includes('status') && (
            <div className="col-md-2"><label className="form-label small fw-semibold">Status</label>
              <select className="form-select" onChange={set('status')} value={params.status || ''}>
                <option value="">All</option><option value="pending">Pending</option>
                <option value="approved">Approved</option><option value="rejected">Rejected</option>
              </select></div>
          )}
        </div>
        <hr />
        <div className="d-flex gap-2">
          <button className="btn btn-outline-success" onClick={() => download('csv')}>
            <i className="bi bi-file-earmark-excel me-1" />Export Excel (CSV)
          </button>
          <button className="btn btn-danger" onClick={exportPdf}>
            <i className="bi bi-file-earmark-pdf me-1" />Export PDF
          </button>
          <button className="btn btn-outline-secondary" onClick={() => download('html')}>
            <i className="bi bi-printer me-1" />Print View
          </button>
        </div>
      </div></div>
    </>
  );
}
