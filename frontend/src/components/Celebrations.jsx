import { useEffect, useState } from 'react';
import api, { API_BASE } from '../api/client.js';
import Avatar from './Avatar.jsx';
const dayLabel = (n) => (n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `in ${n} days`);

/** Birthday & work-anniversary widget (fetches its own data). */
export default function Celebrations() {
  const [data, setData] = useState({ today: { birthdays: [], anniversaries: [] }, upcoming: [] });

  useEffect(() => {
    api.get('/celebrations', { params: { days: 30 } }).then((r) => setData(r.data.data)).catch(() => {});
  }, []);

  const t = data.today;
  const todayCount = t.birthdays.length + t.anniversaries.length;

  const Row = ({ person, icon, color, text }) => (
    <li className="list-group-item d-flex align-items-center gap-2 px-0">
      <Avatar name={person.full_name} photo={person.profile_photo} size={34} />
      <div className="flex-grow-1">
        <div className="small fw-semibold">{person.full_name}</div>
        <div className="text-muted" style={{ fontSize: '.72rem' }}>{text}</div>
      </div>
      <i className={`bi bi-${icon}`} style={{ color }} />
    </li>
  );

  return (
    <div className="card stat-card h-100"><div className="card-body">
      <h6 className="fw-semibold mb-3"><i className="bi bi-gift me-1 text-danger" />Celebrations</h6>

      {todayCount === 0 && data.upcoming.length === 0 && (
        <p className="text-muted small mb-0">No upcoming birthdays or anniversaries.</p>
      )}

      {todayCount > 0 && (
        <>
          <div className="small fw-semibold text-uppercase text-muted mb-1" style={{ fontSize: '.68rem' }}>Today 🎉</div>
          <ul className="list-group list-group-flush mb-2">
            {t.birthdays.map((p) => <Row key={`b${p.user_id}`} person={p} icon="balloon-heart-fill" color="#ec4899" text="🎂 Birthday today" />)}
            {t.anniversaries.map((p) => <Row key={`a${p.user_id}`} person={p} icon="award-fill" color="#f59e0b" text={`🎉 ${p.years} year work anniversary`} />)}
          </ul>
        </>
      )}

      {data.upcoming.length > 0 && (
        <>
          <div className="small fw-semibold text-uppercase text-muted mb-1" style={{ fontSize: '.68rem' }}>Upcoming</div>
          <ul className="list-group list-group-flush">
            {data.upcoming.slice(0, 6).map((p, i) => (
              <Row key={i} person={p}
                icon={p.type === 'birthday' ? 'balloon-heart' : 'award'}
                color={p.type === 'birthday' ? '#ec4899' : '#f59e0b'}
                text={`${p.type === 'birthday' ? 'Birthday' : `${p.years}y anniversary`} · ${dayLabel(p.days_away)}`} />
            ))}
          </ul>
        </>
      )}
    </div></div>
  );
}
