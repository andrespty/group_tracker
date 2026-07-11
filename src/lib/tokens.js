const LS = 'tally_tokens'

export const tokens = {
  all: () => JSON.parse(localStorage.getItem(LS) || '{}'),
  get: (viewToken) => tokens.all()[viewToken] || null,
  set: (viewToken, writeToken) => {
    const m = tokens.all()
    m[viewToken] = writeToken
    localStorage.setItem(LS, JSON.stringify(m))
  },
}
