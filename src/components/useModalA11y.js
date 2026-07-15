import { useEffect } from 'react'

const FOCUSABLE = 'input, select, button:not([disabled])'

// Shared modal behavior for every dialog in the app: locks background
// scroll, focuses on open (a given `initialFocusRef`, or else the dialog's
// first focusable element — usually its own close button, which is fine
// for a simple confirm dialog but not for a form with a field that should
// be pre-focused), closes on Escape, and traps Tab/Shift+Tab inside the
// dialog. Used by LogDialog and ConfirmDialog so every modal behaves
// identically.
export function useModalA11y(dialogRef, onClose, initialFocusRef) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    ;(initialFocusRef?.current || dialogRef.current?.querySelector(FOCUSABLE))?.focus()

    const onKeyDown = (e) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab') return
      const list = Array.from(dialogRef.current?.querySelectorAll(FOCUSABLE) || [])
      if (!list.length) return
      const first = list[0]
      const last = list[list.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])
}
