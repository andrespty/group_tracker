export const PALETTE = ['#F5674A', '#F3A23C', '#4FA6A0', '#8FB56B', '#A99BD1', '#EC6A8B']

export const colorFor = (id = '') => {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]
}
