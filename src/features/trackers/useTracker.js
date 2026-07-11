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

  const load = useCallback(async (animate = false) => {
    try {
      const d = await api.getStandings(vt)
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
  }, [vt, animateTo])

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
    await load(false)
  }, [vt, load])

  return { data, err, writeToken, displayTotal, log, join, reload: load }
}
