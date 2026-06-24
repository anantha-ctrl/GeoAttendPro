/**
 * Modern stat card: soft tinted icon chip + label + value.
 * `color` drives both the icon tint (low-opacity background) and the icon/value accent.
 */
export default function StatCard({ icon, label, value, color = '#4f46e5', suffix = '' }) {
  return (
    <div className="card stat-card h-100">
      <div className="card-body d-flex align-items-center gap-3">
        <div className="icon" style={{ background: `${color}1a`, color }}>
          <i className={`bi bi-${icon}`} />
        </div>
        <div className="flex-grow-1">
          <div className="text-muted small text-uppercase" style={{ letterSpacing: '.03em', fontSize: '.7rem' }}>{label}</div>
          <div className="fs-3 fw-bold lh-1 mt-1">{value}<span className="fs-6 text-muted ms-1">{suffix}</span></div>
        </div>
      </div>
    </div>
  );
}
