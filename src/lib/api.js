import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(url, key)

// Small helper: unwrap rpc results / throw readable errors.
async function rpc(fn, args) {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data
}

export const api = {
  createGroup: (p) =>
    rpc('create_group', {
      p_name: p.name,
      p_creator_name: p.creatorName,
      p_unit: p.unit,
      p_increment: p.increment,
      p_goal: p.goal ?? null,
    }),
  addMember: (viewToken, name) =>
    rpc('add_member', { p_view_token: viewToken, p_name: name }),
  logEntry: (writeToken, amount = null) =>
    rpc('log_entry', { p_write_token: writeToken, p_amount: amount }),
  getStandings: (viewToken) =>
    rpc('get_standings', { p_view_token: viewToken }),
  claimMember: (writeToken) =>
    rpc('claim_member', { p_write_token: writeToken }),
  getMyTrackers: () => rpc('get_my_trackers', {}),
}

// --- local storage of the current user's write tokens, keyed by view token ---
// (This is a normal web app, so localStorage is the right tool here.)
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
