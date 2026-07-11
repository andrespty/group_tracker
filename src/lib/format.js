export const fmt = (n) => Number(n).toLocaleString('en-US')

export const initials = (name = '') =>
  name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?'

export const singular = (unit = '') => unit.replace(/s$/, '')

export const ago = (iso) => {
  const s = Math.max(1, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = s / 60
  if (m < 60) return `${Math.floor(m)}m ago`
  const h = m / 60
  if (h < 24) return `${Math.floor(h)}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export const viewTokenFromUrl = () =>
  new URLSearchParams(location.search).get('g')

export const linkFor = (vt) =>
  `${location.origin}${location.pathname}?g=${vt}`
