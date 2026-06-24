import { useEffect, useRef, useState, useCallback } from 'react';
import api, { API_BASE } from '../../api/client.js';
import { fmtTime, prettyStatus } from '../../utils/format.js';

export default function LiveMap() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [locations, setLocations] = useState([]);
  const mapRef = useRef(null);
  const mapObj = useRef(null);
  const layerRef = useRef(null);

  const load = useCallback(() => {
    api.get('/attendance/locations', { params: { date } })
      .then((r) => setLocations(r.data.data.locations))
      .catch(() => {});
  }, [date]);

  // initial + auto-refresh (live)
  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  // init map once
  useEffect(() => {
    const L = window.L;
    if (!L || mapObj.current) return;
    mapObj.current = L.map(mapRef.current).setView([12.9716, 77.5946], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 19,
    }).addTo(mapObj.current);
    layerRef.current = L.layerGroup().addTo(mapObj.current);
  }, []);

  // render markers when data changes
  useEffect(() => {
    const L = window.L;
    if (!L || !mapObj.current || !layerRef.current) return;
    layerRef.current.clearLayers();
    const bounds = [];
    locations.forEach((p) => {
      const lat = parseFloat(p.lat), lng = parseFloat(p.lng);
      if (Number.isNaN(lat) || Number.isNaN(lng)) return;
      bounds.push([lat, lng]);
      const color = p.is_late ? '#f59e0b' : '#10b981';
      const marker = L.circleMarker([lat, lng], {
        radius: 9, color: '#fff', weight: 2, fillColor: color, fillOpacity: 0.9,
      });
      const selfie = p.check_in_selfie
        ? `<img src="${API_BASE}${p.check_in_selfie}" style="width:60px;height:60px;object-fit:cover;border-radius:8px;margin-top:6px" />` : '';
      marker.bindPopup(
        `<b>${p.full_name}</b> (${p.employee_code})<br/>
         ${p.department_name || '—'}<br/>
         <span>Check-in: ${fmtTime(p.check_in_time)}</span><br/>
         <span>Status: ${prettyStatus(p.status)}${p.is_late ? ' (late)' : ''}</span><br/>${selfie}`
      );
      layerRef.current.addLayer(marker);
    });
    if (bounds.length) mapObj.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [locations]);

  return (
    <>
      <div className="page-head">
        <div><h4 className="fw-bold">Live Attendance Map</h4>
          <div className="sub">Real-time check-in locations · {locations.length} on map</div></div>
        <input type="date" className="form-control" style={{ maxWidth: 190 }}
          value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div className="card stat-card"><div className="card-body">
        <div className="d-flex gap-3 mb-2 small">
          <span><span className="d-inline-block rounded-circle me-1" style={{ width: 10, height: 10, background: '#10b981' }} /> On time</span>
          <span><span className="d-inline-block rounded-circle me-1" style={{ width: 10, height: 10, background: '#f59e0b' }} /> Late</span>
        </div>
        <div ref={mapRef} style={{ height: '70vh', width: '100%', borderRadius: '0.75rem' }} />
        {locations.length === 0 && (
          <p className="text-muted small mt-2 mb-0">No GPS check-ins for this date yet.</p>
        )}
      </div></div>
    </>
  );
}
