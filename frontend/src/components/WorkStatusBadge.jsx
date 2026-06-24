const LABELS = {
  working: 'Working',
  rest: 'Rest Mode',
  overtime: 'Overtime',
  logged_out: 'Logged Out',
};

/** Coloured live work-status pill: 🟢 Working 🟡 Rest 🔵 Overtime ⚫ Logged Out */
export default function WorkStatusBadge({ status = 'logged_out', live = false }) {
  const s = LABELS[status] ? status : 'logged_out';
  return (
    <span className={`ws-pill ws-${s}`}>
      <span className={`ws-dot ${live && s !== 'logged_out' ? 'live' : ''}`} />
      {LABELS[s]}
    </span>
  );
}
