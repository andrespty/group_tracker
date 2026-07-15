import { formatAmount } from '../../../lib/format.js'
import { colorFor } from '../../../lib/colors.js'

const R = 120
const C = 2 * Math.PI * R

export function ContributionRing({ total, displayTotal, goal, kind, unit, leaderboard, pastTotal = 0 }) {
  let offset = 0
  const arcs = leaderboard.map((m) => {
    const len = (Number(m.total) / Number(goal)) * C
    const seg = { len, offset, color: colorFor(m.member_id) }
    offset += len
    return seg
  })
  if (Number(pastTotal) > 0) {
    const len = (Number(pastTotal) / Number(goal)) * C
    arcs.push({ len, offset, color: 'var(--muted)', muted: true })
    offset += len
  }
  const pct = (total / goal) * 100

  return (
    <div className="ringwrap">
      <svg className="breathe" width="286" height="286" viewBox="0 0 286 286">
        <circle cx="143" cy="143" r={R} stroke="var(--track)" strokeWidth="20" fill="none" />
        {arcs.map((a, i) => (
          <circle key={i} cx="143" cy="143" r={R} fill="none" strokeWidth="20"
            strokeLinecap="round" stroke={a.color} opacity={a.muted ? 0.4 : 1}
            strokeDasharray={`${a.len} ${C - a.len}`} strokeDashoffset={-a.offset} />
        ))}
      </svg>
      <div className="center">
        <div className="count">{formatAmount(displayTotal, kind, unit)}</div>
        <div className="of">of {formatAmount(goal, kind, unit)} {kind !== 'money' ? unit : ''}</div>
        <div className="chip">
          <b>{pct.toFixed(1)}%</b> · {leaderboard.length}{' '}
          {leaderboard.length === 1 ? 'player' : 'friends'}
        </div>
      </div>
    </div>
  )
}
