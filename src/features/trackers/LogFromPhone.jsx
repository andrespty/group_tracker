import { useState } from 'react'
import { api } from '../../lib/api.js'
import { linkFor } from '../../lib/format.js'
import { Button } from '../../components/Button.jsx'

function CopyRow({ value }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard permission denied — the value is still visible to select
    }
  }

  return (
    <div className="copyrow">
      <div className="share">{value}</div>
      <button type="button" className="iconbtn" onClick={copy} title="Copy" aria-label="Copy">
        {copied ? '✓' : '⧉'}
      </button>
    </div>
  )
}

export function LogFromPhone({ vt, writeToken, session }) {
  const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/log_entry`
  const apikey = import.meta.env.VITE_SUPABASE_ANON_KEY

  const claim = async () => {
    try {
      await api.claimMember(writeToken)
      alert('Linked to your account ✓')
    } catch (e) {
      alert(e.message)
    }
  }

  return (
    <>
      <div className="card">
        <p className="eyebrow">Share this tracker</p>
        <p className="hint" style={{ marginTop: 0 }}>
          Anyone with this link can view the board and join:
        </p>
        <CopyRow value={linkFor(vt)} />
      </div>

      {writeToken && (
        <div className="card">
          <p className="eyebrow">One-tap iOS Shortcut</p>
          <p className="hint" style={{ marginTop: 0 }}>
            Build this once on your phone, then add it to your Home Screen for one-tap logging.
          </p>
          <ol className="steps">
            <li>Shortcuts app → <b>+</b> → add action <b>Get Contents of URL</b>.</li>
            <li>
              <b>URL</b> — the log entry endpoint:
              <CopyRow value={endpoint} />
            </li>
            <li><b>Method</b>: <code>POST</code></li>
            <li>
              <b>Headers</b> (add two):
              <div className="hint" style={{ marginTop: 8 }}><code>apikey</code> =</div>
              <CopyRow value={apikey} />
              <div className="hint" style={{ marginTop: 8 }}>
                <code>Content-Type</code> = <code>application/json</code>
              </div>
            </li>
            <li>
              <b>Request Body</b>: <code>JSON</code>, one field, <code>p_write_token</code> =
              <CopyRow value={writeToken} />
              <span className="hint">
                Leave <code>p_amount</code> out to use the tracker's default increment.
              </span>
            </li>
            <li>Name it (e.g. "+1 drink") and add it to your Home Screen.</li>
          </ol>

          {session && (
            <>
              <div className="spacer" />
              <Button variant="ghost" full onClick={claim}>
                Link this tracker to my account
              </Button>
            </>
          )}
        </div>
      )}
    </>
  )
}
