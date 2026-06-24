export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : '—');

export const fmtTime = (dt) =>
  dt ? new Date(dt.replace(' ', 'T')).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';

export const fmtHours = (minutes) =>
  minutes ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : '—';

export const statusColor = (status) =>
  ({
    present: 'success',
    late: 'warning',
    half_day: 'info',
    absent: 'danger',
    leave: 'secondary',
    wfh: 'primary',
    pending: 'warning',
    approved: 'success',
    rejected: 'danger',
    cancelled: 'secondary',
  }[status] || 'secondary');

export const prettyStatus = (s) => (s ? s.replace(/_/g, ' ') : '—');

/**
 * Capture the most accurate GPS position available.
 *
 * A single getCurrentPosition() on a laptop returns a coarse WiFi/IP fix
 * (often ±100m+), which drops the map pin on the wrong building. Instead we
 * watch the position for a few seconds and keep the reading with the smallest
 * accuracy radius, resolving early once it's good enough. `maximumAge: 0`
 * forces a fresh fix rather than a stale cached one.
 */
export function getPosition({ desiredAccuracy = 30, maxWait = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation not supported by this browser.'));

    let best = null;
    let watchId = null;
    let timer = null;
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      if (timer) clearTimeout(timer);
      if (best) resolve(best);
      else reject(new Error('Unable to get location. Please allow GPS access.'));
    };

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const r = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        if (!best || r.accuracy < best.accuracy) best = r; // keep the tightest fix
        if (r.accuracy <= desiredAccuracy) finish();        // good enough → stop early
      },
      (err) => { if (!best) { done = true; if (timer) clearTimeout(timer); reject(new Error(err.message || 'Unable to get location. Please allow GPS access.')); } },
      { enableHighAccuracy: true, timeout: maxWait, maximumAge: 0 }
    );

    timer = setTimeout(finish, maxWait); // give up refining after maxWait, return best so far
  });
}
