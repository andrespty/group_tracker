import { supabase } from './supabase.js'

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
