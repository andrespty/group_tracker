export function Card({ title, children, style }) {
  return (
    <div className="card" style={style}>
      {title && <p className="eyebrow">{title}</p>}
      {children}
    </div>
  )
}
