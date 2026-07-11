import { fmt } from '../../../lib/format.js'
import { colorFor } from '../../../lib/colors.js'
import { Avatar } from '../../../components/Avatar.jsx'

export function Leaderboard({ rows }) {
  if (!rows.length) {
    return <div className="board"><p className="hint" style={{ padding: 10 }}>No entries yet.</p></div>
  }
  const max = Math.max(...rows.map((r) => Number(r.total)), 1)

  return (
    <div className="board">
      {rows.map((m, i) => (
        <div key={m.member_id} className={`row ${i === 0 ? 'lead' : ''}`}>
          <div className="rank">{i + 1}</div>
          <Avatar id={m.member_id} name={m.name} className="rav" />
          <div>
            <div className="rname">{m.name}</div>
            <div className="rbar">
              <span style={{
                width: `${(Number(m.total) / max) * 100}%`,
                background: colorFor(m.member_id),
              }} />
            </div>
          </div>
          <div className="rval">{fmt(m.total)}</div>
        </div>
      ))}
    </div>
  )
}
