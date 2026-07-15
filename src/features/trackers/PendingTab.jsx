import { useState } from 'react'
import { ago, formatAmount } from '../../lib/format.js'
import { photoUrl } from '../../lib/photos.js'
import { Avatar } from '../../components/Avatar.jsx'
import { Lightbox } from '../../components/Lightbox.jsx'
import { ConfirmDialog } from '../../components/ConfirmDialog.jsx'
import { Button } from '../../components/Button.jsx'

export function PendingTab({ recent, kind, unit, onVote }) {
  const [lightboxSrc, setLightboxSrc] = useState(null)
  const [confirming, setConfirming] = useState(null) // { entryId, choice }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const queue = (recent || []).filter((r) => r.status === 'pending' && r.can_vote)

  if (!queue.length) {
    return <p className="hint" style={{ padding: 10 }}>Nothing to review right now.</p>
  }

  const cancel = () => { setConfirming(null); setError('') }

  const confirmVote = async () => {
    if (!confirming) return
    setBusy(true); setError('')
    try {
      await onVote(confirming.entryId, confirming.choice)
      setConfirming(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="feed">
        {queue.map((r) => (
          <div key={r.entry_id} className="card" style={{ marginBottom: 9 }}>
            <div className="pendingcard-head">
              <Avatar id={r.member_id} name={r.name} />
              <div className="who">
                <div className="rname">{r.name}</div>
                <span className="time">{ago(r.occurred_at)}</span>
              </div>
              <div className="amt">+{formatAmount(r.amount, kind, unit)}</div>
            </div>

            {r.note && <p className="fnote">{r.note}</p>}

            {r.thumb_path && (
              <button type="button" className="fthumbbtn" onClick={() => setLightboxSrc(photoUrl(r.photo_path))}>
                <img className="fthumb" src={photoUrl(r.thumb_path)} alt="" />
              </button>
            )}

            <div className="votetally">{r.approve_count} approve · {r.reject_count} reject</div>

            <div className="spacer" />
            <div className="grid2">
              <Button variant="ghost" full onClick={() => setConfirming({ entryId: r.entry_id, choice: 'reject' })}>
                Reject
              </Button>
              <Button full onClick={() => setConfirming({ entryId: r.entry_id, choice: 'approve' })}>
                Approve
              </Button>
            </div>
          </div>
        ))}
      </div>

      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}

      {confirming && (
        <ConfirmDialog
          title={confirming.choice === 'approve' ? 'Approve this entry?' : 'Reject this entry?'}
          message={
            confirming.choice === 'approve'
              ? 'It will count toward the total once approved.'
              : "It won't count toward the total, but stays visible in the feed."
          }
          confirmLabel={confirming.choice === 'approve' ? 'Approve' : 'Reject'}
          danger={confirming.choice === 'reject'}
          busy={busy}
          error={error}
          onConfirm={confirmVote}
          onCancel={cancel}
        />
      )}
    </>
  )
}
