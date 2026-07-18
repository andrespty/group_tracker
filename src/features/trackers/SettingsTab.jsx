import { useState } from 'react'
import { KINDS, kindMeta } from '../../lib/format.js'
import { AuthBox } from '../auth/AuthBox.jsx'
import { Card } from '../../components/Card.jsx'
import { Button } from '../../components/Button.jsx'
import { Field } from '../../components/Field.jsx'

const APPROVAL_MODES = [
  { id: 'any_member', label: 'Any member', hint: "Anyone active except the entry's author." },
  { id: 'chosen_approvers', label: 'Chosen approvers', hint: 'Only people you pick below (plus you, always).' },
]

function GroupSection({ group, activeMembers, onSaveGroup }) {
  const [f, setF] = useState({
    name: group.name, kind: group.kind, unit: group.unit,
    increment: group.increment, goal: group.goal ?? '',
    approvalsRequired: group.approvals_required ?? 0,
    approvalMode: group.approval_mode || 'any_member',
    approverIds: activeMembers.filter((m) => m.is_approver).map((m) => m.member_id),
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const meta = kindMeta(f.kind)

  const selectKind = (kind) => {
    const m = kindMeta(kind)
    setF({ ...f, kind, unit: kind === f.kind ? f.unit : (kind === 'count' ? f.unit : m.defaultUnit) })
  }

  const toggleApprover = (memberId) => {
    if (memberId === group.created_by) return // always an approver, not toggleable
    setF((prev) => ({
      ...prev,
      approverIds: prev.approverIds.includes(memberId)
        ? prev.approverIds.filter((id) => id !== memberId)
        : [...prev.approverIds, memberId],
    }))
  }

  const approvalsRequired = Number(f.approvalsRequired) || 0
  const eligibleCount = f.approvalMode === 'chosen_approvers'
    ? new Set([...f.approverIds, group.created_by]).size
    : activeMembers.length
  const maxPossible = Math.max(eligibleCount - 1, 0)
  const guardExceeded = approvalsRequired > 0 && approvalsRequired > maxPossible

  const submit = async () => {
    setErr(''); setBusy(true)
    try {
      await onSaveGroup({
        name: f.name,
        unit: f.unit,
        increment: Number(f.increment),
        goal: f.goal === '' ? null : Number(f.goal),
        kind: f.kind,
        approvalsRequired,
        approvalMode: f.approvalMode,
        approverIds: f.approvalMode === 'chosen_approvers' ? f.approverIds : null,
      })
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Card title="Group">
        <label>Tracker type</label>
        <div className="kindgrid">
          {KINDS.map((k) => (
            <button type="button" key={k.id}
                    className={`kindopt ${f.kind === k.id ? 'active' : ''}`}
                    onClick={() => selectKind(k.id)}>
              <div className="klabel">{k.label}</div>
              <div className="khint">{k.hint}</div>
            </button>
          ))}
        </div>

        <Field label="Tracker name" value={f.name} onChange={set('name')} />
        <div className="grid2">
          <div>
            <label>Unit</label>
            {meta.unitMode === 'select' ? (
              <select value={f.unit} onChange={set('unit')}>
                {meta.unitOptions.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            ) : (
              <input value={f.unit} onChange={set('unit')} />
            )}
          </div>
          <div>
            <Field label="Per tap" type="number" step={meta.whole ? '1' : 'any'}
                   value={f.increment} onChange={set('increment')} />
          </div>
        </div>
        <Field label="Goal (blank = no goal)" type="number" step={meta.whole ? '1' : 'any'}
               value={f.goal} onChange={set('goal')} />
      </Card>

      <Card title="Approvals">
        <p className="hint" style={{ marginTop: 0 }}>
          Require other members to sign off before an entry counts toward the total.
        </p>
        <Field label="Approvals required (0 = off)" type="number" min="0" step="1"
               value={f.approvalsRequired} onChange={set('approvalsRequired')} />

        {approvalsRequired > 0 && (
          <>
            <label>Who can approve</label>
            <div className="kindgrid">
              {APPROVAL_MODES.map((mo) => (
                <button type="button" key={mo.id}
                        className={`kindopt ${f.approvalMode === mo.id ? 'active' : ''}`}
                        onClick={() => setF({ ...f, approvalMode: mo.id })}>
                  <div className="klabel">{mo.label}</div>
                  <div className="khint">{mo.hint}</div>
                </button>
              ))}
            </div>

            {f.approvalMode === 'chosen_approvers' && (
              <>
                <label>Approvers</label>
                <div className="board">
                  {activeMembers.map((m) => {
                    const isCreator = m.member_id === group.created_by
                    return (
                      <label key={m.member_id} className="approverrow">
                        <input
                          type="checkbox"
                          checked={isCreator || f.approverIds.includes(m.member_id)}
                          disabled={isCreator}
                          onChange={() => toggleApprover(m.member_id)}
                        />
                        <span>{m.name}</span>
                        {isCreator && <span className="hint" style={{ margin: 0 }}>you, always an approver</span>}
                      </label>
                    )
                  })}
                </div>
              </>
            )}

            {guardExceeded && (
              <p className="err">
                {approvalsRequired} is more than this tracker can ever satisfy — with {eligibleCount} eligible
                approver{eligibleCount === 1 ? '' : 's'}, at most {maxPossible} can vote on any single entry (the
                author never counts). Lower the requirement or add more approvers.
              </p>
            )}
          </>
        )}

        <div className="spacer" />
        <Button full disabled={busy || !f.name || guardExceeded} onClick={submit}>
          {busy ? 'Saving…' : 'Save changes'}
        </Button>
        {err && <p className="err">{err}</p>}
      </Card>
    </>
  )
}

function YouSection({ isCreator, myMemberId, activeMembers, currentName, onRename, onLeave }) {
  const [name, setName] = useState(currentName)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const [leaving, setLeaving] = useState(false)
  const [successor, setSuccessor] = useState('')
  const [leaveBusy, setLeaveBusy] = useState(false)
  const [leaveErr, setLeaveErr] = useState('')

  const rename = async () => {
    setErr(''); setBusy(true)
    try {
      await onRename(name)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  const successors = activeMembers.filter((m) => m.member_id !== myMemberId)

  const cancelLeave = () => {
    setLeaving(false)
    setSuccessor('')
    setLeaveErr('')
  }

  const confirmLeave = async () => {
    setLeaveErr(''); setLeaveBusy(true)
    try {
      await onLeave(isCreator ? successor : null)
    } catch (e) {
      setLeaveErr(e.message)
      setLeaveBusy(false)
    }
  }

  return (
    <Card title="You">
      <Field label="Your name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sam" />
      <div className="spacer" />
      <Button full disabled={busy || !name.trim() || name.trim() === currentName} onClick={rename}>
        {busy ? 'Saving…' : 'Save name'}
      </Button>
      {err && <p className="err">{err}</p>}

      <div className="spacer" />
      {!leaving ? (
        <Button variant="ghost" full onClick={() => setLeaving(true)}>Leave tracker</Button>
      ) : (
        <div style={{ borderTop: '1px solid var(--line)', marginTop: 14, paddingTop: 14 }}>
          {isCreator ? (
            <>
              <p className="hint" style={{ marginTop: 0 }}>
                You created this tracker, so someone else needs to take over before you can leave —
                your past entries stay in the group total either way.
              </p>
              {successors.length === 0 ? (
                <p className="hint">There's no one else to hand it off to yet — invite someone first.</p>
              ) : (
                <>
                  <label>Hand off to</label>
                  <select value={successor} onChange={(e) => setSuccessor(e.target.value)}>
                    <option value="" disabled>Choose a member…</option>
                    {successors.map((m) => (
                      <option key={m.member_id} value={m.member_id}>{m.name}</option>
                    ))}
                  </select>
                </>
              )}
            </>
          ) : (
            <p className="hint" style={{ marginTop: 0 }}>
              Your past entries stay in the group total — you just won't be able to log anymore.
            </p>
          )}
          <div className="spacer" />
          <div className="grid2">
            <Button variant="ghost" full onClick={cancelLeave} disabled={leaveBusy}>Cancel</Button>
            <Button variant="danger" full
                    disabled={leaveBusy || (isCreator && (successors.length === 0 || !successor))}
                    onClick={confirmLeave}>
              {leaveBusy ? 'Leaving…' : 'Confirm leave'}
            </Button>
          </div>
          {leaveErr && <p className="err">{leaveErr}</p>}
        </div>
      )}
    </Card>
  )
}

function AccountSection({ vt, session, myClaimStatus, currentName, onClaim }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    setErr(''); setBusy(true)
    try {
      await onClaim()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (!session) {
    return (
      <AuthBox
        vt={vt}
        title="Your account"
        copy="Save your spot — sign in to claim this member so you can find this tracker from any device."
      />
    )
  }

  if (myClaimStatus === 'me') {
    return (
      <Card title="Your account">
        <p className="hint" style={{ marginTop: 0 }}>Claimed by your account ✓</p>
      </Card>
    )
  }

  if (myClaimStatus === 'other') {
    return (
      <Card title="Your account">
        <p className="hint" style={{ marginTop: 0 }}>
          This member is linked to a different account than the one you're signed in with.
        </p>
      </Card>
    )
  }

  return (
    <Card title="Your account">
      <p className="hint" style={{ marginTop: 0 }}>
        You're signed in, but this member isn't linked to your account yet.
      </p>
      <div className="spacer" />
      <Button full disabled={busy} onClick={submit}>
        {busy ? 'Claiming…' : `Claim ${currentName || 'this member'} on this tracker`}
      </Button>
      {err && <p className="err">{err}</p>}
    </Card>
  )
}

function DangerZone({ groupName, onDelete }) {
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    setErr(''); setBusy(true)
    try {
      await onDelete()
    } catch (e) {
      setErr(e.message)
      setBusy(false)
    }
  }

  return (
    <Card title="Danger zone">
      <p className="hint" style={{ marginTop: 0 }}>
        Deleting a tracker removes it and everyone's history for good. Type the tracker's
        name — <b>{groupName}</b> — to confirm.
      </p>
      <Field label="Tracker name" value={confirmText} onChange={(e) => setConfirmText(e.target.value)}
             placeholder={groupName} />
      <div className="spacer" />
      <Button variant="danger" full disabled={busy || confirmText.trim() !== groupName} onClick={submit}>
        {busy ? 'Deleting…' : 'Delete tracker'}
      </Button>
      {err && <p className="err">{err}</p>}
    </Card>
  )
}

export function SettingsTab({
  vt, session, group, isCreator, myMemberId, myClaimStatus, activeMembers,
  onSaveGroup, onRename, onLeave, onDelete, onClaim,
}) {
  const currentName = activeMembers.find((m) => m.member_id === myMemberId)?.name || ''

  return (
    <>
      {isCreator && <GroupSection group={group} activeMembers={activeMembers} onSaveGroup={onSaveGroup} />}
      <YouSection
        isCreator={isCreator}
        myMemberId={myMemberId}
        activeMembers={activeMembers}
        currentName={currentName}
        onRename={onRename}
        onLeave={onLeave}
      />
      <AccountSection
        vt={vt}
        session={session}
        myClaimStatus={myClaimStatus}
        currentName={currentName}
        onClaim={onClaim}
      />
      {isCreator && (
        <DangerZone groupName={group.name} onDelete={onDelete} />
      )}
    </>
  )
}
