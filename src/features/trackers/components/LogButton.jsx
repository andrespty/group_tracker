import { useRef } from 'react'
import { fmt, singular } from '../../../lib/format.js'

export function LogButton({ increment, unit, onLog }) {
  const ref = useRef(null)

  const handle = () => {
    const r = ref.current?.getBoundingClientRect()
    onLog(r ? { x: r.left + r.width / 2, y: r.top } : null)
  }

  const label = Number(increment) === 1
    ? `a ${singular(unit)}`
    : `${fmt(increment)} ${unit}`

  return (
    <button className="logbtn" ref={ref} onClick={handle}>
      <span className="plus">＋</span> Log {label}
    </button>
  )
}
