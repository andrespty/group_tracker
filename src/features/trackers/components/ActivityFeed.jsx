import { useState } from 'react'
import { fmt, ago, singular, formatAmount } from '../../../lib/format.js'
import { photoUrl } from '../../../lib/photos.js'
import { Avatar } from '../../../components/Avatar.jsx'
import { Lightbox } from '../../../components/Lightbox.jsx'

function amountPhrase(r, kind, unit) {
  if (kind === 'count') {
    return Number(r.amount) === 1 ? `a ${singular(unit)}` : `+${fmt(r.amount)}`
  }
  return `+${formatAmount(r.amount, kind, unit)}${kind === 'money' ? '' : ` ${unit}`}`
}

export function ActivityFeed({ recent, kind, unit, myMemberId, isCreator, onDelete }) {
  const [lightboxSrc, setLightboxSrc] = useState(null)
  const [confirmingId, setConfirmingId] = useState(null)

  if (!recent?.length) {
    return <p className="hint" style={{ padding: 10 }}>No activity yet.</p>
  }

  const canDelete = (r) => r.member_id === myMemberId || isCreator

  return (
    <>
      <div className="feed">
        {recent.map((r) => (
          <div key={r.entry_id} className={`fitem ${r.status === 'rejected' ? 'rejected' : ''}`}>
            <Avatar id={r.member_id} name={r.name} />
            <div className="txt">
              <b>{r.name}</b> logged {amountPhrase(r, kind, unit)}
              {r.status === 'pending' && <span className="status-chip pending">Pending</span>}
              {r.status === 'rejected' && <span className="status-chip rejected">Rejected</span>}
              {r.note && <div className="fnote">{r.note}</div>}
              {r.thumb_path && (
                <button type="button" className="fthumbbtn" onClick={() => setLightboxSrc(photoUrl(r.photo_path))}>
                  <img className="fthumb" src={photoUrl(r.thumb_path)} alt="" />
                </button>
              )}
              <span className="time">{ago(r.occurred_at)}</span>
            </div>

            <div className="amt">+{formatAmount(r.amount, kind, unit)}</div>

            {canDelete(r) && (
              confirmingId === r.entry_id ? (
                <span className="fdelete-confirm">
                  <button type="button" className="linkbtn" onClick={() => { onDelete(r.entry_id); setConfirmingId(null) }}>
                    Delete
                  </button>
                  <button type="button" className="linkbtn" onClick={() => setConfirmingId(null)}>Cancel</button>
                </span>
              ) : (
                <button type="button" className="ficonbtn" onClick={() => setConfirmingId(r.entry_id)}
                        aria-label="Delete entry">🗑</button>
              )
            )}
          </div>
        ))}
      </div>

      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </>
  )
}
