import React, { useEffect, useState, useCallback, useRef } from 'react'
import { supabase, api, tokens } from './api.js'

/* ---------- helpers ---------- */
const fmt = (n) => Number(n).toLocaleString('en-US')
const viewTokenFromUrl = () => new URLSearchParams(location.search).get('g')
const linkFor = (vt) => `${location.origin}${location.pathname}?g=${vt}`
const PALETTE = ['#F5674A', '#F3A23C', '#4FA6A0', '#8FB56B', '#A99BD1', '#EC6A8B']
const colorFor = (id = '') => {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]
}
const initials = (name = '') =>
  name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?'
const ago = (iso) => {
  const s = Math.max(1, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = s / 60; if (m < 60) return `${Math.floor(m)}m ago`
  const h = m / 60; if (h < 24) return `${Math.floor(h)}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function confettiBurst(x, y) {
  if (document.documentElement.dataset.motion === 'off') return
  for (let i = 0; i < 16; i++) {
    const el = document.createElement('div')
    el.className = 'confetti'
    el.style.left = x + 'px'; el.style.top = y + 'px'
    el.style.background = PALETTE[i % PALETTE.length]
    document.body.appendChild(el)
    const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 90
    el.animate(
      [{ transform: 'translate(0,0) rotate(0)', opacity: 1 },
       { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d + 150}px) rotate(${Math.random() * 540}deg)`, opacity: 0 }],
      { duration: 900 + Math.random() * 400, easing: 'cubic-bezier(.2,.6,.3,1)' }
    ).onfinish = () => el.remove()
  }
}

/* ---------- app shell ---------- */
export default function App() {
  const [session, setSession] = useState(null)
  const [vt, setVt] = useState(viewTokenFromUrl())
  const [theme, setTheme] = useState(localStorage.getItem('tally_theme') || 'light')

  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    const onPop = () => setVt(viewTokenFromUrl())
    window.addEventListener('popstate', onPop)
    return () => { sub.subscription.unsubscribe(); window.removeEventListener('popstate', onPop) }
  }, [])

  const go = (newVt) => {
    history.pushState({}, '', newVt ? linkFor(newVt) : `${location.origin}${location.pathname}`)
    setVt(newVt)
  }
  const toggleTheme = () => {
    const t = theme === 'light' ? 'dark' : 'light'
    setTheme(t); localStorage.setItem('tally_theme', t)
  }

  return (
    <div className="wrap">
      <header className="top">
        <div className="brand" onClick={() => go(null)}>Tal<b>ly</b></div>
        <div className="topright">
          <button className="iconbtn" onClick={toggleTheme} title="Toggle mood">
            {theme === 'light' ? '\u263e' : '\u2600'}
          </button>
          {session
            ? <button className="linkbtn" onClick={() => supabase.auth.signOut()}>sign out</button>
            : <span className="who">guest</span>}
        </div>
      </header>
      {vt ? <Tracker vt={vt} session={session} /> : <Home session={session} go={go} />}
    </div>
  )
}

/* ---------- home ---------- */
function Home({ session, go }) {
  const [mine, setMine] = useState(null)
  useEffect(() => {
    if (session) api.getMyTrackers().then(setMine).catch(() => setMine([]))
    else setMine(null)
  }, [session])
  return (
    <>
      <CreateTracker go={go} />
      {session ? <MyTrackers list={mine} go={go} /> : <AuthBox />}
    </>
  )
}

function CreateTracker({ go }) {
  const [f, setF] = useState({ name: '', creatorName: '', unit: 'drinks', increment: 1, goal: 10000 })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = async () => {
    setErr(''); setBusy(true)
    try {
      const r = await api.createGroup({
        name: f.name, creatorName: f.creatorName, unit: f.unit,
        increment: Number(f.increment), goal: f.goal === '' ? null : Number(f.goal),
      })
      tokens.set(r.view_token, r.write_token); go(r.view_token)
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <div className="card">
      <p className="eyebrow">Start a tracker</p>
      <label>What are you tracking?</label>
      <input value={f.name} onChange={set('name')} placeholder="Road to 10K drinks" />
      <div className="grid2">
        <div><label>Unit</label><input value={f.unit} onChange={set('unit')} placeholder="drinks" /></div>
        <div><label>Per tap</label><input type="number" value={f.increment} onChange={set('increment')} /></div>
      </div>
      <label>Goal (blank = no goal)</label>
      <input type="number" value={f.goal} onChange={set('goal')} placeholder="10000" />
      <label>Your name</label>
      <input value={f.creatorName} onChange={set('creatorName')} placeholder="Alex" />
      <div className="spacer" />
      <button className="btn full" disabled={busy || !f.name || !f.creatorName} onClick={submit}>
        {busy ? 'Creating\u2026' : 'Create tracker'}
      </button>
      {err && <p className="err">{err}</p>}
    </div>
  )
}

function MyTrackers({ list, go }) {
  if (!list) return null
  return (
    <div className="card">
      <p className="eyebrow">My trackers</p>
      {list.length === 0 && <p className="hint">None yet. Create one above, or open a friend's link to join.</p>}
      {list.map((t) => (
        <div key={t.view_token} className="trow"
             onClick={() => { tokens.set(t.view_token, t.write_token); go(t.view_token) }}>
          <div>
            <div className="tname">{t.name}</div>
            <div className="tsub">as {t.my_name}</div>
          </div>
          <div className="tval">{fmt(t.total)}{t.goal ? ` / ${fmt(t.goal)}` : ''}</div>
        </div>
      ))}
    </div>
  )
}

function AuthBox() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')
  const send = async () => {
    setErr('')
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href } })
    if (error) setErr(error.message); else setSent(true)
  }
  return (
    <div className="card">
      <p className="eyebrow">Optional account</p>
      <p className="hint">Play as a guest, or sign in to keep all your trackers in one place across devices.</p>
      {sent
        ? <p className="hint">\u2713 Check your email for a one-tap sign-in link.</p>
        : <>
            <label>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
            <div className="spacer" />
            <button className="btn full ghost" onClick={send} disabled={!email}>Email me a magic link</button>
          </>}
      {err && <p className="err">{err}</p>}
    </div>
  )
}

/* ---------- tracker ---------- */
function Tracker({ vt, session }) {
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [writeToken, setWriteToken] = useState(tokens.get(vt))
  const [displayTotal, setDisplayTotal] = useState(0)
  const raf = useRef(0)
  const btnRef = useRef(null)

  const animateTo = useCallback((to) => {
    cancelAnimationFrame(raf.current)
    if (document.documentElement.dataset.motion === 'off') { setDisplayTotal(to); return }
    const from = displayTotal, start = performance.now()
    const tick = (now) => {
      const p = Math.min(1, (now - start) / 650)
      const v = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)))
      setDisplayTotal(v)
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }, [displayTotal])

  const load = useCallback(async (animate) => {
    try {
      const d = await api.getStandings(vt)
      setData(d)
      animate ? animateTo(d.total) : setDisplayTotal(d.total)
    } catch (e) { setErr(e.message) }
  }, [vt, animateTo])

  useEffect(() => { load(false) }, [vt]) // eslint-disable-line

  if (err) return <div className="card"><p className="err">Couldn't load: {err}</p></div>
  if (!data) return <div className="card center-txt muted">Loading\u2026</div>

  const g = data.group
  const hasGoal = g.goal != null && Number(g.goal) > 0
  const C = 2 * Math.PI * 120

  const tap = async () => {
    if (!writeToken) return
    const r = btnRef.current?.getBoundingClientRect()
    if (r) confettiBurst(r.left + r.width / 2, r.top)
    try { await api.logEntry(writeToken); await load(true) }
    catch (er) { setErr(er.message) }
  }

  let offset = 0
  const arcs = hasGoal ? data.leaderboard.map((m) => {
    const len = (Number(m.total) / Number(g.goal)) * C
    const seg = { len, offset, color: colorFor(m.member_id) }
    offset += len
    return seg
  }) : []
  const pct = hasGoal ? (data.total / g.goal * 100) : 0
  const singular = (u) => u.replace(/s$/, '')

  return (
    <>
      <div className="grouppill"><span className="dot" /> {g.name}</div>

      <div className="hero">
        {hasGoal ? (
          <div className="ringwrap">
            <svg className="breathe" width="286" height="286" viewBox="0 0 286 286">
              <circle cx="143" cy="143" r="120" stroke="var(--track)" strokeWidth="20" fill="none" />
              {arcs.map((a, i) => (
                <circle key={i} cx="143" cy="143" r="120" fill="none" strokeWidth="20"
                  strokeLinecap="round" stroke={a.color}
                  strokeDasharray={`${a.len} ${C - a.len}`} strokeDashoffset={-a.offset} />
              ))}
            </svg>
            <div className="center">
              <div className="count">{fmt(displayTotal)}</div>
              <div className="of">of {fmt(g.goal)} {g.unit}</div>
              <div className="chip"><b>{pct.toFixed(1)}%</b> \u00b7 {data.leaderboard.length} {data.leaderboard.length === 1 ? 'player' : 'friends'}</div>
            </div>
          </div>
        ) : (
          <div className="numhero">
            <div className="bignum">{fmt(displayTotal)}</div>
            <span className="of">{fmt(data.total)} {g.unit}</span>
          </div>
        )}
      </div>

      {writeToken
        ? <button className="logbtn" ref={btnRef} onClick={tap}>
            <span className="plus">\uFF0B</span> Log {g.increment == 1 ? `a ${singular(g.unit)}` : `${fmt(g.increment)} ${g.unit}`}
          </button>
        : <JoinBox vt={vt} onJoined={(wt) => { tokens.set(vt, wt); setWriteToken(wt); load(false) }} />}

      {data.recent?.length > 0 && (
        <div className="sec">
          <h3>Latest rounds</h3>
          <div className="feed">
            {data.recent.map((r, i) => (
              <div key={i} className="fitem">
                <div className="av" style={{ background: colorFor(r.member_id) }}>{initials(r.name)}</div>
                <div className="txt"><b>{r.name}</b> logged {r.amount == 1 ? `a ${singular(g.unit)}` : `+${fmt(r.amount)}`}
                  <span className="time">{ago(r.created_at)}</span></div>
                <div className="amt">+{fmt(r.amount)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="sec">
        <h3>Who's carrying the group</h3>
        <Leaderboard rows={data.leaderboard} />
      </div>

      <ShareBox vt={vt} writeToken={writeToken} session={session} />
      <div className="foot">Anyone with the link can cheer you on \uD83C\uDF7B</div>
    </>
  )
}

function Leaderboard({ rows }) {
  if (!rows.length) return <div className="board"><p className="hint" style={{ padding: 10 }}>No entries yet.</p></div>
  const max = Math.max(...rows.map((r) => Number(r.total)), 1)
  return (
    <div className="board">
      {rows.map((m, i) => {
        const c = colorFor(m.member_id)
        return (
          <div key={m.member_id} className={`row ${i === 0 ? 'lead' : ''}`}>
            <div className="rank">{i + 1}</div>
            <div className="rav" style={{ background: c }}>{initials(m.name)}</div>
            <div>
              <div className="rname">{m.name}</div>
              <div className="rbar"><span style={{ width: `${Number(m.total) / max * 100}%`, background: c }} /></div>
            </div>
            <div className="rval">{fmt(m.total)}</div>
          </div>
        )
      })}
    </div>
  )
}

function JoinBox({ vt, onJoined }) {
  const [name, setName] = useState('')
  const [err, setErr] = useState('')
  const join = async () => {
    setErr('')
    try { const r = await api.addMember(vt, name); onJoined(r.write_token) }
    catch (e) { setErr(e.message) }
  }
  return (
    <div className="card">
      <p className="eyebrow">Join this tracker</p>
      <label>Your name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sam" />
      <div className="spacer" />
      <button className="btn full" onClick={join} disabled={!name}>Join &amp; start logging</button>
      {err && <p className="err">{err}</p>}
    </div>
  )
}

function ShareBox({ vt, writeToken, session }) {
  const url = import.meta.env.VITE_SUPABASE_URL
  const endpoint = `${url}/rest/v1/rpc/log_entry`
  const claim = async () => {
    try { await api.claimMember(writeToken); alert('Linked to your account \u2713') }
    catch (e) { alert(e.message) }
  }
  return (
    <div className="sec">
      <h3>Share &amp; log from your phone</h3>
      <div className="card" style={{ marginBottom: 0 }}>
        <p className="hint" style={{ marginTop: 0 }}>Anyone with this link can view the board and join:</p>
        <div className="share">{linkFor(vt)}</div>
        {writeToken && <>
          <p className="hint" style={{ marginTop: 16 }}>For a one-tap iOS Shortcut, POST to this endpoint with your write token (see the README):</p>
          <div className="share">{endpoint}</div>
          <div className="share">write_token: {writeToken}</div>
          {session && <>
            <div className="spacer" />
            <button className="btn full ghost" onClick={claim}>Link this tracker to my account</button>
          </>}
        </>}
      </div>
    </div>
  )
}
