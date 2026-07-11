import { fmt, ago, singular } from '../../../lib/format.js'
import { Avatar } from '../../../components/Avatar.jsx'

export function ActivityFeed({ recent, unit }) {
  if (!recent?.length) return null

  return (
    <div className="sec">
      <h3>Latest rounds</h3>
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
    </div>
  )
}
