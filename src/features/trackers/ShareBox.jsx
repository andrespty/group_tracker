import { api } from '../../lib/api.js'
import { linkFor } from '../../lib/format.js'
import { Button } from '../../components/Button.jsx'

export function ShareBox({ vt, writeToken, session }) {
  const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/log_entry`

  const claim = async () => {
    try {
      await api.claimMember(writeToken)
      alert('Linked to your account ✓')
    } catch (e) {
      alert(e.message)
    }
  }

  return (
    <div className="sec">
      <h3>Share &amp; log from your phone</h3>
      <div className="card" style={{ marginBottom: 0 }}>
        <p className="hint" style={{ marginTop: 0 }}>
          Anyone with this link can view the board and join:
        </p>
        <div className="share">{linkFor(vt)}</div>

        {writeToken && (
          <>
            <p className="hint" style={{ marginTop: 16 }}>
              For a one-tap iOS Shortcut, POST to this endpoint with your write token (see the README):
            </p>
            <div className="share">{endpoint}</div>
            <div className="share">write_token: {writeToken}</div>
            {session && (
              <>
                <div className="spacer" />
                <Button variant="ghost" full onClick={claim}>
                  Link this tracker to my account
                </Button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
