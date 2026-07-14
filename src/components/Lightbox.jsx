import { useEffect } from 'react'

export function Lightbox({ src, onClose }) {
  useEffect(() => {
    const onKeyDown = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="lightbox" onClick={onClose}>
      <img src={src} alt="" onClick={(e) => e.stopPropagation()} />
      <button type="button" className="iconbtn lightbox-close" onClick={onClose} aria-label="Close">✕</button>
    </div>
  )
}
