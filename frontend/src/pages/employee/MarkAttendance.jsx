import { useEffect, useRef, useState, useCallback } from 'react';
import api, { apiError } from '../../api/client.js';
import { getPosition, fmtTime, fmtHours } from '../../utils/format.js';
import { ensureFaceReady, loadFaceModels, getDescriptor, distance, loadImage, faceLibReady, MATCH_THRESHOLD } from '../../utils/face.js';

export default function MarkAttendance() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  // Leaflet map (lets the user verify / drag-correct the captured GPS point).
  const mapEl = useRef(null);
  const mapObj = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);
  const [today, setToday] = useState(null);
  const [coords, setCoords] = useState(null);
  const [selfie, setSelfie] = useState(null);
  const [workNote, setWorkNote] = useState('');
  const [cameraOn, setCameraOn] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [busy, setBusy] = useState(false);
  // Face verification state.
  const enrolledRef = useRef(null);            // enrolled descriptor (array) or null
  const [faceState, setFaceState] = useState('none'); // none|checking|verified|mismatch|nodetect
  const [libReady, setLibReady] = useState(false);
  const [libLoading, setLibLoading] = useState(true);
  const [hasFaceEnrolled, setHasFaceEnrolled] = useState(false);

  const loadToday = useCallback(() => {
    api.get('/attendance/today').then((r) => setToday(r.data.data)).catch(() => {});
  }, []);
  useEffect(() => { loadToday(); }, [loadToday]);

  // Fetch enrolled face descriptor + warm up models.
  useEffect(() => {
    let cancelled = false;
    api.get('/profile').then((r) => {
      const raw = r.data.data.face_descriptor;
      if (raw) {
        try {
          enrolledRef.current = JSON.parse(raw);
          if (!cancelled) setHasFaceEnrolled(true);
        } catch {
          enrolledRef.current = null;
        }
      }
    }).catch(() => {});

    (async () => {
      setLibLoading(true);
      const ok = await ensureFaceReady();
      if (!cancelled) {
        setLibReady(ok);
        setLibLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Clean up the camera stream on unmount.
  useEffect(() => () => stopCamera(), []);

  // Init the Leaflet map once.
  useEffect(() => {
    const L = window.L;
    if (!L || mapObj.current || !mapEl.current) return;
    mapObj.current = L.map(mapEl.current).setView([12.9716, 77.5946], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 })
      .addTo(mapObj.current);
    // Click anywhere to set the precise spot.
    mapObj.current.on('click', (e) => setMarker(e.latlng.lat, e.latlng.lng, null, true));
  }, []);

  // Draw office geofences from /attendance/today (employee-accessible) once loaded.
  const fenceLayer = useRef(null);
  useEffect(() => {
    const L = window.L;
    if (!L || !mapObj.current || !today?.geofences) return;
    if (fenceLayer.current) { mapObj.current.removeLayer(fenceLayer.current); }
    fenceLayer.current = L.layerGroup().addTo(mapObj.current);
    let centered = false;
    today.geofences.forEach((g) => {
      const lat = Number(g.latitude), lng = Number(g.longitude);
      L.circle([lat, lng], { radius: Number(g.radius_m) || 100, color: '#16a34a', fillOpacity: 0.08 })
        .addTo(fenceLayer.current).bindTooltip(g.name);
      if (!centered && !coords) { mapObj.current.setView([lat, lng], 17); centered = true; }
    });
  }, [today?.geofences]); // eslint-disable-line react-hooks/exhaustive-deps

  // Place/move the draggable marker + accuracy circle and recentre.
  const setMarker = (lat, lng, accuracy, manual = false) => {
    const L = window.L;
    setCoords({ latitude: lat, longitude: lng, accuracy: accuracy ?? 0, manual });
    if (!L || !mapObj.current) return;
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(mapObj.current);
      markerRef.current.on('dragend', () => {
        const p = markerRef.current.getLatLng();
        setMarker(p.lat, p.lng, null, true); // dragged = manually corrected
      });
    }
    // Accuracy circle only meaningful for a real GPS fix.
    if (circleRef.current) { mapObj.current.removeLayer(circleRef.current); circleRef.current = null; }
    if (!manual && accuracy) {
      circleRef.current = L.circle([lat, lng], { radius: accuracy, color: '#6366f1', fillOpacity: 0.08 }).addTo(mapObj.current);
    }
    mapObj.current.setView([lat, lng], 17);
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  };

  const startCamera = async () => {
    setStatus({ type: '', msg: '' });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch {
      setStatus({ type: 'danger', msg: 'Camera access denied. Please allow camera permission.' });
    }
  };

  const capture = async () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 480;
    canvas.height = video.videoHeight || 360;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setSelfie(dataUrl);
    stopCamera();
    verifyFace(dataUrl);
  };

  // Compare the captured selfie against the enrolled face descriptor.
  const verifyFace = async (dataUrl) => {
    if (!enrolledRef.current) {
      setFaceState('none'); // no enrollment → skip
      return;
    }
    setFaceState('checking');
    
    // Ensure Face AI models are ready
    const ok = await ensureFaceReady();
    if (!ok) {
      setFaceState('none');
      setStatus({ type: 'warning', msg: 'Face AI models could not load. Proceeding without face verification.' });
      return;
    }

    try {
      const img = await loadImage(dataUrl);
      const desc = await getDescriptor(img);
      if (!desc) {
        setFaceState('nodetect');
        return;
      }
      const d = distance(enrolledRef.current, desc);
      setFaceState(d <= MATCH_THRESHOLD ? 'verified' : 'mismatch');
    } catch (e) {
      console.error('Error in verifyFace:', e);
      setFaceState('none');
    }
  };

  const retake = () => { setSelfie(null); setFaceState('none'); startCamera(); };

  const [locating, setLocating] = useState(false);
  const captureLocation = async () => {
    setStatus({ type: '', msg: '' });
    setLocating(true);
    try {
      // Refine for up to 8s, stop early once accuracy ≤ 25m.
      const pos = await getPosition({ desiredAccuracy: 25, maxWait: 8000 });
      setMarker(pos.latitude, pos.longitude, pos.accuracy, false);
      if (pos.accuracy > 100) {
        setStatus({ type: 'warning', msg: `Low GPS accuracy (±${Math.round(pos.accuracy)}m). Drag the pin on the map to your exact spot, or move near a window / enable device location.` });
      }
    } catch (e) {
      setStatus({ type: 'danger', msg: e.message });
    } finally {
      setLocating(false);
    }
  };

  const submit = async (action) => {
    if (!coords) return setStatus({ type: 'danger', msg: 'Capture your GPS location first.' });
    if (action === 'check-in' && !selfie) return setStatus({ type: 'danger', msg: 'Capture a selfie first.' });
    // Block check-in if an enrolled face clearly does not match.
    if (action === 'check-in' && faceState === 'mismatch') {
      return setStatus({ type: 'danger', msg: 'Face does not match your enrolled photo. Please retake the selfie.' });
    }
    if (action === 'check-in' && faceState === 'checking') {
      return setStatus({ type: 'warning', msg: 'Verifying your face… please wait a moment.' });
    }
    // A work summary is required before checking out.
    if (action === 'check-out' && !workNote.trim()) {
      return setStatus({ type: 'danger', msg: 'Please describe the work you did this session before checking out.' });
    }
    setBusy(true);
    setStatus({ type: '', msg: '' });
    try {
      const { data } = await api.post(`/attendance/${action}`, {
        latitude: coords.latitude, longitude: coords.longitude, selfie,
        face_verified: faceState === 'verified',
        work_note: action === 'check-out' ? workNote.trim() : undefined,
      });
      setStatus({ type: 'success', msg: data.message });
      setSelfie(null); setCoords(null); setFaceState('none'); setWorkNote('');
      // Clear the map pin/circle for the next session.
      if (markerRef.current) { mapObj.current?.removeLayer(markerRef.current); markerRef.current = null; }
      if (circleRef.current) { mapObj.current?.removeLayer(circleRef.current); circleRef.current = null; }
      loadToday();
    } catch (e) {
      setStatus({ type: 'danger', msg: apiError(e) });
    } finally {
      setBusy(false);
    }
  };

  const faceBadge = {
    checking:  { cls: 'text-bg-info',    icon: 'arrow-repeat',  text: 'Verifying face…' },
    verified:  { cls: 'text-bg-success', icon: 'patch-check',   text: 'Face verified' },
    mismatch:  { cls: 'text-bg-danger',  icon: 'patch-exclamation', text: 'Face mismatch' },
    nodetect:  { cls: 'text-bg-warning', icon: 'exclamation-triangle', text: 'No face detected — retake' },
  }[faceState];

  const canCheckIn = today?.can_checkin;
  const canCheckOut = today?.can_checkout;

  // Office-geofence rule (skipped on approved WFH days).
  const metres = (la1, lo1, la2, lo2) => {
    const R = 6371000, r = Math.PI / 180;
    const a = Math.sin((la2 - la1) * r / 2) ** 2 +
      Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin((lo2 - lo1) * r / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };
  const fences = today?.geofences || [];
  const wfh = !!today?.is_wfh_today;
  const enforced = !!today?.geofence_enforced && fences.length > 0;
  const nearest = coords && fences.length
    ? fences.map((f) => ({ f, d: metres(coords.latitude, coords.longitude, +f.latitude, +f.longitude) }))
        .sort((a, b) => a.d - b.d)[0]
    : null;
  const insideFence = nearest ? nearest.d <= Number(nearest.f.radius_m) : false;
  const locationAllowed = wfh || !enforced || insideFence;

  return (
    <>
      <div className="page-head">
        <div><h4 className="fw-bold">Mark Attendance</h4><div className="sub">GPS + live selfie verification</div></div>
      </div>

      {status.msg && <div className={`alert alert-${status.type}`}>{status.msg}</div>}

      {canCheckOut && (
        <div className="alert alert-info">
          <i className="bi bi-record-circle me-1" />You are currently checked in. Check out when you finish this session.
        </div>
      )}
      {canCheckIn && today?.sessions?.length > 0 && (
        <div className="alert alert-success">
          <i className="bi bi-check-circle me-1" />
          Session done. Total worked today: <b>{fmtHours(today.attendance?.working_minutes)}</b> across{' '}
          {today.sessions.length} session{today.sessions.length > 1 ? 's' : ''}. You can check in again.
        </div>
      )}

      <div className="row g-3">
        {/* Selfie */}
        <div className="col-lg-6">
          <div className="card stat-card h-100"><div className="card-body">
            <h6 className="fw-semibold d-flex align-items-center">
              <i className="bi bi-camera me-1" />Live Selfie Verification
              {faceBadge && (
                <span className={`badge ${faceBadge.cls} ms-auto`}>
                  <i className={`bi bi-${faceBadge.icon} me-1`} />{faceBadge.text}
                </span>
              )}
            </h6>

            {/* Model loading indicator */}
            {hasFaceEnrolled && libLoading && (
              <div className="alert alert-info py-1 mb-2 small d-flex align-items-center gap-2">
                <div className="spinner-border spinner-border-sm" role="status" style={{ width: '0.8rem', height: '0.8rem' }} />
                <span>Loading Face AI models…</span>
              </div>
            )}
            <div className="ratio ratio-4x3 bg-dark rounded mb-2" style={{ overflow: 'hidden' }}>
              {selfie ? (
                <img src={selfie} alt="selfie" style={{ objectFit: 'cover' }} />
              ) : (
                <video ref={videoRef} playsInline muted style={{ objectFit: 'cover' }} />
              )}
            </div>
            <div className="d-flex gap-2">
              {!cameraOn && !selfie && <button className="btn btn-outline-primary btn-sm" onClick={startCamera}>Start Camera</button>}
              {cameraOn && <button className="btn btn-gap btn-sm" onClick={capture}>Capture</button>}
              {selfie && <button className="btn btn-outline-secondary btn-sm" onClick={retake}>Retake</button>}
            </div>
          </div></div>
        </div>

        {/* Location */}
        <div className="col-lg-6">
          <div className="card stat-card h-100"><div className="card-body">
            <h6 className="fw-semibold d-flex align-items-center">
              <i className="bi bi-geo-alt me-1" />GPS Location
              {wfh ? (
                <span className="badge text-bg-success ms-auto"><i className="bi bi-house-check me-1" />WFH today</span>
              ) : enforced ? (
                <span className="badge text-bg-secondary ms-auto"><i className="bi bi-pin-map me-1" />Office only</span>
              ) : null}
            </h6>
            {coords ? (
              <div className="row g-1 mb-2">
                <div className="col-6"><span className="small text-muted">Latitude</span><div className="fw-bold">{coords.latitude.toFixed(6)}</div></div>
                <div className="col-6"><span className="small text-muted">Longitude</span><div className="fw-bold">{coords.longitude.toFixed(6)}</div></div>
                <div className="col-12 small">
                  {coords.manual ? (
                    <span className="text-success"><i className="bi bi-hand-index me-1" />Manually set on map</span>
                  ) : (
                    <>Accuracy:{' '}
                      <b className={coords.accuracy <= 50 ? 'text-success' : coords.accuracy <= 100 ? 'text-warning' : 'text-danger'}>
                        ±{Math.round(coords.accuracy)}m
                      </b></>
                  )}
                </div>
              </div>
            ) : <p className="text-muted small mb-2">No location captured. Use GPS, then drag the pin to your exact spot.</p>}

            {/* Interactive map: pin = the location that will be submitted. */}
            <div ref={mapEl} style={{ height: 230, borderRadius: '0.7rem' }} className="mb-2 border" />
            <p className="text-muted mb-2" style={{ fontSize: '.72rem' }}>
              <i className="bi bi-info-circle me-1" />Drag the pin (or tap the map) to mark your exact location if GPS is off.
            </p>

            {/* Geofence verdict */}
            {wfh ? (
              <div className="alert alert-success py-2 small mb-2">
                <i className="bi bi-house-check me-1" />Work From Home approved today — you can check in/out from anywhere.
              </div>
            ) : enforced && coords ? (
              insideFence ? (
                <div className="alert alert-success py-2 small mb-2">
                  <i className="bi bi-check-circle me-1" />Inside <b>{nearest.f.name}</b> ({Math.round(nearest.d)}m). Check-in/out allowed.
                </div>
              ) : (
                <div className="alert alert-danger py-2 small mb-2">
                  <i className="bi bi-exclamation-triangle me-1" />Outside <b>{nearest.f.name}</b> — {Math.round(nearest.d)}m away (allowed within {nearest.f.radius_m}m). Move into the office or drag the pin to your real spot.
                </div>
              )
            ) : enforced ? (
              <div className="alert alert-secondary py-2 small mb-2">
                <i className="bi bi-pin-map me-1" />Check-in/out is only allowed within the office geofence. Capture your location to verify.
              </div>
            ) : null}

            <div className="d-flex gap-2">
              <button className="btn btn-outline-primary btn-sm" onClick={captureLocation} disabled={locating}>
                {locating ? (
                  <><span className="spinner-border spinner-border-sm me-1" style={{ width: '0.8rem', height: '0.8rem' }} />Locating…</>
                ) : (
                  <><i className="bi bi-crosshair me-1" />{coords ? 'Re-capture GPS' : 'Capture Location'}</>
                )}
              </button>
              {coords && (
                <a className="btn btn-sm btn-outline-secondary" target="_blank" rel="noreferrer"
                  href={`https://www.google.com/maps?q=${coords.latitude},${coords.longitude}&z=18`}>
                  <i className="bi bi-map me-1" />Open in Google Maps
                </a>
              )}
            </div>
          </div></div>
        </div>
      </div>

      {/* Work summary — required before check-out. */}
      {canCheckOut && (
        <div className="card stat-card mt-3"><div className="card-body">
          <h6 className="fw-semibold mb-2">
            <i className="bi bi-journal-text me-1" />Work Summary <span className="text-danger">*</span>
          </h6>
          <p className="text-muted small mb-2">Before checking out, describe what you worked on this session.</p>
          <textarea className="form-control" rows={3} maxLength={2000}
            placeholder="e.g. Completed the payroll module, fixed 3 bugs, attended client call…"
            value={workNote} onChange={(e) => setWorkNote(e.target.value)} />
          <div className="text-muted small mt-1 text-end">{workNote.length}/2000</div>
        </div></div>
      )}

      <div className="mt-3 d-flex gap-2">
        {canCheckIn && (
          <button className="btn btn-success btn-lg" disabled={busy || (!!coords && !locationAllowed)} onClick={() => submit('check-in')}>
            <i className="bi bi-box-arrow-in-right me-1" />{busy ? 'Submitting…' : 'Check In'}
          </button>
        )}
        {canCheckOut && (
          <button className="btn btn-danger btn-lg" disabled={busy || (!!coords && !locationAllowed) || !workNote.trim()} onClick={() => submit('check-out')}>
            <i className="bi bi-box-arrow-right me-1" />{busy ? 'Submitting…' : 'Check Out'}
          </button>
        )}
      </div>

      {today?.sessions?.length > 0 && (
        <div className="card stat-card mt-4"><div className="card-body">
          <h6 className="fw-semibold mb-3"><i className="bi bi-list-check me-1" />Today's Sessions</h6>
          <div className="table-responsive">
            <table className="table gap-table table-sm">
              <thead><tr><th>#</th><th>Check In</th><th>Check Out</th><th>Worked</th><th>Work Summary</th></tr></thead>
              <tbody>
                {today.sessions.map((s, i) => (
                  <tr key={s.id}>
                    <td>{i + 1}</td>
                    <td>{fmtTime(s.check_in_time)}</td>
                    <td>{s.check_out_time ? fmtTime(s.check_out_time) : <span className="badge text-bg-info">In progress</span>}</td>
                    <td>{s.working_minutes ? fmtHours(s.working_minutes) : '—'}</td>
                    <td className="small text-muted" style={{ maxWidth: 320, whiteSpace: 'pre-wrap' }}>{s.work_note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div></div>
      )}
    </>
  );
}
