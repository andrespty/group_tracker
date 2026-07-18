const DISMISS_KEY = 'tally_claim_banner_dismissed'
const INTENT_KEY = 'tally_claim_intent'

function readSet(key) {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || '[]'))
  } catch {
    return new Set()
  }
}

function writeSet(key, set) {
  localStorage.setItem(key, JSON.stringify([...set]))
}

export const claimBanner = {
  isDismissed: (vt) => readSet(DISMISS_KEY).has(vt),
  dismiss: (vt) => {
    const s = readSet(DISMISS_KEY)
    s.add(vt)
    writeSet(DISMISS_KEY, s)
  },
}

// Set right before redirecting to sign-in (from the banner or Settings),
// so that when the user lands back here already authenticated, we know
// which tracker to auto-claim for. consume() only returns true once per
// intent — it clears itself so a later, unrelated visit to this same
// tracker while already signed in doesn't silently re-trigger a claim.
export const claimIntent = {
  set: (vt) => localStorage.setItem(INTENT_KEY, vt),
  consume: (vt) => {
    const pending = localStorage.getItem(INTENT_KEY)
    if (pending === vt) {
      localStorage.removeItem(INTENT_KEY)
      return true
    }
    return false
  },
}
