import { useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { claimIntent } from '../../lib/claim.js'
import { Card } from '../../components/Card.jsx'
import { Button } from '../../components/Button.jsx'
import { Field } from '../../components/Field.jsx'

// Reused both on the home page (no `vt`, no claim intent — there's no
// specific tracker to claim into) and from inside a tracker (Settings,
// the claim banner), where `vt` is set so that landing back here signed
// in triggers an automatic claim attempt for that tracker.
export function AuthBox({
  vt,
  title = 'Optional account',
  copy = 'Play as a guest, or sign in to keep all your trackers in one place across devices.',
}) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const google = async () => {
    setErr(''); setBusy(true)
    if (vt) claimIntent.set(vt)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: location.href },
    })
    if (error) {
      claimIntent.clear()
      setErr(error.message)
      setBusy(false)
    }
    // on success the browser navigates away to Google, so nothing else to do here
  }

  const send = async () => {
    setErr('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: location.href },
    })
    if (error) setErr(error.message)
    else {
      if (vt) claimIntent.set(vt)
      setSent(true)
    }
  }

  return (
    <Card title={title}>
      <p className="hint" style={{ marginTop: 0 }}>{copy}</p>
      {sent ? (
        <p className="hint">✓ Check your email for a one-tap sign-in link.</p>
      ) : (
        <>
          <Button full disabled={busy} onClick={google}>
            {busy ? 'Redirecting…' : 'Continue with Google'}
          </Button>
          <div className="spacer" />
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
