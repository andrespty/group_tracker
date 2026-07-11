import { fmt, ago, singular } from '../../../lib/format.js'
import { Avatar } from '../../../components/Avatar.jsx'

export function ActivityFeed({ recent, unit }) {
  if (!recent?.length) {
    return <p className="hint" style={{ padding: 10 }}>No activity yet.</p>
  }

  return (
    <div className="feed">
      {recent.map((r, i) => (
        <div key={i} className="fitem">
          <Avatar id={r.member_id} name={r.name} />
          <div className="txt">
            <b>{r.name}</b> logged{' '}
            {Number(r.amount) === 1 ? `a ${singular(unit)}` : `+${fmt(r.amount)}`}
            <span className="time">{ago(r.created_at)}</span>
          </div>
          <div className="amt">+{fmt(r.amount)}</div>
        </div>
      ))}
    </div>
  )
}
