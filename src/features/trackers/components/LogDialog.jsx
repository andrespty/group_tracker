import { useRef, useState } from 'react'
import { kindMeta } from '../../../lib/format.js'
import { uploadEntryPhoto } from '../../../lib/photos.js'
import { Button } from '../../../components/Button.jsx'
import { useModalA11y } from '../../../components/useModalA11y.js'

function nowLocal() {
  const d = new Date()
  d.setSeconds(0, 0)
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

export function LogDialog({ kind, unit, increment, groupId, onConfirm, onClose }) {
  const meta = kindMeta(kind)
  const [amount, setAmount] = useState(String(increment))
  const [note, setNote] = useState('')
  const [occurredAt, setOccurredAt] = useState(nowLocal)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const fileInputRef = useRef(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [photoState, setPhotoState] = useState('idle') // idle | working | done | error
  const [photoPaths, setPhotoPaths] = useState(null)

  const dialogRef = useRef(null)
  const firstFieldRef = useRef(null)
  useModalA11y(dialogRef, onClose, firstFieldRef)

  const pickPhoto = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoPreview(URL.createObjectURL(file))
    setPhotoState('working')
    setPhotoPaths(null)
    try {
      const paths = await uploadEntryPhoto(file, groupId)
      setPhotoPaths(paths)
      setPhotoState('done')
    } catch {
      setPhotoState('error')
    }
  }

  const removePhoto = () => {
    setPhotoPreview(null)
    setPhotoState('idle')
    setPhotoPaths(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const confirm = async (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const origin = { x: r.left + r.width / 2, y: r.top }
    setError(''); setSubmitting(true)
    try {
      await onConfirm({
        amount: Number(amount),
        note,
        occurredAt: occurredAt ? new Date(occurredAt).toISOString() : null,
        photoPath: photoPaths?.photoPath || null,
        thumbPath: photoPaths?.thumbPath || null,
      }, origin)
      onClose()
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" ref={dialogRef} role="dialog" aria-modal="true"
           aria-label="Log an entry" onClick={(e) => e.stopPropagation()}>
        <div className="dialoghead">
          <p className="eyebrow" style={{ margin: 0 }}>Log an entry</p>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <label>Amount ({unit})</label>
        <input ref={firstFieldRef} type="number" inputMode="decimal" step={meta.whole ? '1' : 'any'}
               value={amount} onChange={(e) => setAmount(e.target.value)} />

        <label>Note (optional)</label>
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
               placeholder="beers at Tom's birthday" />

        <label>When</label>
        <input type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />

        <label>Photo (optional)</label>
        {!photoPreview ? (
          <label className="btn ghost full photopick">
            <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
            Add a photo
          </label>
        ) : (
          <div className="photopreview">
            <img src={photoPreview} alt="" />
            <div className="photopreview-info">
              {photoState === 'working' && <span className="hint" style={{ margin: 0 }}>Uploading…</span>}
              {photoState === 'done' && <span className="hint" style={{ margin: 0 }}>Ready ✓</span>}
              {photoState === 'error' && (
                <span className="err" style={{ margin: 0 }}>Upload failed — will log without photo</span>
              )}
            </div>
            <button type="button" className="iconbtn" onClick={removePhoto} aria-label="Remove photo">✕</button>
          </div>
        )}

        {error && <p className="err">{error}</p>}

        <div className="spacer" />
        <div className="grid2">
          <Button variant="ghost" full onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button full onClick={confirm} disabled={submitting || !amount || photoState === 'working'}>
            {submitting ? 'Logging…' : 'Confirm'}
          </Button>
        </div>
      </div>
    </div>
  )
}
