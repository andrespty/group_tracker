import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../../lib/api.js'
import { tokens } from '../../lib/tokens.js'
import { confettiBurst } from '../../lib/confetti.js'

export function useTracker(vt) {
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [writeToken, setWriteToken] = useState(() => tokens.get(vt))
  const [displayTotal, setDisplayTotal] = useState(0)
  const raf = useRef(0)
  const displayRef = useRef(0)

  const animateTo = useCallback((to) => {
    cancelAnimationFrame(raf.current)
    if (document.documentElement.dataset.motion === 'off') {
      displayRef.current = to
      setDisplayTotal(to)
      return
    }
    const from = displayRef.current
    const start = performance.now()
    const tick = (now) => {
      const p = Math.min(1, (now - start) / 650)
      const v = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)))
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
        animateTo(Number(d.total))
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

  const log = useCallback(async (origin) => {
    if (!writeToken) return
    if (origin) confettiBurst(origin.x, origin.y)
    try {
      await api.logEntry(writeToken)
      await load(true)
    } catch (e) {
      setErr(e.message)
    }
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
    log, join, rename, updateSettings, leave, remove,
    reload: load,
  }
}
