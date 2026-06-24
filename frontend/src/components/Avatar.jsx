import { API_BASE } from '../api/client';

// Deterministic color from a name so each person keeps a stable avatar color.
const COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#7c3aed', '#14b8a6', '#ec4899'];
function colorFor(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
}
function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('');
}

export default function Avatar({ name, photo, size = 40 }) {
  const style = { width: size, height: size, fontSize: size * 0.38 };
  if (photo) {
    return <img className="gap-avatar" src={`${API_BASE}${photo}`} alt={name} style={style} />;
  }
  return (
    <span className="gap-avatar" style={{ ...style, background: colorFor(name) }}>
      {initials(name) || '?'}
    </span>
  );
}
