import { fmt } from '../../../lib/format.js'
import { colorFor } from '../../../lib/colors.js'
import { Avatar } from '../../../components/Avatar.jsx'

export function Leaderboard({ rows, pastTotal = 0 }) {
  const max = Math.max(...rows.map((r) => Number(r.total)), 1)

  return (
    <div className="board">
      {rows.length === 0 && (
        <p className="hint" style={{ padding: 10 }}>No entries yet.</p>
      )}
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
      {Number(pastTotal) > 0 && (
        <div className="row past">
          <div className="rank" />
          <div className="rav past-av">···</div>
          <div>
            <div className="rname">Past members</div>
          </div>
          <div className="rval">{fmt(pastTotal)}</div>
        </div>
      )}
    </div>
  )
}
