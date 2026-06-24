import { useEffect, useRef, useState } from 'react';
import api from '../api/client.js';

/**
 * Smart Work-Tracking state machine (renders only the popups).
 *
 * Working → Rest → Overtime → Logged Out
 *
 * Rest Mode triggers ONLY on device screen-off / lock / sleep — never on mouse,
 * keyboard or idle time. We use the Page Visibility API: when the OS turns the
 * screen off, locks, or sleeps, the browser tab fires `visibilitychange` →
 * hidden. (Plain idle with the screen on does NOT hide the tab, so it is never
 * counted as rest.) A wake-from-sleep is the matching `visible` event.
 *
 * At the configured work-end time a popup offers Logout / Continue Working.
 * Continuing starts Overtime mode with a reminder every 30 minutes.
 */
const POLL_MS = 15000;
const OVERTIME_REMINDER_MIN = 30;
const SLEEP_THRESHOLD_S = 60; // a visible-tab time gap beyond this = device slept / screen off

const fmt = (min) => {
  min = Math.max(0, Math.round(min));
  const h = Math.floor(min / 60);
  return h ? `${h}h ${min % 60}m` : `${min}m`;
};

export default function WorkdayMonitor() {
  const [snap, setSnap] = useState(null);
  const [modal, setModal] = useState(null); // 'workday' | 'overtime' | null
  const [busy, setBusy] = useState(false);

  const hasSession = useRef(false);
  const status = useRef('logged_out');
  const lastTick = useRef(Date.now()); // baseline for sleep/screen-off detection
  const endTime = useRef('18:30');
  const reminderBucket = useRef(0); // last 30-min overtime bucket we reminded for

  const apply = (data) => {
    if (!data) return;
    setSnap(data);
    hasSession.current = !!data.has_open_session;
    status.current = data.status;
    if (data.work_end_time && /^\d{1,2}:\d{2}$/.test(data.work_end_time)) endTime.current = data.work_end_time;
    window.dispatchEvent(new CustomEvent('activity-update', { detail: data }));
  };

  const refresh = async () => {
    try { const r = await api.get('/attendance/live'); apply(r.data?.data); } catch { /* ignore */ }
  };

  // Switching browser tabs / apps keeps the device awake (screen still ON), so
  // it must NOT count as rest. We reset the sleep baseline whenever the tab
  // becomes visible again, so any time spent on another tab is never counted.
  useEffect(() => {
    const onVis = () => { if (!document.hidden) lastTick.current = Date.now(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Poll + drive the workday / overtime popups.
  useEffect(() => {
    let mounted = true;

    const tick = async () => {
      if (!mounted) return;

      // Sleep / screen-off detection: timers freeze only when the DEVICE sleeps
      // or the screen powers off. A large gap while the tab is VISIBLE means a
      // genuine sleep → record it as rest. Tab-switching keeps timers running and
      // resets the baseline on return, so it never produces a gap here.
      if (!document.hidden) {
        const gap = Math.round((Date.now() - lastTick.current) / 1000);
        lastTick.current = Date.now();
        if (gap >= SLEEP_THRESHOLD_S && hasSession.current) {
          try { apply((await api.post('/attendance/rest-end', { seconds: gap })).data?.data); } catch { /* ignore */ }
        }
      }

      await refresh();
      if (!hasSession.current || document.hidden) return;

      // Overtime reminders every 30 minutes.
      if (status.current === 'overtime') {
        const bucket = Math.floor((snap?.overtime_minutes || 0) / OVERTIME_REMINDER_MIN);
        if (bucket >= 1 && bucket > reminderBucket.current) {
          reminderBucket.current = bucket;
          setModal((m) => m || 'overtime');
        }
        return;
      }

      // Standard work-end popup (once per day), not while resting.
      if (status.current === 'working') {
        const key = `workday_prompt_${new Date().toISOString().slice(0, 10)}`;
        const [eh, em] = endTime.current.split(':').map(Number);
        const now = new Date();
        const past = now.getHours() > eh || (now.getHours() === eh && now.getMinutes() >= em);
        if (past && !localStorage.getItem(key)) {
          localStorage.setItem(key, '1');
          setModal((m) => m || 'workday');
        }
      }
    };

    tick();
    const id = setInterval(tick, POLL_MS);
    return () => { mounted = false; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap?.overtime_minutes]);

  const doLogout = async () => {
    setBusy(true);
    try { apply((await api.post('/attendance/logout', {})).data?.data); setModal(null); }
    catch { /* ignore */ } finally { setBusy(false); }
  };

  const doContinue = async () => {
    setBusy(true);
    try { apply((await api.post('/attendance/overtime-start', {})).data?.data); setModal(null); reminderBucket.current = 0; }
    catch { /* ignore */ } finally { setBusy(false); }
  };

  const dismissOvertime = () => setModal(null);

  if (!modal) return null;

  return (
    <div className="wm-overlay" role="dialog" aria-modal="true">
      <div className="wm-modal card stat-card">
        <div className="card-body p-4">
          {modal === 'workday' ? (
            <>
              <div className="wm-ico" style={{ background: '#4f46e51a', color: '#4f46e5' }}>
                <i className="bi bi-check2-circle" />
              </div>
              <h5 className="fw-bold mt-3 mb-1">Standard working duration reached</h5>
              <p className="text-muted mb-1">Your workday has reached the standard working duration.</p>
              <div className="small text-muted mb-3">
                Login {snap?.login_time ? new Date(snap.login_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                {' · '}Worked {fmt(snap?.active_minutes || 0)}{snap?.rest_minutes ? ` · Rest ${fmt(snap.rest_minutes)}` : ''}
              </div>
              <div className="d-flex gap-2">
                <button className="btn btn-outline-danger flex-fill" disabled={busy} onClick={doLogout}>
                  <i className="bi bi-box-arrow-right me-1" />Logout
                </button>
                <button className="btn btn-gap flex-fill" disabled={busy} onClick={doContinue}>
                  <i className="bi bi-lightning-charge me-1" />Continue Working
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="wm-ico" style={{ background: '#0ea5e91a', color: '#0ea5e9' }}>
                <i className="bi bi-stopwatch" />
              </div>
              <h5 className="fw-bold mt-3 mb-1">Overtime Mode</h5>
              <p className="text-muted mb-1">You are currently working in Overtime Mode. Do you want to logout?</p>
              <div className="small text-muted mb-3">Overtime so far · {fmt(snap?.overtime_minutes || 0)}</div>
              <div className="d-flex gap-2">
                <button className="btn btn-outline-danger flex-fill" disabled={busy} onClick={doLogout}>
                  <i className="bi bi-box-arrow-right me-1" />Logout
                </button>
                <button className="btn btn-light flex-fill" disabled={busy} onClick={dismissOvertime}>
                  Keep Working
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
