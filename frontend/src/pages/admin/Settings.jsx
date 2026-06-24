import { useEffect, useState, useRef } from 'react';
import api, { apiError } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';

const LABELS = {
  company_name: 'Company Name',
  work_start_time: 'Work Start Time (HH:MM)',
  work_end_time: 'Work End Time (HH:MM)',
  late_grace_minutes: 'Late Grace (minutes)',
  half_day_minutes: 'Half-day Threshold (minutes)',
  full_day_minutes: 'Full-day Minutes',
  lates_per_deduction: 'Lates per 1-day Salary Cut',
  overtime_rate_per_hour: 'Overtime Incentive (₹ per hour)',
  overtime_min_minutes: 'Min Overtime to Count (minutes)',
  geofence_enabled: 'Geofence Enforcement (1/0)',
  mail_from: 'Mail From Address',
};

export default function Settings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState({});
  const [geofences, setGeofences] = useState([]);
  const [gf, setGf] = useState({ name: '', latitude: '', longitude: '', radius_m: 200 });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const readOnly = user.role !== 'super_admin';

  // Leaflet picker refs
  const mapEl = useRef(null);
  const mapObj = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);
  const gfRef = useRef(gf);
  gfRef.current = gf;

  const loadGf = () => api.get('/geofences').then((r) => setGeofences(r.data.data)).catch(() => {});
  useEffect(() => {
    api.get('/settings').then((r) => setSettings(r.data.data)).catch((e) => setError(apiError(e)));
    loadGf();
  }, []);

  // Init the click-to-pick map once.
  useEffect(() => {
    const L = window.L;
    if (!L || mapObj.current || !mapEl.current) return;
    mapObj.current = L.map(mapEl.current).setView([12.9716, 77.5946], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 })
      .addTo(mapObj.current);
    mapObj.current.on('click', (e) => {
      const { lat, lng } = e.latlng;
      setGf((g) => ({ ...g, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }));
      drawPin(lat, lng, Number(gfRef.current.radius_m) || 200);
    });
  }, []);

  const drawPin = (lat, lng, radius) => {
    const L = window.L;
    if (!L || !mapObj.current) return;
    if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
    else markerRef.current = L.marker([lat, lng]).addTo(mapObj.current);
    if (circleRef.current) { circleRef.current.setLatLng([lat, lng]); circleRef.current.setRadius(radius); }
    else circleRef.current = L.circle([lat, lng], { radius, color: '#6366f1', fillOpacity: 0.12 }).addTo(mapObj.current);
  };

  // Keep the circle radius in sync with the form.
  useEffect(() => {
    if (circleRef.current && gf.radius_m) circleRef.current.setRadius(Number(gf.radius_m) || 0);
  }, [gf.radius_m]);

  const useMyLocation = () => {
    navigator.geolocation?.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      setGf((g) => ({ ...g, latitude: latitude.toFixed(6), longitude: longitude.toFixed(6) }));
      mapObj.current?.setView([latitude, longitude], 16);
      drawPin(latitude, longitude, Number(gfRef.current.radius_m) || 200);
    });
  };

  const save = async (e) => {
    e.preventDefault();
    setMsg(''); setError('');
    try {
      await api.put('/settings', settings);
      setMsg('Settings saved.');
    } catch (err) { setError(apiError(err)); }
  };

  const addGf = async (e) => {
    e.preventDefault();
    try {
      await api.post('/geofences', gf);
      setGf({ name: '', latitude: '', longitude: '', radius_m: 200 });
      if (markerRef.current) { mapObj.current?.removeLayer(markerRef.current); markerRef.current = null; }
      if (circleRef.current) { mapObj.current?.removeLayer(circleRef.current); circleRef.current = null; }
      loadGf();
    } catch (err) { alert(apiError(err)); }
  };

  const delGf = async (id) => { await api.delete(`/geofences/${id}`); loadGf(); };

  return (
    <>
      <div className="page-head">
        <div><h4 className="fw-bold">Settings</h4><div className="sub">System configuration &amp; geofences</div></div>
      </div>
      {msg && <div className="alert alert-success">{msg}</div>}
      {error && <div className="alert alert-danger">{error}</div>}
      {readOnly && <div className="alert alert-info">Only a Super Admin can change settings.</div>}

      <div className="row g-3">
        <div className="col-lg-6">
          <div className="card stat-card"><div className="card-body">
            <h6 className="fw-semibold mb-3">System Configuration</h6>
            <form onSubmit={save}>
              {Object.keys(LABELS).map((key) => (
                <div className="mb-2" key={key}>
                  <label className="form-label small fw-semibold">{LABELS[key]}</label>
                  <input className="form-control" disabled={readOnly} value={settings[key] ?? ''}
                    onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.value }))} />
                </div>
              ))}
              {!readOnly && <button className="btn btn-gap mt-2">Save Settings</button>}
            </form>
          </div></div>
        </div>

        <div className="col-lg-6">
          <div className="card stat-card"><div className="card-body">
            <h6 className="fw-semibold mb-1">Geofences</h6>
            <p className="text-muted small mb-2"><i className="bi bi-hand-index me-1" />Click on the map to drop the site centre, then set a radius.</p>
            <div ref={mapEl} style={{ height: 240, borderRadius: '0.7rem' }} className="mb-2 border" />
            <form onSubmit={addGf} className="row g-2 mb-3">
              <div className="col-12"><input className="form-control" placeholder="Site name" value={gf.name}
                onChange={(e) => setGf({ ...gf, name: e.target.value })} required /></div>
              <div className="col-4"><input className="form-control" placeholder="Lat" value={gf.latitude}
                onChange={(e) => setGf({ ...gf, latitude: e.target.value })} required /></div>
              <div className="col-4"><input className="form-control" placeholder="Lng" value={gf.longitude}
                onChange={(e) => setGf({ ...gf, longitude: e.target.value })} required /></div>
              <div className="col-4"><input className="form-control" placeholder="Radius m" value={gf.radius_m}
                onChange={(e) => setGf({ ...gf, radius_m: e.target.value })} /></div>
              <div className="col-12 d-flex gap-2">
                <button className="btn btn-outline-primary btn-sm">Add Geofence</button>
                <button type="button" className="btn btn-light btn-sm" onClick={useMyLocation}>
                  <i className="bi bi-crosshair me-1" />Use my location
                </button>
              </div>
            </form>
            <ul className="list-group">
              {geofences.map((g) => (
                <li key={g.id} className="list-group-item d-flex justify-content-between align-items-center">
                  <span>{g.name} <small className="text-muted">({g.latitude}, {g.longitude}) · {g.radius_m}m</small></span>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => delGf(g.id)}><i className="bi bi-trash" /></button>
                </li>
              ))}
              {geofences.length === 0 && <li className="list-group-item text-muted small">No geofences. Geofencing is optional.</li>}
            </ul>
          </div></div>
        </div>
      </div>
    </>
  );
}
