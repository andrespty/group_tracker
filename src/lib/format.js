export const fmt = (n) => Number(n).toLocaleString('en-US')

export const initials = (name = '') =>
  name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?'

export const singular = (unit = '') => unit.replace(/s$/, '')

// Tracker kinds: what a tracker's unit means, and how its numbers read.
// This is the single source of truth CreateTracker/SettingsTab build their
// kind picker + adaptive unit field from.
export const KINDS = [
  {
    id: 'count',
    label: 'Count',
    hint: 'A simple tally — drinks, reps, anything you can count.',
    unitMode: 'freeform',
    defaultUnit: 'entries',
    whole: true,
  },
  {
    id: 'distance',
    label: 'Distance',
    hint: 'Miles or kilometers covered.',
    unitMode: 'select',
    unitOptions: ['mi', 'km'],
    defaultUnit: 'mi',
    whole: false,
  },
  {
    id: 'money',
    label: 'Money',
    hint: 'Dollars (or another currency) saved or spent.',
    unitMode: 'select',
    unitOptions: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'],
    defaultUnit: 'USD',
    whole: false,
  },
  {
    id: 'duration',
    label: 'Duration',
    hint: 'Minutes or hours spent.',
    unitMode: 'select',
    unitOptions: ['min', 'hr'],
    defaultUnit: 'min',
    whole: false,
  },
]

export const kindMeta = (kind) => KINDS.find((k) => k.id === kind) || KINDS[0]

// The one place that decides how a raw number reads for a given tracker
// kind. For 'count' this is byte-for-byte what `fmt()` already produced,
// so existing (kind-less, i.e. defaulted to 'count') trackers look
// unchanged. Money returns a full currency string (symbol included) since
// there's no clean way to bolt a currency symbol on afterward the way a
// unit word like "mi" gets appended by the caller.
export const formatAmount = (amount, kind, unit) => {
  const n = Number(amount)
  if (kind === 'money') {
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: unit || 'USD' }).format(n)
    } catch {
      return `${fmt(n)} ${unit || ''}`.trim()
    }
  }
  if (kind === 'distance' || kind === 'duration') {
    return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
  }
  return fmt(n)
}

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
