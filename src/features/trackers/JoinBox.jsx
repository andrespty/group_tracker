import { useState } from 'react'
import { Card } from '../../components/Card.jsx'
import { Button } from '../../components/Button.jsx'
import { Field } from '../../components/Field.jsx'

export function JoinBox({ onJoin }) {
  const [name, setName] = useState('')
  const [err, setErr] = useState('')

  const submit = async () => {
    setErr('')
    try { await onJoin(name) } catch (e) { setErr(e.message) }
  }

  return (
    <Card title="Join this tracker">
      <Field label="Your name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sam" />
      {err && <p className="err">{err}</p>}
      <div className="spacer" />
      <Button full onClick={submit} disabled={!name}>Join &amp; start logging</Button>
    </Card>
  )
}
