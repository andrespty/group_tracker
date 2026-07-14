import { fmt, singular, formatAmount } from '../../../lib/format.js'

export function LogButton({ increment, kind, unit, onOpen }) {
  const label = kind === 'count'
    ? (Number(increment) === 1 ? `a ${singular(unit)}` : `${fmt(increment)} ${unit}`)
    : `${formatAmount(increment, kind, unit)}${kind === 'money' ? '' : ` ${unit}`}`

  return (
    <button className="logbtn" onClick={onOpen}>
      <span className="plus">＋</span> Log {label}
    </button>
  )
}
