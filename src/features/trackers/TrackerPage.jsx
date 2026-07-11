import { useTracker } from './useTracker.js'
import { ContributionRing } from './components/ContributionRing.jsx'
import { Leaderboard } from './components/Leaderboard.jsx'
import { ActivityFeed } from './components/ActivityFeed.jsx'
import { LogButton } from './components/LogButton.jsx'
import { JoinBox } from './JoinBox.jsx'
import { ShareBox } from './ShareBox.jsx'
import { fmt } from '../../lib/format.js'
import { Card } from '../../components/Card.jsx'

export function TrackerPage({ vt, session }) {
  const { data, err, writeToken, displayTotal, log, join } = useTracker(vt)

  if (err) return <Card><p className="err">Couldn't load: {err}</p></Card>
  if (!data) return <Card><p className="center-txt muted">Loading…</p></Card>

  const g = data.group
  const hasGoal = g.goal != null && Number(g.goal) > 0

  return (
    <>
      <div className="grouppill"><span className="dot" /> {g.name}</div>

      <div className="hero">
        {hasGoal ? (
          <ContributionRing
            total={Number(data.total)}
            displayTotal={displayTotal}
            goal={Number(g.goal)}
            unit={g.unit}
            leaderboard={data.leaderboard}
          />
        ) : (
          <div className="numhero">
            <div className="bignum">{fmt(displayTotal)}</div>
            <span className="of">{fmt(data.total)} {g.unit}</span>
          </div>
        )}
      </div>

      {writeToken
        ? <LogButton increment={g.increment} unit={g.unit} onLog={log} />
        : <JoinBox onJoin={join} />}

      <ActivityFeed recent={data.recent} unit={g.unit} />

      <div className="sec">
        <h3>Who's carrying the group</h3>
        <Leaderboard rows={data.leaderboard} />
      </div>

      <ShareBox vt={vt} writeToken={writeToken} session={session} />
      <div className="foot">Anyone with the link can cheer you on 🍻</div>
    </>
  )
}
