import { useState } from 'react'
import { useTracker } from './useTracker.js'
import { ContributionRing } from './components/ContributionRing.jsx'
import { Leaderboard } from './components/Leaderboard.jsx'
import { ActivityFeed } from './components/ActivityFeed.jsx'
import { LogButton } from './components/LogButton.jsx'
import { LogDialog } from './components/LogDialog.jsx'
import { JoinBox } from './JoinBox.jsx'
import { LogFromPhone } from './LogFromPhone.jsx'
import { SettingsTab } from './SettingsTab.jsx'
import { formatAmount } from '../../lib/format.js'
import { Card } from '../../components/Card.jsx'
import { Tabs } from '../../components/Tabs.jsx'

const TABS = [
  { id: 'leaderboard', label: 'Leaderboard' },
  { id: 'activity', label: 'Activity' },
  { id: 'phone', label: 'Log from phone' },
  { id: 'settings', label: 'Settings' },
]

export function TrackerPage({ vt, session, go }) {
  const {
    data, err, writeToken, displayTotal,
    log, removeEntry, join, rename, updateSettings, leave, remove,
  } = useTracker(vt)
  const [dialogOpen, setDialogOpen] = useState(false)

  if (err) return <Card><p className="err">Couldn't load: {err}</p></Card>
  if (!data) return <Card><p className="center-txt muted">Loading…</p></Card>

  const g = data.group
  const hasGoal = g.goal != null && Number(g.goal) > 0
  const pastTotal = Number(data.past_total || 0)

  return (
    <>
      <div className="grouppill"><span className="dot" /> {g.name}</div>

      <div className="hero">
        {hasGoal ? (
          <ContributionRing
            total={Number(data.total)}
            displayTotal={displayTotal}
            goal={Number(g.goal)}
            kind={g.kind}
            unit={g.unit}
            leaderboard={data.leaderboard}
            pastTotal={pastTotal}
          />
        ) : (
          <div className="numhero">
            <div className="bignum">{formatAmount(displayTotal, g.kind, g.unit)}</div>
            <span className="of">{formatAmount(data.total, g.kind, g.unit)} {g.kind !== 'money' ? g.unit : ''}</span>
          </div>
        )}
      </div>

      {writeToken
        ? <LogButton increment={g.increment} kind={g.kind} unit={g.unit} onOpen={() => setDialogOpen(true)} />
        : <JoinBox onJoin={join} />}

      {dialogOpen && (
        <LogDialog
          kind={g.kind}
          unit={g.unit}
          increment={g.increment}
          groupId={g.id}
          onClose={() => setDialogOpen(false)}
          onConfirm={(payload, origin) => log(payload, origin)}
        />
      )}

      <Tabs key={vt} tabs={TABS}>
        {(active) => (
          <>
            {active === 'leaderboard' && (
              <Leaderboard rows={data.leaderboard} pastTotal={pastTotal} kind={g.kind} unit={g.unit} />
            )}
            {active === 'activity' && (
              <ActivityFeed
                recent={data.recent}
                kind={g.kind}
                unit={g.unit}
                myMemberId={data.my_member_id}
                isCreator={!!data.is_creator}
                onDelete={removeEntry}
              />
            )}
            {active === 'phone' && (
              <LogFromPhone vt={vt} writeToken={writeToken} session={session} kind={g.kind} />
            )}
            {active === 'settings' && (
              writeToken ? (
                <SettingsTab
                  group={g}
                  isCreator={!!data.is_creator}
                  myMemberId={data.my_member_id}
                  activeMembers={data.leaderboard}
                  onSaveGroup={updateSettings}
                  onRename={rename}
                  onLeave={leave}
                  onDelete={async () => { await remove(); go(null) }}
                />
              ) : (
                <Card><p className="hint" style={{ margin: 0 }}>
                  Join this tracker to manage your name and settings.
                </p></Card>
              )
            )}
          </>
        )}
      </Tabs>

      <div className="foot">Anyone with the link can cheer you on 🍻</div>
    </>
  )
}
