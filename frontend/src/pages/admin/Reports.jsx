import { useState, useEffect, useMemo, useCallback } from 'react';
import api, { API_BASE } from '../../api/client.js';

const REPORTS = [
  { key: 'daily', label: 'Daily Attendance', fields: ['date'] },
  { key: 'monthly', label: 'Monthly Attendance', fields: ['year', 'month'] },
  { key: 'employee', label: 'Employee-wise', fields: ['user_id', 'from', 'to'] },
  { key: 'department', label: 'Department-wise', fields: ['date'] },
  { key: 'late', label: 'Late Attendance', fields: ['from', 'to'] },
  { key: 'leave', label: 'Leave Report', fields: ['from', 'to', 'status'] },
];

// status value -> chip/badge style
const STATUS_META = {
  present: { label: 'Present', color: 'success' },
  late: { label: 'Late', color: 'warning' },
  half_day: { label: 'Half Day', color: 'info' },
  absent: { label: 'Absent', color: 'danger' },
  leave: { label: 'Leave', color: 'secondary' },
  wfh: { label: 'WFH', color: 'primary' },
  approved: { label: 'Approved', color: 'success' },
  pending: { label: 'Pending', color: 'warning' },
  rejected: { label: 'Rejected', color: 'danger' },
};
const PREVIEW_LIMIT = 200;

export default function Reports() {
  const [type, setType] = useState('daily');
  const [params, setParams] = useState({ date: new Date().toISOString().slice(0, 10) });
  const [report, setReport] = useState(null);   // { title, headers, matrix, rows }
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const def = REPORTS.find((r) => r.key === type);
  const token = localStorage.getItem('gap_token');

  // Employee dropdown options.
  useEffect(() => {
    api.get('/lookups').then((r) => setEmployees(r.data.data.managers || [])).catch(() => {});
  }, []);

  // Live preview — refetch JSON whenever the report type or filters change.
  const loadPreview = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/reports/${type}`, { params: { ...params, format: 'json' } });
      setReport(r.data.data);
    } catch { setReport(null); }
    finally { setLoading(false); }
  }, [type, params]);
  useEffect(() => { loadPreview(); }, [loadPreview]);

  // Summary counts: from per-row status, or from monthly aggregate columns.
  const summary = useMemo(() => {
    const rows = report?.rows || [];
    const c = {};
    for (const r of rows) {
      if (r.status) { c[r.status] = (c[r.status] || 0) + 1; continue; }
      if (r.present_days != null) c.present = (c.present || 0) + Number(r.present_days);
      if (r.half_days != null) c.half_day = (c.half_day || 0) + Number(r.half_days);
      if (r.leave_days != null) c.leave = (c.leave || 0) + Number(r.leave_days);
      if (r.late_count != null) c.late = (c.late || 0) + Number(r.late_count);
    }
    return c;
  }, [report]);
  const summaryKeys = Object.keys(summary);
  const statusCol = (report?.headers || []).findIndex((h) => String(h).toLowerCase() === 'status');

  // ---- Exports (auth-protected GETs with Bearer header) ----
  const download = async (format) => {
    const q = new URLSearchParams({ ...params, format }).toString();
    const url = `${API_BASE}/reports/${type}?${q}`;
    if (format === 'csv') {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${type}-report.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      return;
    }
    // Print view — open the tab synchronously (inside the click) so it isn't blocked.
    const w = window.open('', '_blank');
    if (w) w.document.write('<!doctype html><title>Report</title><p style="font:14px sans-serif;padding:24px">Loading report…</p>');
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      if (w) { w.document.open(); w.document.write(html); w.document.close(); }
      else {
        const blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
        const a = document.createElement('a');
        a.href = blobUrl; a.target = '_blank'; a.rel = 'noopener'; a.click();
      }
    } catch (e) {
      if (w) w.document.body.innerHTML = `<p style="color:#c00;font:14px sans-serif;padding:24px">Failed to load report (${e.message}).</p>`;
      else alert('Could not open the print view — allow pop-ups for this site and try again.');
    }
  };

  // PDF via jsPDF + AutoTable — reuse the already-loaded preview data.
  const exportPdf = async () => {
    const jsPDFCtor = window.jspdf?.jsPDF;
    if (!jsPDFCtor) { alert('PDF library still loading — try again in a moment.'); return; }
    let data = report;
    if (!data) {
      const r = await api.get(`/reports/${type}`, { params: { ...params, format: 'json' } });
      data = r.data.data;
    }
    const { title, headers, matrix } = data || {};
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

  const rowCount = report?.matrix?.length || 0;

  return (
    <>
      <div className="page-head">
        <div><h4 className="fw-bold">Reports &amp; Analytics</h4><div className="sub">Live attendance &amp; leave insights</div></div>
      </div>

      {/* Filters + exports */}
      <div className="card stat-card mb-3"><div className="card-body">
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
              <select className="form-select" onChange={set('month')} value={params.month || ''}>
                <option value="">All</option>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{new Date(2000, i, 1).toLocaleString('en', { month: 'long' })}</option>
                ))}
              </select></div>
          )}
          {def.fields.includes('user_id') && (
            <div className="col-md-3"><label className="form-label small fw-semibold">Employee</label>
              <select className="form-select" onChange={set('user_id')} value={params.user_id || ''}>
                <option value="">Select employee…</option>
                {employees.map((m) => <option key={m.id} value={m.id}>{m.full_name} ({m.employee_code})</option>)}
              </select></div>
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
        <div className="d-flex gap-2 flex-wrap">
          <button className="btn btn-outline-success" onClick={() => download('csv')} disabled={!rowCount}>
            <i className="bi bi-file-earmark-excel me-1" />Export Excel (CSV)
          </button>
          <button className="btn btn-danger" onClick={exportPdf} disabled={!rowCount}>
            <i className="bi bi-file-earmark-pdf me-1" />Export PDF
          </button>
          <button className="btn btn-outline-secondary" onClick={() => download('html')} disabled={!rowCount}>
            <i className="bi bi-printer me-1" />Print View
          </button>
        </div>
      </div></div>

      {/* Summary */}
      {summaryKeys.length > 0 && (
        <div className="card stat-card mb-3"><div className="card-body d-flex flex-wrap align-items-center gap-2">
          <span className="fw-semibold me-2"><i className="bi bi-bar-chart-line me-1 text-primary" />Summary</span>
          {summaryKeys.map((k) => {
            const meta = STATUS_META[k] || { label: k, color: 'secondary' };
            return <span key={k} className={`badge text-bg-${meta.color} badge-status`}>{summary[k]} · {meta.label}</span>;
          })}
        </div></div>
      )}

      {/* Report preview */}
      <div className="card stat-card"><div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h6 className="fw-semibold mb-0"><i className="bi bi-table me-1 text-primary" />Report Preview</h6>
          <span className="badge text-bg-light border">{loading ? 'Loading…' : `${rowCount} record${rowCount === 1 ? '' : 's'} found`}</span>
        </div>
        {loading ? (
          <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
        ) : !report || rowCount === 0 ? (
          <div className="text-center py-5 text-muted">
            <i className="bi bi-inbox fs-1 opacity-50 d-block mb-2" />No data for the selected filters.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table gap-table table-hover table-sm align-middle">
              <thead><tr>{report.headers.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
              <tbody>
                {report.matrix.slice(0, PREVIEW_LIMIT).map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => {
                      if (ci === statusCol && cell) {
                        const meta = STATUS_META[String(cell).toLowerCase()];
                        return <td key={ci}>{meta
                          ? <span className={`badge text-bg-${meta.color} badge-status`}>{meta.label}</span>
                          : cell}</td>;
                      }
                      return <td key={ci}>{cell === null || cell === undefined || cell === '' ? '—' : String(cell)}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {rowCount > PREVIEW_LIMIT && (
              <div className="text-muted small text-center mt-2">
                Showing first {PREVIEW_LIMIT} of {rowCount}. Export for the full report.
              </div>
            )}
          </div>
        )}
      </div></div>
    </>
  );
}
