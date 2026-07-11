import { useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { Card } from '../../components/Card.jsx'
import { Button } from '../../components/Button.jsx'
import { Field } from '../../components/Field.jsx'

export function AuthBox() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')

  const send = async () => {
    setErr('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: location.href },
    })
    if (error) setErr(error.message)
    else setSent(true)
  }

  return (
    <Card title="Optional account">
      <p className="hint">
        Play as a guest, or sign in to keep all your trackers in one place across devices.
      </p>
      {sent ? (
        <p className="hint">✓ Check your email for a one-tap sign-in link.</p>
      ) : (
        <>
          <Field label="Email" value={email} onChange={(e) => setEmail(e.target.value)}
                 placeholder="you@email.com" />
          <div className="spacer" />
          <Button variant="ghost" full onClick={send} disabled={!email}>
            Email me a magic link
          </Button>
        </>
      )}
      {err && <p className="err">{err}</p>}
    </Card>
  )
}
