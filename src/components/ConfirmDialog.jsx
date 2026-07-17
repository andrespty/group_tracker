import { useRef } from 'react'
import { useModalA11y } from './useModalA11y.js'
import { Button } from './Button.jsx'

export function ConfirmDialog({
  title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  danger, busy, error, onConfirm, onCancel,
}) {
  const dialogRef = useRef(null)
  useModalA11y(dialogRef, onCancel)

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog" ref={dialogRef} role="dialog" aria-modal="true"
           aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="dialoghead">
          <p className="eyebrow" style={{ margin: 0 }}>{title}</p>
          <button type="button" className="iconbtn" onClick={onCancel} aria-label="Close">✕</button>
        </div>

        <p className="hint" style={{ marginTop: 0 }}>{message}</p>
        {error && <p className="err">{error}</p>}

        <div className="spacer" />
        <div className="grid2">
          <Button variant="ghost" full onClick={onCancel} disabled={busy}>{cancelLabel}</Button>
          <Button variant={danger ? 'danger' : 'solid'} full onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
