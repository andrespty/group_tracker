import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../../lib/api.js'
import { tokens } from '../../lib/tokens.js'
import { confettiBurst } from '../../lib/confetti.js'
import { deleteEntryPhotos } from '../../lib/photos.js'

export function useTracker(vt) {
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [writeToken, setWriteToken] = useState(() => tokens.get(vt))
  const [displayTotal, setDisplayTotal] = useState(0)
  const raf = useRef(0)
  const displayRef = useRef(0)

  // `whole` rounds each animation frame to an integer, matching the
  // original count-tracker behavior exactly. Non-count kinds round to 2
  // decimals instead — Math.round alone would floor a distance/money/
  // duration total to a whole number for the entire animation, including
  // its final frame.
  const animateTo = useCallback((to, whole) => {
    cancelAnimationFrame(raf.current)
    const round = whole ? Math.round : (v) => Math.round(v * 100) / 100
    if (document.documentElement.dataset.motion === 'off') {
      displayRef.current = to
      setDisplayTotal(to)
      return
    }
    const from = displayRef.current
    const start = performance.now()
    const tick = (now) => {
      const p = Math.min(1, (now - start) / 650)
      const v = round(from + (to - from) * (1 - Math.pow(1 - p, 3)))
      displayRef.current = v
      setDisplayTotal(v)
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }, [])

  // Depending on writeToken (rather than a ref) means join/leave — which
  // change it — automatically trigger a fresh load with an up-to-date
  // is_creator / my_member_id, no manual reload needed on their part.
  const load = useCallback(async (animate = false) => {
    try {
      const d = await api.getStandings(vt, writeToken)
      setData(d)
      if (animate) {
        animateTo(Number(d.total), d.group.kind === 'count')
      } else {
        displayRef.current = Number(d.total)
        setDisplayTotal(Number(d.total))
      }
    } catch (e) {
      setErr(e.message)
    }
  }, [vt, writeToken, animateTo])

  useEffect(() => {
    load(false)
    return () => cancelAnimationFrame(raf.current)
  }, [load])

  // Unlike the other mutations here, log() throws instead of setting err —
  // it's driven by LogDialog, which shows its own inline error and stays
  // open, rather than the page-level err view (which replaces the whole
  // tracker with an error card, appropriate for a failed initial load but
  // not for "that particular tap didn't go through").
  const log = useCallback(async (payload, origin) => {
    if (!writeToken) return
    await api.logEntry(writeToken, payload)
    if (origin) confettiBurst(origin.x, origin.y)
    await load(true)
  }, [writeToken, load])

  const removeEntry = useCallback(async (entryId) => {
    if (!writeToken) return
    const r = await api.deleteEntry(writeToken, entryId)
    await load(true)
    await deleteEntryPhotos([r.photo_path, r.thumb_path])
  }, [writeToken, load])

  // Throws (rather than setting err) for the same reason log() does — the
  // Pending tab shows its own inline error on a failed vote rather than
  // losing the whole review queue to the page-level error view.
  const vote = useCallback(async (entryId, choice) => {
    if (!writeToken) return
    await api.voteEntry(writeToken, entryId, choice)
    await load(false)
  }, [writeToken, load])

  // Throws — used both by a direct Settings button click (which shows its
  // own inline error) and by the auto-claim-after-sign-in effect (which
  // shows its own transient result notice instead).
  const claim = useCallback(async () => {
    if (!writeToken) return
    await api.claimMember(writeToken)
    await load(false)
  }, [writeToken, load])

  const join = useCallback(async (name) => {
    const r = await api.addMember(vt, name)
    tokens.set(vt, r.write_token)
    setWriteToken(r.write_token)
  }, [vt])

  const rename = useCallback(async (name) => {
    if (!writeToken) return
    await api.renameMember(writeToken, name)
    await load(false)
  }, [writeToken, load])

  const updateSettings = useCallback(async (patch) => {
    if (!writeToken) return
    await api.updateGroup(writeToken, patch)
    await load(false)
  }, [writeToken, load])

  const leave = useCallback(async (successorMemberId) => {
    if (!writeToken) return
    await api.leaveGroup(writeToken, successorMemberId ?? null)
    tokens.clear(vt)
    setWriteToken(null)
  }, [writeToken, vt])

  const remove = useCallback(async () => {
    if (!writeToken) return
    await api.deleteGroup(writeToken)
    tokens.clear(vt)
  }, [writeToken, vt])

  return {
    data, err, writeToken, displayTotal,
    log, removeEntry, vote, claim, join, rename, updateSettings, leave, remove,
    reload: load,
  }
}
