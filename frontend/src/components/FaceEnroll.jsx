import { useEffect, useRef, useState } from 'react';
import api, { apiError } from '../api/client.js';
import { ensureFaceReady, getDescriptor } from '../utils/face.js';

/**
 * Face enrollment card. Captures a live face, computes a 128-float descriptor
 * with face-api.js, and stores it via POST /profile/face.
 */
export default function FaceEnroll({ enrolled, onChange }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });
  const [libReady, setLibReady] = useState(false);
  const [libLoading, setLibLoading] = useState(true);

  // On mount: wait for face-api.js CDN + load models.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLibLoading(true);
      const ok = await ensureFaceReady();
      if (!cancelled) {
        setLibReady(ok);
        setLibLoading(false);
        if (!ok) {
          setStatus({ type: 'warning', msg: 'Face AI models could not be loaded. Check your internet connection and refresh.' });
        }
      }
    })();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  };

  const startCamera = async () => {
    setStatus({ type: '', msg: '' });
    if (!libReady) {
      setStatus({ type: 'warning', msg: 'Face AI is still loading — please wait a moment.' });
      setLibLoading(true);
      ensureFaceReady().then((ok) => {
        setLibReady(ok);
        setLibLoading(false);
        if (ok) {
          startCamera();
        } else {
          setStatus({ type: 'danger', msg: 'Failed to load Face AI models. Please check your internet connection and refresh.' });
        }
      });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      // Mount the <video> first; the effect below attaches the stream once it
      // is actually in the DOM (otherwise videoRef.current is still null → black feed).
      setCameraOn(true);
      setStatus({ type: 'info', msg: 'Look straight into the camera, then capture.' });
    } catch {
      setStatus({ type: 'danger', msg: 'Camera access denied. Please allow camera permission in your browser settings.' });
    }
  };

  // Attach the captured stream to the <video> after it has mounted.
  useEffect(() => {
    if (cameraOn && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraOn]);

  const enroll = async () => {
    setBusy(true);
    setStatus({ type: 'info', msg: 'Detecting face…' });
    try {
      const descriptor = await getDescriptor(videoRef.current);
      if (!descriptor) {
        setBusy(false);
        return setStatus({ type: 'danger', msg: 'No face detected. Ensure good lighting and face the camera directly.' });
      }
      await api.post('/profile/face', { descriptor });
      stopCamera();
      setStatus({ type: 'success', msg: '✅ Face enrolled successfully! Your face will be verified at each check-in.' });
      onChange?.(true);
    } catch (e) {
      setStatus({ type: 'danger', msg: apiError(e) || 'Face enrollment failed.' });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm('Remove your enrolled face?')) return;
    try {
      await api.delete('/profile/face');
      setStatus({ type: 'success', msg: 'Face removed.' });
      onChange?.(false);
    } catch (e) { setStatus({ type: 'danger', msg: apiError(e) }); }
  };

  return (
    <div className="card stat-card"><div className="card-body">
      <h6 className="fw-semibold d-flex align-items-center gap-2">
        <i className="bi bi-person-bounding-box" />Face Verification
        {enrolled
          ? <span className="badge text-bg-success ms-auto">Enrolled</span>
          : <span className="badge text-bg-secondary ms-auto">Not enrolled</span>}
      </h6>
      <p className="text-muted small">Enroll your face once. At check-in your live selfie is matched against it to stop proxy attendance.</p>

      {/* Model loading indicator */}
      {libLoading && (
        <div className="alert alert-info py-2 d-flex align-items-center gap-2">
          <div className="spinner-border spinner-border-sm" role="status" />
          Loading Face AI models… This may take a few seconds on first use.
        </div>
      )}

      {status.msg && <div className={`alert alert-${status.type} py-2`}>{status.msg}</div>}

      {cameraOn && (
        <div className="ratio ratio-4x3 bg-dark rounded mb-2" style={{ overflow: 'hidden', maxWidth: 320 }}>
          <video ref={videoRef} playsInline muted style={{ objectFit: 'cover' }} />
        </div>
      )}

      <div className="d-flex gap-2 flex-wrap">
        {!cameraOn && <button className="btn btn-outline-primary btn-sm" onClick={startCamera}
          disabled={libLoading}>
          <i className="bi bi-camera me-1" />{enrolled ? 'Re-enroll Face' : 'Enroll Face'}
        </button>}
        {cameraOn && <button className="btn btn-gap btn-sm" disabled={busy} onClick={enroll}>
          {busy ? 'Processing…' : 'Capture & Enroll'}
        </button>}
        {cameraOn && <button className="btn btn-light btn-sm" onClick={stopCamera}>Cancel</button>}
        {enrolled && !cameraOn && <button className="btn btn-outline-danger btn-sm" onClick={remove}>
          <i className="bi bi-trash me-1" />Remove
        </button>}
      </div>
    </div></div>
  );
}
