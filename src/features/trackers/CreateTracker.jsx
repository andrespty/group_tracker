import { useState } from 'react'
import { api } from '../../lib/api.js'
import { tokens } from '../../lib/tokens.js'
import { KINDS, kindMeta } from '../../lib/format.js'
import { Card } from '../../components/Card.jsx'
import { Button } from '../../components/Button.jsx'
import { Field } from '../../components/Field.jsx'

export function CreateTracker({ go }) {
  const [f, setF] = useState({
    name: '', creatorName: '', kind: 'count', unit: 'drinks', increment: 1, goal: 10000,
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const meta = kindMeta(f.kind)

  const selectKind = (kind) => {
    const m = kindMeta(kind)
    setF({ ...f, kind, unit: kind === 'count' ? f.unit : m.defaultUnit })
  }

  const submit = async () => {
    setErr(''); setBusy(true)
    try {
      const r = await api.createGroup({
        name: f.name,
        creatorName: f.creatorName,
        unit: f.unit,
        increment: Number(f.increment),
        goal: f.goal === '' ? null : Number(f.goal),
        kind: f.kind,
      })
      tokens.set(r.view_token, r.write_token)
      go(r.view_token)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="Start a tracker">
      <label>What are you tracking?</label>
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

      <Field label="Tracker name" value={f.name} onChange={set('name')}
             placeholder="Road to 10K drinks" />
      <div className="grid2">
        <div>
          <label>Unit</label>
          {meta.unitMode === 'select' ? (
            <select value={f.unit} onChange={set('unit')}>
              {meta.unitOptions.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          ) : (
            <input value={f.unit} onChange={set('unit')} placeholder="drinks" />
          )}
        </div>
        <div>
          <Field label="Per tap" type="number" step={meta.whole ? '1' : 'any'}
                 value={f.increment} onChange={set('increment')} />
        </div>
      </div>
      <Field label="Goal (blank = no goal)" type="number" step={meta.whole ? '1' : 'any'}
             value={f.goal} onChange={set('goal')} placeholder="10000" />
      <Field label="Your name" value={f.creatorName} onChange={set('creatorName')} placeholder="Alex" />
      <div className="spacer" />
      <Button full disabled={busy || !f.name || !f.creatorName} onClick={submit}>
        {busy ? 'Creating…' : 'Create tracker'}
      </Button>
      {err && <p className="err">{err}</p>}
    </Card>
  )
}
