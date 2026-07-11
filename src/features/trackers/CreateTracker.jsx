import { useState } from 'react'
import { api } from '../../lib/api.js'
import { tokens } from '../../lib/tokens.js'
import { Card } from '../../components/Card.jsx'
import { Button } from '../../components/Button.jsx'
import { Field } from '../../components/Field.jsx'

export function CreateTracker({ go }) {
  const [f, setF] = useState({
    name: '', creatorName: '', unit: 'drinks', increment: 1, goal: 10000,
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const submit = async () => {
    setErr(''); setBusy(true)
    try {
      const r = await api.createGroup({
        name: f.name,
        creatorName: f.creatorName,
        unit: f.unit,
        increment: Number(f.increment),
        goal: f.goal === '' ? null : Number(f.goal),
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
      <Field label="What are you tracking?" value={f.name} onChange={set('name')}
             placeholder="Road to 10K drinks" />
      <div className="grid2">
        <div><Field label="Unit" value={f.unit} onChange={set('unit')} placeholder="drinks" /></div>
        <div><Field label="Per tap" type="number" value={f.increment} onChange={set('increment')} /></div>
      </div>
      <Field label="Goal (blank = no goal)" type="number" value={f.goal}
             onChange={set('goal')} placeholder="10000" />
      <Field label="Your name" value={f.creatorName} onChange={set('creatorName')} placeholder="Alex" />
      <div className="spacer" />
      <Button full disabled={busy || !f.name || !f.creatorName} onClick={submit}>
        {busy ? 'Creating…' : 'Create tracker'}
      </Button>
      {err && <p className="err">{err}</p>}
    </Card>
  )
}
