import { colorFor } from '../lib/colors.js'
import { initials } from '../lib/format.js'

export function Avatar({ id, name, className = 'av' }) {
  return (
    <div className={className} style={{ background: colorFor(id) }}>
      {initials(name)}
    </div>
  )
}
