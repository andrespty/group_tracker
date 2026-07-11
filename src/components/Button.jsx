export function Button({ variant = 'solid', full, children, ...rest }) {
  const cls = ['btn', variant === 'ghost' && 'ghost', full && 'full'].filter(Boolean).join(' ')
  return <button className={cls} {...rest}>{children}</button>
}
