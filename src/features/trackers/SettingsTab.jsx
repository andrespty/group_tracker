import { useState } from 'react'
import { KINDS, kindMeta } from '../../lib/format.js'
import { Card } from '../../components/Card.jsx'
import { Button } from '../../components/Button.jsx'
import { Field } from '../../components/Field.jsx'

function GroupSection({ group, onSaveGroup }) {
  const [f, setF] = useState({
    name: group.name, kind: group.kind, unit: group.unit,
    increment: group.increment, goal: group.goal ?? '',
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const meta = kindMeta(f.kind)

  const selectKind = (kind) => {
    const m = kindMeta(kind)
    setF({ ...f, kind, unit: kind === f.kind ? f.unit : (kind === 'count' ? f.unit : m.defaultUnit) })
  }

  const submit = async () => {
    setErr(''); setBusy(true)
    try {
      await onSaveGroup({
        name: f.name,
        unit: f.unit,
        increment: Number(f.increment),
        goal: f.goal === '' ? null : Number(f.goal),
        kind: f.kind,
      })
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
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
      <div className="spacer" />
      <Button full disabled={busy || !f.name} onClick={submit}>
        {busy ? 'Saving…' : 'Save changes'}
      </Button>
      {err && <p className="err">{err}</p>}
    </Card>
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
  group, isCreator, myMemberId, activeMembers,
  onSaveGroup, onRename, onLeave, onDelete,
}) {
  const currentName = activeMembers.find((m) => m.member_id === myMemberId)?.name || ''

  return (
    <>
      {isCreator && <GroupSection group={group} onSaveGroup={onSaveGroup} />}
      <YouSection
        isCreator={isCreator}
        myMemberId={myMemberId}
        activeMembers={activeMembers}
        currentName={currentName}
        onRename={onRename}
        onLeave={onLeave}
      />
      {isCreator && (
        <DangerZone groupName={group.name} onDelete={onDelete} />
      )}
    </>
  )
}
