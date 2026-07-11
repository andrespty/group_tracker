import { useEffect, useState } from 'react'
import { api } from '../../lib/api.js'
import { tokens } from '../../lib/tokens.js'
import { fmt } from '../../lib/format.js'
import { Card } from '../../components/Card.jsx'

export function MyTrackers({ go }) {
  const [list, setList] = useState(null)

  useEffect(() => {
    api.getMyTrackers().then(setList).catch(() => setList([]))
  }, [])

  if (!list) return null

  return (
    <Card title="My trackers">
      {list.length === 0 && (
        <p className="hint">None yet. Create one above, or open a friend's link to join.</p>
      )}
      {list.map((t) => (
        <div key={t.view_token} className="trow"
             onClick={() => { tokens.set(t.view_token, t.write_token); go(t.view_token) }}>
          <div>
            <div className="tname">{t.name}</div>
            <div className="tsub">as {t.my_name}</div>
          </div>
          <div className="tval">
            {fmt(t.total)}{t.goal ? ` / ${fmt(t.goal)}` : ''}
          </div>
        </div>
      ))}
    </Card>
  )
}
