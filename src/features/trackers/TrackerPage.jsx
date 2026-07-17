import { useEffect, useRef, useState } from 'react'
import { useTracker } from './useTracker.js'
import { ContributionRing } from './components/ContributionRing.jsx'
import { Leaderboard } from './components/Leaderboard.jsx'
import { ActivityFeed } from './components/ActivityFeed.jsx'
import { LogButton } from './components/LogButton.jsx'
import { LogDialog } from './components/LogDialog.jsx'
import { JoinBox } from './JoinBox.jsx'
import { LogFromPhone } from './LogFromPhone.jsx'
import { SettingsTab } from './SettingsTab.jsx'
import { PendingTab } from './PendingTab.jsx'
import { ClaimBanner } from './ClaimBanner.jsx'
import { claimBanner, claimIntent } from '../../lib/claim.js'
import { formatAmount } from '../../lib/format.js'
import { Card } from '../../components/Card.jsx'
import { Tabs } from '../../components/Tabs.jsx'

export function TrackerPage({ vt, session, go }) {
  const {
    data, err, writeToken, displayTotal,
    log, removeEntry, vote, claim, join, rename, updateSettings, leave, remove,
  } = useTracker(vt)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(() => claimBanner.isDismissed(vt))
  const [claimResult, setClaimResult] = useState(null) // { ok, message } | null
  const autoClaimTried = useRef(false)

  // After a sign-in triggered from this tracker (banner or Settings), the
  // redirect lands back on this exact URL — claimIntent.consume(vt) tells
  // us whether that sign-in was "for" this tracker specifically, so we
  // don't silently auto-claim on every tracker a signed-in guest happens
  // to revisit later.
  useEffect(() => {
    if (autoClaimTried.current || !session || !writeToken) return
    if (!claimIntent.consume(vt)) return
    autoClaimTried.current = true
    claim()
      .then(() => setClaimResult({ ok: true, message: 'Linked to your account ✓' }))
      .catch((e) => setClaimResult({ ok: false, message: e.message }))
  }, [session, writeToken, vt, claim])

  if (err) return <Card><p className="err">Couldn't load: {err}</p></Card>
  if (!data) return <Card><p className="center-txt muted">Loading…</p></Card>

  const g = data.group
  const hasGoal = g.goal != null && Number(g.goal) > 0
  const pastTotal = Number(data.past_total || 0)
  const pendingCount = Number(data.pending_count || 0)
  const myName = data.leaderboard.find((m) => m.member_id === data.my_member_id)?.name

  const tabs = [
    { id: 'leaderboard', label: 'Leaderboard' },
    { id: 'activity', label: 'Activity' },
    { id: 'pending', label: 'Pending', badge: pendingCount },
    { id: 'phone', label: 'Log from phone' },
    { id: 'settings', label: 'Settings' },
  ]

  return (
    <>
      <div className="grouppill"><span className="dot" /> {g.name}</div>

      {claimResult && (
        <div className="card claimresult">
          <p className={claimResult.ok ? 'hint' : 'err'} style={{ margin: 0 }}>{claimResult.message}</p>
          <button type="button" className="iconbtn" onClick={() => setClaimResult(null)} aria-label="Dismiss">✕</button>
        </div>
      )}

      {!session && writeToken && !bannerDismissed && (
        <ClaimBanner
          vt={vt}
          memberName={myName}
          onDismiss={() => { claimBanner.dismiss(vt); setBannerDismissed(true) }}
        />
      )}

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

      <Tabs key={vt} tabs={tabs}>
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
            {active === 'pending' && (
              writeToken ? (
                <PendingTab recent={data.recent} kind={g.kind} unit={g.unit} onVote={vote} />
              ) : (
                <Card><p className="hint" style={{ margin: 0 }}>
                  Join this tracker to review pending entries.
                </p></Card>
              )
            )}
            {active === 'phone' && (
              <LogFromPhone vt={vt} writeToken={writeToken} session={session} kind={g.kind} />
            )}
            {active === 'settings' && (
              writeToken ? (
                <SettingsTab
                  vt={vt}
                  session={session}
                  group={g}
                  isCreator={!!data.is_creator}
                  myMemberId={data.my_member_id}
                  myClaimStatus={data.my_claim_status}
                  activeMembers={data.leaderboard}
                  onSaveGroup={updateSettings}
                  onRename={rename}
                  onLeave={leave}
                  onDelete={async () => { await remove(); go(null) }}
                  onClaim={claim}
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
