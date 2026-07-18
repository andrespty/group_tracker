import { useState } from 'react'
import { AuthBox } from '../auth/AuthBox.jsx'

// A gentle, dismissible nudge shown to guests who've already joined a
// tracker. Tapping the text expands into the full sign-in flow (reusing
// AuthBox, not a separate form) right in place; tapping the X dismisses
// it for good on this tracker (see claimBanner in lib/claim.js).
export function ClaimBanner({ vt, memberName, onDismiss }) {
  const [expanded, setExpanded] = useState(false)

  if (expanded) {
    return (
      <AuthBox
        vt={vt}
        title="Save your spot"
        copy={`Joined as ${memberName || 'a guest'} — sign in to claim this member so you can find this tracker from any device.`}
      />
    )
  }

  return (
    <div className="claimbanner">
      <button type="button" className="claimbanner-text" onClick={() => setExpanded(true)}>
        Joined as {memberName || 'a guest'}? Sign in to save your spot.
      </button>
      <button type="button" className="iconbtn" onClick={onDismiss} aria-label="Dismiss">✕</button>
    </div>
  )
}
